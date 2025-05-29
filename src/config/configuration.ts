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
  // DB_HOST: process.env.DB_HOST || 'localhost',
  // DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  // DB_USERNAME: process.env.DB_USERNAME || 'postgres',
  // DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  // DB_NAME: process.env.DB_NAME || 'nest_starter',
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
});
