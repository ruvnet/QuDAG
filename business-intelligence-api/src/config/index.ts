/**
 * Application configuration
 */

export const config = {
  app: {
    name: 'QuDAG Business Intelligence API',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8090', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://qudag_executive:password@localhost:5433/qudag_business',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    ssl: process.env.NODE_ENV === 'production',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: {
      metrics: 60, // 1 minute for real-time metrics
      agents: 300, // 5 minutes for agent data
      organization: 3600, // 1 hour for org data
    },
  },
  
  qudag: {
    apiUrl: process.env.QUDAG_API_URL || 'http://localhost:8080',
    exchangeUrl: process.env.QUDAG_EXCHANGE_URL || 'http://localhost:8081',
    wsUrl: process.env.QUDAG_WS_URL || 'ws://localhost:8080/ws',
    apiKey: process.env.QUDAG_API_KEY || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
  },
  
  metrics: {
    collectionInterval: parseInt(process.env.METRICS_INTERVAL || '30000', 10), // 30 seconds
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '90', 10),
  },
  
  features: {
    predictiveAnalytics: process.env.ENABLE_PREDICTIVE_ANALYTICS === 'true',
    voiceCommands: process.env.ENABLE_VOICE_COMMANDS === 'true',
    autoScaling: process.env.ENABLE_AUTO_SCALING === 'true',
  },
} as const;

export type Config = typeof config;
