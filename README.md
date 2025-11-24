# Taller 2 Ciber - WSO2 OAuth2/OIDC con Control de Acceso Basado en Salud de Dispositivos

Aplicación web completa que integra autenticación OAuth2/OIDC con WSO2 Identity Server y control de acceso basado en el estado de salud de dispositivos IoT gestionados por Mender.io.

## ¿Qué hace esta aplicación?

Esta aplicación implementa un sistema de control de acceso de dos niveles:

1. **Autenticación con WSO2**: Los usuarios deben autenticarse primero con WSO2 Identity Server usando OAuth2/OIDC antes de acceder a cualquier recurso protegido.

2. **Verificación de Salud de Dispositivos**: Una vez autenticado, antes de permitir el acceso a las páginas protegidas, la aplicación verifica automáticamente el estado de salud de todos los dispositivos IoT registrados en Mender.io. Solo si todos los dispositivos están saludables (aceptados y actualizados recientemente), se permite el acceso al Dashboard y otras páginas protegidas.

3. **Bloqueo de Acceso**: Si algún dispositivo no está saludable (rechazado, pendiente, o sin actualizar), la aplicación bloquea el acceso y muestra una página de error con detalles de los dispositivos rechazados en un formato de menú contraíble.

## Características Principales

### Autenticación y Seguridad
- ✅ Autenticación OAuth2/OIDC con WSO2 Identity Server
- ✅ Intercambio seguro de authorization code por tokens
- ✅ Validación de ID Token usando JWKS (JSON Web Key Set)
- ✅ Gestión de sesiones locales con cookies firmadas y seguras
- ✅ Logout front-channel con WSO2 para cerrar sesión SSO
- ✅ Endpoints protegidos con middleware de autenticación
- ✅ Redirección automática cuando se accede sin sesión activa

### Control de Acceso Basado en Salud de Dispositivos
- ✅ Verificación automática del estado de salud de dispositivos antes de permitir acceso
- ✅ Bloqueo de acceso cuando hay dispositivos no saludables
- ✅ Página de error informativa con detalles de dispositivos rechazados
- ✅ Menú contraíble (acordeón) para visualizar detalles de cada dispositivo
- ✅ Actualización en tiempo real del estado de dispositivos

### Integración con Mender.io
- ✅ Conexión con Mender.io online (hosted.mender.io)
- ✅ Visualización de dispositivos gestionados
- ✅ Verificación del estado de salud de cada dispositivo
- ✅ Información detallada de dispositivos (atributos, estado, última actualización)
- ✅ Diagnóstico de problemas (razones de no saludable)
- ✅ Múltiples páginas protegidas con navegación integrada

## Requisitos

- Node.js >= 18
- Nginx (como proxy reverso)
- Acceso al portal Carbon de WSO2 Identity Server
- Credenciales de Service Provider configuradas en WSO2

## Configuración en WSO2

### 1. Crear Service Provider

1. Accede al portal Carbon: `https://<tu-ip>:9443/carbon`
2. Ve a **Service Providers** → **Add**
3. Define un nombre para tu aplicación (ej: `taller-2-ciber-wso2`)

### 2. Configurar OAuth2/OIDC

1. Dentro de la aplicación, ve a **Inbound Authentication Configuration** → **OAuth/OpenID Connect Configuration**
2. En el campo **Callback URL**, configura las URLs de callback:

   Configura las URLs de callback:
   ```
   http://<tu-ip>/callback
   http://<tu-ip>/logout/callback
   ```
   
   O usando HTTPS:
   ```
   https://<tu-ip>/callback
   https://<tu-ip>/logout/callback
   ```

   **Nota:** Reemplaza `<tu-ip>` con la IP real o dominio donde correrá tu aplicación. Las URLs deben apuntar al puerto 80 (HTTP) o 443 (HTTPS) a través de Nginx.

3. Configura los **Scopes**: `openid profile email`
4. Guarda y copia el **Client ID** y **Client Secret**

### 3. Configuración OAuth

- **OAuth Version**: 2.0
- **Allowed Grant Types**: Marca **Code** (y **Refresh Token** si lo necesitas)
- **PKCE Mandatory**: Opcional (déjalo desmarcado si no lo usas)
- **Access Token Binding Type**: NONE

## Despliegue Rápido con Docker (Recomendado)

Esta es la forma más sencilla de ejecutar la aplicación, ya que configura automáticamente la aplicación Node.js y Nginx como proxy reverso en contenedores aislados.

### Prerrequisitos
- Docker y Docker Compose instalados

### Pasos

1. **Configurar variables de entorno**
   Copia `env.sample` a `.env` y ajusta los valores (ver sección de Configuración de WSO2 más abajo):
   ```bash
   cp env.sample .env
   ```

2. **Ejecutar con Docker Compose**
   ```bash
   docker-compose up -d --build
   ```

   Esto iniciará:
   - Contenedor de la aplicación (interno en puerto 3000)
   - Contenedor Nginx (expuesto en puerto 80)

3. **Acceder**
   La aplicación estará disponible en `http://localhost` (o tu IP).

## Instalación y Configuración Manual

### 1. Instalar dependencias de Node.js

```bash
npm install
```

### 2. Instalar y configurar Nginx

#### 2.1. Instalar Nginx

**En Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx
```

**En CentOS/RHEL:**
```bash
sudo yum install nginx
# o en versiones más recientes:
sudo dnf install nginx
```

**Verificar instalación:**
```bash
nginx -v
sudo systemctl status nginx
```

#### 2.2. Configurar Nginx como Proxy Reverso

Crea un archivo de configuración para la aplicación:

```bash
sudo nano /etc/nginx/sites-available/taller-2-ciber
```

**Nota:** En CentOS/RHEL, usa `/etc/nginx/conf.d/taller-2-ciber.conf` en lugar de `sites-available`.

Agrega la siguiente configuración:

```nginx
server {
    listen 80;
    server_name <tu-ip-o-dominio>;

    # Redirigir todo el tráfico HTTP a HTTPS (opcional, recomendado para producción)
    # return 301 https://$server_name$request_uri;

    # Si no usas HTTPS, descomenta las siguientes líneas y comenta la línea de redirección:
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Headers importantes para el funcionamiento correcto
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support (si es necesario en el futuro)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Configuración HTTPS (opcional pero recomendado para producción)
# server {
#     listen 443 ssl http2;
#     server_name <tu-ip-o-dominio>;
#
#     # Certificados SSL
#     ssl_certificate /etc/ssl/certs/taller-2-ciber.crt;
#     ssl_certificate_key /etc/ssl/private/taller-2-ciber.key;
#
#     # Configuración SSL moderna
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_http_version 1.1;
#         
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_set_header X-Forwarded-Host $host;
#         proxy_set_header X-Forwarded-Port $server_port;
#         
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         
#         proxy_connect_timeout 60s;
#         proxy_send_timeout 60s;
#         proxy_read_timeout 60s;
#     }
# }
```

**Reemplaza `<tu-ip-o-dominio>`** con tu IP pública o dominio.

#### 2.3. Habilitar la configuración

**En Ubuntu/Debian:**
```bash
sudo ln -s /etc/nginx/sites-available/taller-2-ciber /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar que la configuración sea válida
sudo systemctl reload nginx
```

**En CentOS/RHEL:**
```bash
sudo nginx -t  # Verificar que la configuración sea válida
sudo systemctl reload nginx
```

#### 2.4. Configurar firewall (si es necesario)

```bash
# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS (si lo usas)
sudo ufw allow 443/tcp

# Verificar estado
sudo ufw status
```

**Nota:** En CentOS/RHEL, usa `firewall-cmd`:
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 3. Configurar variables de entorno

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

# URL pública a través de Nginx (sin puerto 3000)
APP_BASE_URL=http://<tu-ip>
# O con HTTPS:
# APP_BASE_URL=https://<tu-ip>

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
- `APP_BASE_URL`: URL pública a través de Nginx sin puerto (ej: `http://192.168.1.100` o `https://taller2ciber.example.com`)
  - **IMPORTANTE**: Debe coincidir exactamente con las Callback URLs configuradas en WSO2
  - No incluyas el puerto 3000, ya que Nginx actúa como proxy reverso
- `SESSION_SECRET`: Cadena aleatoria para firmar cookies (genera una con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `ALLOW_INSECURE_TLS`: `true` solo para desarrollo con certificados autofirmados
- `CLOCK_TOLERANCE_SECONDS`: Margen para tolerar desfases horarios (ajusta según tu entorno)
- `MENDER_SERVER_URL`: URL del servidor Mender.io (opcional, solo si usas Mender)
- `MENDER_API_TOKEN`: Token de API de Mender.io (opcional, solo si usas Mender)

### 4. Ejecutar la aplicación

1. Compilar la aplicación:
```bash
npm run build
```

2. Ejecutar la aplicación:
```bash
npm start
```

3. La aplicación Node.js correrá en `http://localhost:3000` (solo accesible localmente)

4. Nginx actuará como proxy reverso y la aplicación será accesible públicamente en:
   - `http://<tu-ip>` (puerto 80)
   - O `https://<tu-ip>` (puerto 443) si configuraste SSL

#### 4.1. Configurar la aplicación como servicio (opcional pero recomendado)

Crea un archivo de servicio systemd para que la aplicación se inicie automáticamente:

```bash
sudo nano /etc/systemd/system/taller-2-ciber.service
```

Agrega el siguiente contenido:

```ini
[Unit]
Description=Taller 2 Ciber - WSO2 OAuth2/OIDC Application
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/tu/proyecto/wso2-master
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Reemplaza:**
- `tu_usuario`: Tu usuario del sistema
- `/ruta/a/tu/proyecto/wso2-master`: Ruta completa a tu proyecto

**Habilitar y iniciar el servicio:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable taller-2-ciber
sudo systemctl start taller-2-ciber
sudo systemctl status taller-2-ciber
```

**Comandos útiles:**
```bash
# Ver logs
sudo journalctl -u taller-2-ciber -f

# Reiniciar servicio
sudo systemctl restart taller-2-ciber

# Detener servicio
sudo systemctl stop taller-2-ciber
```

### 5. Verificar la instalación

1. **Verificar que Node.js esté corriendo:**
```bash
curl http://localhost:3000/health
# Debe devolver: {"status":"ok"}
```

2. **Verificar que Nginx esté funcionando:**
```bash
curl http://<tu-ip>/health
# Debe devolver: {"status":"ok"}
```

3. **Acceder a la aplicación:**
   - Abre tu navegador y ve a `http://<tu-ip>`
   - Deberías ver la página de inicio con el botón "Iniciar Sesión"

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

## Flujo de Autenticación y Control de Acceso

### 1. Autenticación Inicial

1. **Usuario accede a `/login`**
   - La aplicación genera `state` y `nonce` aleatorios para seguridad
   - Guarda estos valores en una cookie firmada (`oidc_flow`)
   - Redirige al usuario a WSO2 con los parámetros OAuth2

2. **Usuario se autentica en WSO2**
   - WSO2 valida las credenciales del usuario
   - Redirige de vuelta a `/callback` con un `code` de autorización

3. **Aplicación procesa el callback (`/callback`)**
   - Valida el `state` contra la cookie guardada para prevenir ataques CSRF
   - Intercambia el `code` por tokens en `/oauth2/token` de WSO2
   - Valida el `id_token` usando JWKS remoto para verificar la firma
   - Extrae información del usuario del `id_token` (sub, email, name)
   - Crea una sesión local y guarda el ID en cookie firmada (`taller2ciber_session`)
   - Redirige al usuario a `/protected.html`

### 2. Verificación de Salud de Dispositivos

4. **Acceso a páginas protegidas**
   - Cuando el usuario intenta acceder a cualquier página protegida (`/protected.html`, `/dashboard.html`, `/devices.html`, etc.)
   - El middleware `requireAuth` verifica primero que haya una sesión válida
   - Luego, el middleware `requireHealthyDevices` ejecuta automáticamente:
     - Obtiene todos los dispositivos registrados en Mender.io
     - Verifica el estado de salud de cada dispositivo:
       - Estado debe ser `accepted` (aceptado)
       - Última actualización debe ser hace menos de 24 horas
     - Si **todos** los dispositivos están saludables → permite el acceso
     - Si **algún** dispositivo no está saludable → bloquea el acceso y muestra página de error

5. **Página de Error por Dispositivos Rechazados**
   - Muestra el mensaje "Dispositivo Rechazado"
   - Lista todos los dispositivos no saludables en un menú contraíble
   - Cada dispositivo muestra:
     - ID del dispositivo
     - Estado actual (pending, rejected, etc.)
     - Última actualización y tiempo transcurrido
     - Razón específica por la que no está saludable
     - Atributos completos del dispositivo
   - Botón para actualizar el estado y verificar nuevamente
   - Botón para volver al inicio

### 3. Sesión Activa y Logout

6. **Sesión activa**
   - Las cookies `taller2ciber_session` se envían automáticamente en cada request
   - El middleware `requireAuth` verifica la sesión antes de permitir acceso
   - El middleware `requireHealthyDevices` verifica la salud de dispositivos en cada acceso

7. **Logout**
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
│   ├── index.html              # Página principal con botón de login
│   ├── protected.html          # Página protegida principal
│   ├── dashboard.html          # Dashboard del sistema
│   ├── devices.html            # Gestión de dispositivos Mender
│   ├── profile.html            # Perfil de usuario
│   ├── settings.html           # Configuración del sistema
│   ├── device-unhealthy.html   # Página de error cuando hay dispositivos rechazados
│   └── common.css              # Estilos comunes para páginas protegidas
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
- Asegúrate de que los headers `X-Forwarded-Proto` y `X-Forwarded-Host` estén configurados correctamente en Nginx

### Problemas con Nginx

#### Error 502 Bad Gateway

**Problema:** Nginx no puede conectarse a la aplicación Node.js.

**Solución:**
- Verifica que la aplicación Node.js esté corriendo: `curl http://localhost:3000/health`
- Verifica que el puerto en la configuración de Nginx sea correcto (debe ser `proxy_pass http://localhost:3000;`)
- Revisa los logs de Nginx: `sudo tail -f /var/log/nginx/error.log`
- Verifica que el firewall no esté bloqueando conexiones locales

#### Las cookies no funcionan con Nginx

**Problema:** Las cookies de sesión no se guardan cuando se accede a través de Nginx.

**Solución:**
- Asegúrate de que `APP_BASE_URL` en `.env` coincida con la URL pública a través de Nginx (sin puerto 3000)
- Verifica que los headers `X-Forwarded-Proto` y `X-Forwarded-Host` estén configurados en Nginx
- Si usas HTTPS, asegúrate de que `X-Forwarded-Proto` sea `https`

#### Nginx redirige a localhost:3000

**Problema:** Al acceder a la aplicación, el navegador redirige a `localhost:3000`.

**Solución:**
- Verifica que `APP_BASE_URL` en `.env` use la URL pública (no `localhost`)
- Asegúrate de que los headers `X-Forwarded-Host` y `X-Forwarded-Proto` estén configurados en Nginx
- Reinicia la aplicación Node.js después de cambiar `APP_BASE_URL`

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
4. Asigna un nombre descriptivo (ej: "Taller 2 Ciber Integration")
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
  
- `GET /api/mender/unhealthy-devices` - Lista de dispositivos no saludables
  - Devuelve: `{ unhealthyDevices: MenderDeviceStatus[] }`
  - Usado por la página de error para mostrar dispositivos rechazados

### Control de Acceso Basado en Salud de Dispositivos

La aplicación implementa un sistema de control de acceso de dos niveles que garantiza que solo usuarios autenticados con dispositivos saludables puedan acceder a las páginas protegidas.

#### Criterios de Salud de Dispositivos

Un dispositivo se considera **saludable** cuando cumple **ambas** condiciones:
- ✅ Estado es `accepted` (aceptado en Mender)
- ✅ Última actualización fue hace menos de 24 horas

Si un dispositivo no cumple alguno de estos criterios, se marca como **no saludable** y se bloquea el acceso.

#### Proceso de Verificación

1. **Usuario autenticado intenta acceder a página protegida**
   - El middleware `requireAuth` verifica la sesión
   - Si no hay sesión → redirige a página principal con error

2. **Verificación de salud de dispositivos**
   - El middleware `requireHealthyDevices` se ejecuta automáticamente
   - Obtiene todos los dispositivos de Mender.io
   - Verifica el estado de cada dispositivo:
     - Si no hay dispositivos → permite acceso
     - Si todos están saludables → permite acceso
     - Si alguno no está saludable → bloquea acceso

3. **Bloqueo de acceso**
   - Muestra la página `device-unhealthy.html`
   - Título: "Dispositivo Rechazado"
   - Lista de dispositivos no saludables en formato de acordeón
   - Cada dispositivo se puede expandir para ver detalles completos

#### Página de Error: Dispositivo Rechazado

Cuando hay dispositivos no saludables, se muestra una página especial que incluye:

- **Mensaje claro**: "Dispositivo Rechazado" con explicación
- **Menú contraíble**: Cada dispositivo aparece en un acordeón que se puede expandir/contraer
- **Información detallada** (al expandir):
  - ID del dispositivo
  - Estado actual (pending, rejected, etc.)
  - Fecha y hora de última actualización
  - Tiempo transcurrido desde la última actualización
  - Fecha de creación
  - Razón específica por la que no está saludable
  - Todos los atributos del dispositivo
- **Acciones disponibles**:
  - Botón "Actualizar Estado" para verificar nuevamente
  - Botón "Volver al Inicio" para regresar

#### Comportamiento del Sistema

- **Si Mender no está configurado**: El sistema permite el acceso normalmente (Mender es opcional)
- **Si hay error al verificar dispositivos**: Por seguridad, bloquea el acceso y muestra la página de error
- **Solo para páginas HTML**: La verificación se aplica solo a páginas protegidas, no a endpoints API

### Páginas Relacionadas con Mender

- **`/protected.html`** - Página principal protegida que muestra información básica de Mender y dispositivos
- **`/dashboard.html`** - Dashboard con resumen del sistema y dispositivos
- **`/devices.html`** - Página completa de gestión de dispositivos con información detallada
- **`/profile.html`** - Perfil del usuario autenticado
- **`/settings.html`** - Configuración del sistema y estado de servicios (WSO2, Mender)
- **`/device-unhealthy.html`** - Página de error que se muestra cuando hay dispositivos rechazados (acceso bloqueado)

**Nota importante**: Todas estas páginas requieren:
1. Autenticación válida con WSO2
2. Que todos los dispositivos estén saludables

Si alguna condición no se cumple, el acceso será bloqueado automáticamente.

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

#### El acceso está bloqueado aunque estoy autenticado

**Problema**: Hay dispositivos no saludables que están bloqueando el acceso.

**Solución**:
- Revisa la página de error que se muestra ("Dispositivo Rechazado")
- Expande cada dispositivo en el menú contraíble para ver los detalles
- Verifica la razón específica por la que cada dispositivo no está saludable
- Corrige los problemas en Mender.io:
  - Acepta dispositivos que estén en estado "pending"
  - Asegúrate de que los dispositivos se actualicen regularmente (menos de 24 horas)
- Usa el botón "Actualizar Estado" para verificar nuevamente después de corregir los problemas

