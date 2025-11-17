import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config';
import { InMemorySessionStore } from './sessionStore';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  verifyIdToken,
} from './oidcClient';
import crypto from 'node:crypto';

const app = express();
const sessionStore = new InMemorySessionStore(config.sessionTtlMs);

const SESSION_COOKIE = 'miniapp_session';
const FLOW_COOKIE = 'oidc_flow';
const LOGOUT_FLOW_COOKIE = 'logout_flow';
const isHttps = config.appBaseUrl.startsWith('https://');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.sessionSecret));
app.use(express.static(path.join(process.cwd(), 'public')));

const getSessionFromRequest = (req: Request) => {
  const sessionId = req.signedCookies?.[SESSION_COOKIE] ?? req.cookies?.[SESSION_COOKIE];
  return sessionStore.getSession(sessionId);
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  (req as Request & { session?: typeof session }).session = session;
  return next();
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  res.cookie(
    FLOW_COOKIE,
    JSON.stringify({ state, nonce, createdAt: Date.now() }),
    {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      signed: true,
      maxAge: 5 * 60 * 1000,
    },
  );

  res.redirect(buildAuthorizeUrl(state, nonce));
});

app.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.status(400).send(`WSO2 devolvió un error: ${error} - ${errorDescription}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Falta el authorization code');
  }

  if (!state || typeof state !== 'string') {
    return res.status(400).send('Falta el estado');
  }

  const flowCookie = req.signedCookies?.[FLOW_COOKIE];
  if (!flowCookie) {
    return res.status(400).send('No se encontró el flujo de login');
  }

  let flow: { state: string; nonce: string; createdAt: number };
  try {
    flow = JSON.parse(flowCookie);
  } catch {
    return res.status(400).send('Cookie de flujo inválida');
  }

  if (flow.state !== state) {
    return res.status(400).send('El estado no coincide');
  }

  try {
    const tokenSet = await exchangeCodeForTokens(code);
    const idTokenPayload = await verifyIdToken(tokenSet.idToken);

    const sessionId = sessionStore.createSession({
      sub: idTokenPayload.sub!,
      email: idTokenPayload.email as string | undefined,
      name: (idTokenPayload.name as string | undefined) ??
        [idTokenPayload.given_name, idTokenPayload.family_name]
          .filter(Boolean)
          .join(' '),
      accessToken: tokenSet.accessToken,
      idToken: tokenSet.idToken,
    });

    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      signed: true,
      maxAge: config.sessionTtlMs,
    });
    res.clearCookie(FLOW_COOKIE);
    return res.redirect('/protected.html');
  } catch (callbackError) {
    console.error('Error en /callback', callbackError);
    return res.status(500).send('Error procesando el callback');
  }
});

app.get('/auth-check', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  return res.status(200).json({ sub: session.sub });
});

app.get('/me', requireAuth, (req, res) => {
  const session = (req as Request & { session?: ReturnType<typeof getSessionFromRequest> }).session!;
  res.json({
    sub: session.sub,
    email: session.email,
    name: session.name,
  });
});

app.get('/logout', (req, res) => {
  const sessionId = req.signedCookies?.[SESSION_COOKIE] ?? req.cookies?.[SESSION_COOKIE];
  const session = sessionStore.getSession(sessionId);

  if (!session) {
    res.clearCookie(SESSION_COOKIE);
    return res.redirect('/');
  }

  sessionStore.destroySession(sessionId);
  res.clearCookie(SESSION_COOKIE);

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(
    LOGOUT_FLOW_COOKIE,
    JSON.stringify({ state, createdAt: Date.now() }),
    {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      signed: true,
      maxAge: 5 * 60 * 1000,
    },
  );

  const logoutUrl = new URL(config.wso2.logoutUrl);
  logoutUrl.searchParams.set('id_token_hint', session.idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', `${config.appBaseUrl}/logout/callback`);
  logoutUrl.searchParams.set('state', state);

  return res.redirect(logoutUrl.toString());
});

app.get('/logout/callback', (req, res) => {
  const { state } = req.query;
  if (!state || typeof state !== 'string') {
    return res.redirect('/');
  }

  const flowCookie = req.signedCookies?.[LOGOUT_FLOW_COOKIE];
  if (!flowCookie) {
    return res.redirect('/');
  }

  try {
    const flow = JSON.parse(flowCookie) as { state: string; createdAt: number };
    if (flow.state !== state) {
      return res.redirect('/');
    }
  } catch {
    return res.redirect('/');
  }

  res.clearCookie(LOGOUT_FLOW_COOKIE);
  return res.redirect('/');
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(config.port, () => {
  console.log(`Mini-app escuchando en ${config.port}`);
});

