import 'dotenv/config';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}`);
  }
  return value;
};

const numberFromEnv = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`La variable ${key} debe ser numérica`);
  }
  return parsed;
};

const allowInsecureTls = process.env.ALLOW_INSECURE_TLS === 'true';
if (allowInsecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const wso2BaseUrl = required('WSO2_BASE_URL').replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  appBaseUrl: required('APP_BASE_URL').replace(/\/$/, ''),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlMs: numberFromEnv('SESSION_TTL_MS', 1000 * 60 * 60),
  allowInsecureTls,
  clockToleranceSeconds: numberFromEnv('CLOCK_TOLERANCE_SECONDS', 300),
  wso2: {
    baseUrl: wso2BaseUrl,
    authorizeUrl: `${wso2BaseUrl}/oauth2/authorize`,
    tokenUrl: `${wso2BaseUrl}/oauth2/token`,
    jwksUrl: `${wso2BaseUrl}/oauth2/jwks`,
    logoutUrl: `${wso2BaseUrl}/oidc/logout`,
    clientId: required('WSO2_CLIENT_ID'),
    clientSecret: required('WSO2_CLIENT_SECRET'),
    tenantDomain: process.env.WSO2_TENANT_DOMAIN ?? 'carbon.super',
  },
};

export type AppConfig = typeof config;

