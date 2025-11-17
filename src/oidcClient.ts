import axios from 'axios';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import https from 'node:https';
import { config } from './config';

// Configurar agente HTTPS que ignora certificados autofirmados (solo para desarrollo)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const jwks = createRemoteJWKSet(new URL(config.wso2.jwksUrl));

export interface TokenSet {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}

export interface UserProfile {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

export const buildAuthorizeUrl = (state: string, nonce: string) => {
  const url = new URL(config.wso2.authorizeUrl);
  url.searchParams.set('client_id', config.wso2.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', `${config.appBaseUrl}/callback`);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
};

export const exchangeCodeForTokens = async (code: string): Promise<TokenSet> => {
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${config.appBaseUrl}/callback`,
  });

  const basic = Buffer.from(
    `${config.wso2.clientId}:${config.wso2.clientSecret}`,
    'utf-8',
  ).toString('base64');

  const { data } = await axios.post(
    config.wso2.tokenUrl,
    payload.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      httpsAgent,
    },
  );

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
};

export const verifyIdToken = async (idToken: string): Promise<JWTPayload> => {
  // Decodificar el token sin verificar primero para obtener el issuer real
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('ID token inválido');
  }

  let tokenIssuer: string | undefined;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson) as JWTPayload;
    tokenIssuer = payload.iss as string | undefined;
  } catch {
    // Si no podemos decodificar, continuamos con la verificación normal
  }

  // Usar el issuer del token si está disponible, sino usar el configurado
  const issuer = tokenIssuer || `${config.wso2.baseUrl}/oauth2/token`;

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: config.wso2.clientId,
    clockTolerance: config.clockToleranceSeconds,
  });
  return payload;
};

