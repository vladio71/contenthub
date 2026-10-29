import { readInt, readString } from './env';

export interface CommonConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  mongoDbName: string;
  jwtSecret: string;
}

export interface ServiceDefaults {
  port: number;
  dbName: string;
}

const MIN_SECRET_LENGTH = 32;

/** Settings every service needs. Each service adds its own on top. */
export function loadCommonConfig(defaults: ServiceDefaults): CommonConfig {
  const jwtSecret = readString('JWT_SECRET');
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must have at least ${MIN_SECRET_LENGTH} characters`);
  }
  return {
    nodeEnv: readString('NODE_ENV', 'development'),
    port: readInt('PORT', defaults.port),
    mongoUri: readString('MONGO_URI', 'mongodb://localhost:27017/?replicaSet=rs0'),
    mongoDbName: readString('MONGO_DB_NAME', defaults.dbName),
    jwtSecret,
  };
}
