export interface AppConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_ENABLED: boolean;
  DATABASE_URL: string;

  JWT_SECRET: string;
  JWT_EXPIRATION: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRATION: string;

  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;

  SWAGGER_ENABLED: boolean;

  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string | undefined;

  CORS_ORIGINS: string;

  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_LIFF_ID: string;

  FRONTEND_URL: string;
}
