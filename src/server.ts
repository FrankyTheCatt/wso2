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
import { getMenderClient } from './menderClient';
import crypto from 'node:crypto';

const app = express();
const sessionStore = new InMemorySessionStore(config.sessionTtlMs);

const SESSION_COOKIE = 'taller2ciber_session';
const FLOW_COOKIE = 'oidc_flow';
const LOGOUT_FLOW_COOKIE = 'logout_flow';
const isHttps = config.appBaseUrl.startsWith('https://');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.sessionSecret));

const getSessionFromRequest = (req: Request) => {
  const sessionId = req.signedCookies?.[SESSION_COOKIE] ?? req.cookies?.[SESSION_COOKIE];
  return sessionStore.getSession(sessionId);
};

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    // Si es una petición HTML, redirigir a la página principal con mensaje de error
    const acceptsHtml = req.accepts('html');
    if (acceptsHtml) {
      return res.redirect(`/?error=session_required&redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    // Para APIs, devolver JSON
    return res.status(401).json({ error: 'No autenticado' });
  }
  (req as Request & { session?: typeof session }).session = session;
  return next();
};

/**
 * Middleware que verifica que todos los dispositivos de Mender estén saludables
 * antes de permitir el acceso a páginas protegidas
 */
const requireHealthyDevices = async (req: Request, res: Response, next: NextFunction) => {
  const menderClient = getMenderClient();
  
  // Si Mender no está configurado, permitir acceso (no es requerido)
  if (!menderClient) {
    console.log('[requireHealthyDevices] Mender no está configurado, permitiendo acceso');
    return next();
  }

  // Solo verificar para peticiones HTML (páginas protegidas)
  const acceptsHtml = req.accepts('html');
  if (!acceptsHtml) {
    // Para APIs, permitir acceso sin verificar dispositivos
    console.log('[requireHealthyDevices] Petición no HTML, permitiendo acceso');
    return next();
  }

  try {
    console.log('[requireHealthyDevices] Verificando salud de dispositivos...');
    
    // Obtener todos los dispositivos
    const devices = await menderClient.listDevices();
    console.log(`[requireHealthyDevices] Encontrados ${devices?.length || 0} dispositivos`);
    
    // Si no hay dispositivos, permitir acceso
    if (!devices || devices.length === 0) {
      console.log('[requireHealthyDevices] No hay dispositivos, permitiendo acceso');
      return next();
    }

    // Verificar el estado de cada dispositivo
    const deviceStatuses = await Promise.all(
      devices.map(device => menderClient.checkDeviceStatus(device.id))
    );

    // Log del estado de cada dispositivo
    deviceStatuses.forEach(status => {
      console.log(`[requireHealthyDevices] Dispositivo ${status.deviceId}: estado=${status.status}, saludable=${status.healthy}`);
      if (!status.healthy) {
        console.log(`[requireHealthyDevices] Razón: ${status.healthReason}`);
      }
    });

    // Filtrar dispositivos no saludables
    const unhealthyDevices = deviceStatuses.filter(status => !status.healthy);

    // Si hay dispositivos no saludables, mostrar página de error
    if (unhealthyDevices.length > 0) {
      console.log(`[requireHealthyDevices] Bloqueando acceso: ${unhealthyDevices.length} dispositivo(s) no saludable(s)`);
      // Guardar información de dispositivos no saludables en la sesión para mostrarla en la página
      (req as any).unhealthyDevices = unhealthyDevices;
      return res.sendFile(path.join(process.cwd(), 'public', 'device-unhealthy.html'));
    }

    // Todos los dispositivos están saludables, permitir acceso
    console.log('[requireHealthyDevices] Todos los dispositivos están saludables, permitiendo acceso');
    return next();
  } catch (error) {
    console.error('[requireHealthyDevices] Error verificando salud de dispositivos:', error);
    // En caso de error, bloquear acceso para seguridad
    // Solo permitir acceso si es un error de configuración (Mender no disponible)
    if (error instanceof Error && error.message.includes('no está habilitado')) {
      console.log('[requireHealthyDevices] Mender no habilitado, permitiendo acceso');
      return next();
    }
    // Para otros errores, bloquear acceso por seguridad
    console.error('[requireHealthyDevices] Error crítico, bloqueando acceso por seguridad');
    return res.status(503).sendFile(path.join(process.cwd(), 'public', 'device-unhealthy.html'));
  }
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

// Endpoints de Mender
app.get('/api/mender/devices', requireAuth, async (_req, res) => {
  const menderClient = getMenderClient();
  if (!menderClient) {
    return res.status(503).json({ 
      error: 'Mender no disponible',
      message: 'Mender no está configurado o no está disponible'
    });
  }

  try {
    const devices = await menderClient.listDevices();
    res.json({ devices });
  } catch (error) {
    console.error('Error obteniendo dispositivos de Mender:', error);
    res.status(500).json({ 
      error: 'Error obteniendo dispositivos',
      message: 'No se pudieron obtener los dispositivos de Mender'
    });
  }
});

app.get('/api/mender/devices/:deviceId', requireAuth, async (req, res) => {
  const menderClient = getMenderClient();
  if (!menderClient) {
    return res.status(503).json({ 
      error: 'Mender no disponible',
      message: 'Mender no está configurado o no está disponible'
    });
  }

  const { deviceId } = req.params;
  if (!deviceId) {
    return res.status(400).json({ 
      error: 'ID de dispositivo requerido',
      message: 'Debe proporcionar un ID de dispositivo'
    });
  }

  try {
    const deviceStatus = await menderClient.checkDeviceStatus(deviceId);
    res.json(deviceStatus);
  } catch (error) {
    console.error(`Error verificando dispositivo ${deviceId}:`, error);
    res.status(500).json({ 
      error: 'Error verificando dispositivo',
      message: `No se pudo verificar el estado del dispositivo ${deviceId}`
    });
  }
});

app.get('/api/mender/health', requireAuth, async (_req, res) => {
  const menderClient = getMenderClient();
  if (!menderClient) {
    return res.status(503).json({ 
      enabled: false,
      healthy: false,
      message: 'Mender no está configurado'
    });
  }

  try {
    const healthy = await menderClient.checkServerHealth();
    res.json({
      enabled: true,
      healthy,
      serverUrl: config.mender.serverUrl,
    });
  } catch (error) {
    console.error('Error verificando salud de Mender:', error);
    res.status(500).json({
      enabled: true,
      healthy: false,
      error: 'Error verificando servidor Mender',
    });
  }
});

// Endpoint para obtener dispositivos no saludables
app.get('/api/mender/unhealthy-devices', requireAuth, async (_req, res) => {
  const menderClient = getMenderClient();
  if (!menderClient) {
    return res.status(503).json({ 
      error: 'Mender no disponible',
      message: 'Mender no está configurado o no está disponible'
    });
  }

  try {
    const devices = await menderClient.listDevices();
    
    if (!devices || devices.length === 0) {
      return res.json({ unhealthyDevices: [] });
    }

    // Verificar el estado de cada dispositivo
    const deviceStatuses = await Promise.all(
      devices.map(device => menderClient.checkDeviceStatus(device.id))
    );

    // Filtrar dispositivos no saludables
    const unhealthyDevices = deviceStatuses.filter(status => !status.healthy);
    
    res.json({ unhealthyDevices });
  } catch (error) {
    console.error('Error obteniendo dispositivos no saludables:', error);
    res.status(500).json({ 
      error: 'Error obteniendo dispositivos no saludables',
      message: 'No se pudieron obtener los dispositivos de Mender'
    });
  }
});

// IMPORTANTE: Definir rutas protegidas ANTES de express.static para que los middlewares se ejecuten
app.get('/protected.html', requireAuth, requireHealthyDevices, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'protected.html'));
});

app.get('/dashboard.html', requireAuth, requireHealthyDevices, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
});

app.get('/devices.html', requireAuth, requireHealthyDevices, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'devices.html'));
});

app.get('/profile.html', requireAuth, requireHealthyDevices, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'profile.html'));
});

app.get('/settings.html', requireAuth, requireHealthyDevices, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'settings.html'));
});

// Servir archivos estáticos (CSS, JS, imágenes, etc.) DESPUÉS de las rutas protegidas
app.use(express.static(path.join(process.cwd(), 'public')));

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
  console.log(`Taller 2 Ciber escuchando en ${config.port}`);
});

