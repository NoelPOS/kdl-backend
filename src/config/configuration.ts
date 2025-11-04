/**
 * Configuration settings for the application
 * Values are loaded from environment variables with sensible defaults
 */
export default () => ({
  // Application settings
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DATABASE_ENABLED: process.env.DATABASE_ENABLED === 'true',

  // JWT settings
  JWT_SECRET:
    process.env.JWT_SECRET || 'replace_this_with_strong_secret_in_production',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1d',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    'replace_this_with_strong_refresh_secret_in_production',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',

  // Database settings
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Throttling settings
  THROTTLE_TTL: parseInt(process.env.THROTTLE_TTL, 10) || 60,
  THROTTLE_LIMIT: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,

  // Swagger settings
  SWAGGER_ENABLED:
    process.env.SWAGGER_ENABLED === 'true' ||
    process.env.NODE_ENV === 'development',

  // Resend settings
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

  // CORS settings
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'https://kdl-frontend.vercel.app,http://localhost:3000,http://localhost:3001',

  // LINE Bot settings
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET || '',
  LINE_LIFF_ID: process.env.LINE_LIFF_ID || '',

  // Frontend URL for LIFF
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
});
