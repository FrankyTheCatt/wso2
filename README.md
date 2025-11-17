# Mini-App WSO2 OAuth2/OIDC

Implementación de referencia (Node.js + TypeScript + Express) que demuestra cómo integrar autenticación OAuth2/OIDC con WSO2 Identity Server.

## Características

- ✅ Autenticación OAuth2/OIDC con WSO2 Identity Server
- ✅ Intercambio seguro de authorization code por tokens
- ✅ Validación de ID Token usando JWKS
- ✅ Gestión de sesiones locales con cookies firmadas
- ✅ Logout front-channel con WSO2
- ✅ Endpoints protegidos con middleware de autenticación

## Requisitos

- Node.js >= 18
- Acceso al portal Carbon de WSO2 Identity Server
- Credenciales de Service Provider configuradas en WSO2

## Configuración en WSO2

### 1. Crear Service Provider

1. Accede al portal Carbon: `https://<tu-ip>:9443/carbon`
2. Ve a **Service Providers** → **Add**
3. Define un nombre para tu aplicación (ej: `mini-app-wso2`)

### 2. Configurar OAuth2/OIDC

1. Dentro de la aplicación, ve a **Inbound Authentication Configuration** → **OAuth/OpenID Connect Configuration**
2. En el campo **Callback URL**, configura las URLs de callback:

   **Opción A: URLs separadas por salto de línea:**
   ```
   http://<tu-ip>:3000/callback
   http://<tu-ip>:3000/logout/callback
   ```

   **Opción B: Usar expresión regular (recomendado):**
   ```
   regexp=(http://<tu-ip>:3000/(callback|logout/callback))
   ```
   
   O si quieres permitir cualquier puerto:
   ```
   regexp=(http://<tu-ip>:\d+/(callback|logout/callback))
   ```

   **Nota:** Reemplaza `<tu-ip>` con la IP real donde correrá tu aplicación.

3. Configura los **Scopes**: `openid profile email`
4. Guarda y copia el **Client ID** y **Client Secret**

### 3. Configuración OAuth

- **OAuth Version**: 2.0
- **Allowed Grant Types**: Marca **Code** (y **Refresh Token** si lo necesitas)
- **PKCE Mandatory**: Opcional (déjalo desmarcado si no lo usas)
- **Access Token Binding Type**: NONE

## Configuración Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia `env.sample` a `.env` y completa los valores:

```bash
cp env.sample .env
```

Edita `.env` con tus valores:

```env
WSO2_BASE_URL=https://<tu-ip-wso2>:9443
WSO2_TENANT_DOMAIN=carbon.super
WSO2_CLIENT_ID=tu_client_id_aqui
WSO2_CLIENT_SECRET=tu_client_secret_aqui
APP_BASE_URL=http://<tu-ip>:3000
SESSION_SECRET=genera-una-cadena-larga-y-aleatoria-aqui
SESSION_TTL_MS=3600000
ALLOW_INSECURE_TLS=true
CLOCK_TOLERANCE_SECONDS=300
```

**Explicación de variables:**

- `WSO2_BASE_URL`: URL base de tu servidor WSO2 (ej: `https://172.31.125.215:9443`)
- `WSO2_TENANT_DOMAIN`: Dominio del tenant (por defecto `carbon.super`)
- `WSO2_CLIENT_ID` / `WSO2_CLIENT_SECRET`: Credenciales del Service Provider
- `APP_BASE_URL`: URL donde correrá tu aplicación (debe coincidir con las Callback URLs en WSO2)
- `SESSION_SECRET`: Cadena aleatoria para firmar cookies (genera una con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `ALLOW_INSECURE_TLS`: `true` solo para desarrollo con certificados autofirmados
- `CLOCK_TOLERANCE_SECONDS`: Margen para tolerar desfases horarios (ajusta según tu entorno)

### 3. Ejecutar la aplicación

**Modo desarrollo:**
```bash
npm run dev
```

**Modo producción:**
```bash
npm run build
npm start
```

La aplicación estará disponible en `http://<tu-ip>:3000`

## Endpoints

### Públicos (sin autenticación)

- `GET /` - Página principal con botón de login
- `GET /login` - Inicia el flujo OIDC, redirige a WSO2
- `GET /callback` - Recibe el authorization code de WSO2
- `GET /logout` - Inicia el logout front-channel con WSO2
- `GET /logout/callback` - Callback después del logout de WSO2
- `GET /health` - Health check endpoint

### Protegidos (requieren autenticación)

- `GET /me` - Obtiene información del usuario autenticado
- `GET /protected.html` - Página protegida de ejemplo
- `GET /auth-check` - Verifica si hay una sesión válida (devuelve 200 o 401)

## Flujo de Autenticación

1. **Usuario accede a `/login`**
   - La aplicación genera `state` y `nonce` aleatorios
   - Guarda estos valores en una cookie firmada (`oidc_flow`)
   - Redirige al usuario a WSO2 con los parámetros OAuth2

2. **Usuario se autentica en WSO2**
   - WSO2 valida las credenciales
   - Redirige de vuelta a `/callback` con un `code` de autorización

3. **Aplicación procesa el callback (`/callback`)**
   - Valida el `state` contra la cookie guardada
   - Intercambia el `code` por tokens en `/oauth2/token` de WSO2
   - Valida el `id_token` usando JWKS remoto
   - Extrae información del usuario del `id_token`
   - Crea una sesión local y guarda el ID en cookie firmada (`miniapp_session`)
   - Redirige al usuario a `/protected.html`

4. **Sesión activa**
   - Las cookies `miniapp_session` se envían automáticamente en cada request
   - El middleware `requireAuth` verifica la sesión antes de permitir acceso a rutas protegidas

5. **Logout**
   - Usuario accede a `/logout`
   - La aplicación destruye la sesión local
   - Redirige a WSO2 `/oidc/logout` con `id_token_hint`
   - WSO2 cierra la sesión SSO
   - WSO2 redirige de vuelta a `/logout/callback`
   - La aplicación redirige al usuario a `/`

## Estructura del Proyecto

```
.
├── src/
│   ├── config.ts          # Configuración y variables de entorno
│   ├── oidcClient.ts      # Cliente OIDC (buildAuthorizeUrl, exchangeCodeForTokens, verifyIdToken)
│   ├── server.ts          # Servidor Express con todos los endpoints
│   └── sessionStore.ts   # Almacenamiento de sesiones en memoria
├── public/
│   ├── index.html         # Página principal
│   └── protected.html      # Página protegida de ejemplo
├── .env                   # Variables de entorno (no versionar)
├── env.sample             # Plantilla de variables de entorno
├── package.json
└── tsconfig.json
```

## Solución de Problemas

### Error: "self-signed certificate"

**Problema:** WSO2 usa certificados SSL autofirmados.

**Solución:** Configura `ALLOW_INSECURE_TLS=true` en `.env` (solo para desarrollo).

### Error: "nbf claim timestamp check failed"

**Problema:** Desfase horario entre tu servidor y WSO2.

**Solución:** Aumenta `CLOCK_TOLERANCE_SECONDS` en `.env` (por defecto 300 segundos).

### Error: "unexpected iss claim value"

**Problema:** El issuer del ID Token no coincide.

**Solución:** El código ahora extrae automáticamente el issuer del token. Si persiste, verifica que `WSO2_BASE_URL` sea correcto.

### Error: "Registered callback does not match"

**Problema:** La Callback URL en WSO2 no coincide exactamente con `APP_BASE_URL/callback`.

**Solución:** Asegúrate de que:
- `APP_BASE_URL` en `.env` coincida exactamente con la URL registrada en WSO2
- No haya diferencias en protocolo (http vs https)
- No haya diferencias en puerto
- No haya trailing slashes

### La sesión no persiste

**Problema:** Las cookies no se están guardando.

**Solución:**
- Verifica que `SESSION_SECRET` esté configurado
- En desarrollo, asegúrate de usar `http://` (no `https://`) si no tienes SSL
- Verifica que el navegador permita cookies

## Próximos Pasos

- Persistir sesiones en Redis o base de datos en lugar de memoria
- Implementar refresh token para renovar sesiones sin re-login
- Agregar más endpoints protegidos según tus necesidades
- Configurar HTTPS para producción
- Agregar logging y monitoreo

## Licencia

ISC
