param(
  [switch]$KeepDb,
  [switch]$SkipIntegration,
  [switch]$SkipE2E
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "..")
$composeFile = Resolve-Path (Join-Path $backendDir "docker-compose.test.yml")
$composeEnvFile = Resolve-Path (Join-Path $backendDir ".env.docker-test")

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Name"
  }
}

function Wait-For-PostgresHealth {
  param(
    [string]$ComposeFilePath,
    [string]$ComposeEnvFilePath,
    [int]$TimeoutSeconds = 90
  )

  $containerId = docker compose --env-file $ComposeEnvFilePath -f $ComposeFilePath ps -q postgres-test
  if (-not $containerId) {
    throw "Could not find postgres-test container id."
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $status = docker inspect --format "{{.State.Health.Status}}" $containerId 2>$null
    if ($status -eq "healthy") {
      Write-Host "Postgres is healthy." -ForegroundColor Green
      return
    }
    Start-Sleep -Seconds 2
  }

  Write-Host "Postgres did not become healthy in time. Logs:" -ForegroundColor Red
  docker compose -f $ComposeFilePath logs postgres-test
  throw "Postgres health check timed out."
}

Push-Location $backendDir
$dbStarted = $false
$needsDb = -not ($SkipIntegration -and $SkipE2E)
try {
  if ($needsDb) {
    Invoke-Step "Check Docker daemon availability" {
      docker info | Out-Null
    }
  }

  if ($needsDb) {
    Invoke-Step "Reset test database container" {
      docker compose --env-file $composeEnvFile -f $composeFile down --volumes --remove-orphans
    }
  }

  if ($needsDb) {
    Invoke-Step "Start test database container" {
      docker compose --env-file $composeEnvFile -f $composeFile up -d
    }
    $dbStarted = $true
  }

  if ($needsDb) {
    Invoke-Step "Wait for test database health" {
      Wait-For-PostgresHealth -ComposeFilePath $composeFile -ComposeEnvFilePath $composeEnvFile
    }
  }

  # Test environment variables
  $env:NODE_ENV = "test"
  $env:DATABASE_ENABLED = "true"
  $env:DB_SYNCHRONIZE = "true"
  $env:DATABASE_URL = "postgresql://test:test@localhost:54329/kdl_test"
  $env:JWT_SECRET = "test-secret"
  $env:JWT_REFRESH_SECRET = "test-refresh-secret"
  $env:JWT_EXPIRATION = "8h"
  $env:JWT_REFRESH_EXPIRATION = "7d"
  $env:THROTTLE_TTL = "60"
  $env:THROTTLE_LIMIT = "100"
  $env:RESEND_API_KEY = "test-resend-api-key"
  $env:RESEND_FROM_EMAIL = "test@example.com"

  Invoke-Step "Run backend unit tests" {
    npm.cmd run test -- --runInBand
  }

  if (-not $SkipIntegration) {
    Invoke-Step "Run backend integration tests" {
      npm.cmd run test:integration -- --runInBand
    }
  }

  if (-not $SkipE2E) {
    Invoke-Step "Run backend e2e tests" {
      npm.cmd run test:e2e -- --runInBand
    }
  }

  Invoke-Step "Build backend" {
    npm.cmd run build
  }

  Write-Host ""
  Write-Host "All requested backend checks completed successfully." -ForegroundColor Green
}
finally {
  if ($dbStarted -and -not $KeepDb) {
    Write-Host ""
    Write-Host "Cleaning up test database container..." -ForegroundColor Yellow
    docker compose --env-file $composeEnvFile -f $composeFile down --volumes --remove-orphans | Out-Null
  } elseif ($dbStarted -and $KeepDb) {
    Write-Host ""
    Write-Host "Keeping test database container running (--KeepDb)." -ForegroundColor Yellow
  }
  Pop-Location
}
