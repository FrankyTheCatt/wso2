# Mini-App WSO2 OAuth2/OIDC

Implementación de referencia (Node.js + TypeScript + Express) que demuestra cómo integrar autenticación OAuth2/OIDC con WSO2 Identity Server.

## Características

- ✅ Autenticación OAuth2/OIDC con WSO2 Identity Server
- ✅ Intercambio seguro de authorization code por tokens
- ✅ Validación de ID Token usando JWKS
- ✅ Gestión de sesiones locales con cookies firmadas
- ✅ Logout front-channel con WSO2
- ✅ Endpoints protegidos con middleware de autenticación
- ✅ Integración con Mender.io para gestión de dispositivos IoT
- ✅ Múltiples páginas protegidas con navegación integrada
- ✅ Redirección automática cuando se accede sin sesión

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

# Mender Configuration (opcional)
MENDER_SERVER_URL=https://hosted.mender.io
MENDER_API_TOKEN=tu_token_de_api_mender_aqui
```

**Explicación de variables:**

- `WSO2_BASE_URL`: URL base de tu servidor WSO2 (ej: `https://172.31.125.215:9443`)
- `WSO2_TENANT_DOMAIN`: Dominio del tenant (por defecto `carbon.super`)
- `WSO2_CLIENT_ID` / `WSO2_CLIENT_SECRET`: Credenciales del Service Provider
- `APP_BASE_URL`: URL donde correrá tu aplicación (debe coincidir con las Callback URLs en WSO2)
- `SESSION_SECRET`: Cadena aleatoria para firmar cookies (genera una con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `ALLOW_INSECURE_TLS`: `true` solo para desarrollo con certificados autofirmados
- `CLOCK_TOLERANCE_SECONDS`: Margen para tolerar desfases horarios (ajusta según tu entorno)
- `MENDER_SERVER_URL`: URL del servidor Mender.io (opcional, solo si usas Mender)
- `MENDER_API_TOKEN`: Token de API de Mender.io (opcional, solo si usas Mender)

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
- `GET /protected.html` - Página principal protegida
- `GET /dashboard.html` - Dashboard con resumen del sistema
- `GET /devices.html` - Gestión de dispositivos Mender
- `GET /profile.html` - Perfil del usuario
- `GET /settings.html` - Configuración del sistema
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
│   ├── menderClient.ts    # Cliente Mender para gestión de dispositivos IoT
│   ├── server.ts          # Servidor Express con todos los endpoints
│   └── sessionStore.ts   # Almacenamiento de sesiones en memoria
├── public/
│   ├── index.html         # Página principal
│   ├── protected.html     # Página protegida principal
│   ├── dashboard.html     # Dashboard del sistema
│   ├── devices.html        # Gestión de dispositivos Mender
│   ├── profile.html       # Perfil de usuario
│   ├── settings.html      # Configuración del sistema
│   └── common.css          # Estilos comunes para páginas protegidas
├── .env                   # Variables de entorno (no versionar)
├── env.sample             # Plantilla de variables de entorno
├── MENDER_SETUP.md        # Guía detallada de configuración de Mender
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

## Integración con Mender.io

Esta aplicación incluye integración opcional con Mender.io para gestión de dispositivos IoT. Mender.io es una plataforma de gestión de actualizaciones OTA (Over-The-Air) que permite gestionar y actualizar dispositivos IoT de forma remota y segura.

### Características de la Integración

- ✅ Conexión con Mender.io online (hosted.mender.io)
- ✅ Visualización de dispositivos gestionados
- ✅ Verificación del estado de salud de cada dispositivo
- ✅ Información detallada de dispositivos (atributos, estado, última actualización)
- ✅ Diagnóstico de problemas (razones de no saludable)
- ✅ Página dedicada para gestión de dispositivos (`/devices.html`)

### Configuración de Mender.io Online

#### 1. Obtener Token de API

1. Inicia sesión en [https://hosted.mender.io](https://hosted.mender.io)
2. Ve a **Settings** → **API Tokens**
3. Haz clic en **Create API Token**
4. Asigna un nombre descriptivo (ej: "Mini-App Integration")
5. Selecciona los permisos necesarios:
   - `devices:read` - Para leer información de dispositivos (requerido)
   - `devices:write` - Si necesitas modificar dispositivos (opcional)
6. Haz clic en **Create**
7. **IMPORTANTE**: Copia el token inmediatamente, ya que solo se muestra una vez

#### 2. Configurar Variables de Entorno

Edita tu archivo `.env` y agrega:

```env
# Mender.io Online Configuration
MENDER_SERVER_URL=https://hosted.mender.io
MENDER_API_TOKEN=tu_token_aqui_pegado_del_paso_anterior
```

#### 3. Verificar la Integración

1. Reinicia la aplicación:
   ```bash
   npm run dev
   ```

2. Accede a cualquier página protegida después de autenticarte con WSO2:
   - `/protected.html` - Verás la sección de Mender con tus dispositivos
   - `/devices.html` - Página dedicada para gestión de dispositivos
   - `/dashboard.html` - Dashboard con resumen de dispositivos

3. Deberías ver:
   - ✅ Estado del servidor Mender (Operativo/No disponible)
   - 📱 Lista de tus dispositivos gestionados
   - 📊 Estado de salud de cada dispositivo
   - ⚠️ Razones de no saludable si aplica
   - 📋 Atributos detallados de cada dispositivo

### Endpoints de Mender (requieren autenticación WSO2)

- `GET /api/mender/health` - Estado del servidor Mender
  - Devuelve: `{ enabled: boolean, healthy: boolean, serverUrl: string }`
  
- `GET /api/mender/devices` - Lista todos los dispositivos
  - Devuelve: `{ devices: MenderDevice[] }`
  
- `GET /api/mender/devices/:deviceId` - Información detallada de un dispositivo
  - Devuelve: `{ deviceId, status, healthy, lastSeen, created, attributes, healthReason, timeSinceUpdateFormatted }`

### Criterios de Salud de Dispositivos

Un dispositivo se considera **saludable** cuando:
- ✅ Estado es `accepted` (aceptado en Mender)
- ✅ Última actualización fue hace menos de 24 horas

Si un dispositivo no cumple estos criterios, se muestra como **no saludable** con la razón específica.

### Páginas Relacionadas con Mender

- **`/protected.html`** - Muestra información básica de Mender y dispositivos
- **`/devices.html`** - Página completa de gestión de dispositivos con información detallada
- **`/dashboard.html`** - Dashboard con resumen de dispositivos
- **`/settings.html`** - Estado de configuración de Mender

### Solución de Problemas con Mender

#### Error: "Mender no está configurado"

**Problema**: Las variables de entorno no están configuradas.

**Solución**: 
- Verifica que `MENDER_SERVER_URL` y `MENDER_API_TOKEN` estén en tu archivo `.env`
- Reinicia la aplicación después de agregar las variables

#### Error: "401 Unauthorized" o "403 Forbidden"

**Problema**: El token de API no es válido o no tiene los permisos necesarios.

**Solución**:
- Verifica que el token esté correctamente copiado (sin espacios extra)
- Asegúrate de que el token tenga el permiso `devices:read`
- Genera un nuevo token si es necesario

#### Error: "404 Not Found" al obtener dispositivos

**Problema**: La ruta de la API puede estar incorrecta.

**Solución**: 
- Verifica que `MENDER_SERVER_URL` sea `https://hosted.mender.io` (sin trailing slash)
- La aplicación usa automáticamente la ruta `/api/management/v1/inventory/devices`

#### No se muestran dispositivos

**Problema**: No hay dispositivos registrados o no tienes permisos para verlos.

**Solución**:
- Verifica en el dashboard de Mender.io que tengas dispositivos registrados
- Asegúrate de que el token tenga permisos para leer dispositivos
- Verifica que los dispositivos estén en estado "accepted"

