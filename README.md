## Mini-App WSO2 + Nginx

Implementación de referencia (Node.js + TypeScript + Express) que demuestra cómo:

- Registrar un Service Provider en WSO2 (Carbon) para usar OAuth2/OIDC.
- Intercambiar el authorization code en backend, validar el ID Token y crear una sesión local.
- Exponer endpoints `/callback`, `/auth-check`, `/me` y recursos estáticos.
- Integrar Nginx como reverse proxy que protege `/recurso-protegido` usando `auth_request`.

### 1. Requisitos

- Node.js >= 18 (o Docker si usas contenedores)
- Acceso al portal Carbon de WSO2.
- Nginx compilado con `ngx_http_auth_request_module` (o usar Docker).

### 1.1. Opción A: Nginx en Docker (Recomendado)

Puedes ejecutar solo Nginx en Docker mientras la mini-app corre directamente en tu máquina:

1. **Inicia la mini-app primero** (en una terminal):
   ```bash
   npm install
   npm run dev
   ```
   La mini-app debe estar corriendo en `http://localhost:3000`

2. **Configura el archivo `.env`** (copia `env.sample` y completa los valores)

3. **Construye y levanta Nginx en Docker:**
   ```bash
   docker-compose up -d
   ```
   O usa el script: `.\docker-start.ps1` (Windows) o `./docker-start.sh` (Linux/Mac)

4. **Verifica que todo está funcionando:**
   ```bash
   docker-compose ps
   docker-compose logs -f nginx
   ```

La aplicación estará disponible en:
- `http://localhost` → Nginx (Docker) → Mini-app (host:3000)
- `http://localhost:3000` → Mini-app directamente

**Nota:** Solo Nginx corre en Docker. La mini-app debe estar corriendo fuera de Docker en el puerto 3000.

**Ver `DOCKER.md` para instrucciones detalladas y solución de problemas.**

### 1.2. Opción B: Instalación Manual

Si prefieres ejecutar sin Docker:

- Instala Node.js >= 18
- Instala Nginx con `ngx_http_auth_request_module`
- Sigue las instrucciones de las secciones 3 y 5

### 2. Configuración en WSO2

1. Entra a `https://<tu-ip>:9443/carbon`.
2. `Service Providers` → `Add`.
3. Define un nombre (ej. `mini-app-nginx`).
4. Dentro de la app ve a `Inbound Authentication Configuration` → `OAuth/OpenID Connect Configuration`.
5. En el campo **Callback URL**, tienes dos opciones:

   **Opción A: URLs separadas por salto de línea** (más simple):
   ```
   http://172.31.112.1:3000/callback
   http://172.31.112.1:3000/logout/callback
   ```

   **Opción B: Usar expresión regular** (más flexible, como el ejemplo por defecto de WSO2):
   ```
   regexp=(http://172.31.112.1:3000/(callback|logout/callback))
   ```
   
   O si quieres permitir cualquier puerto en esa IP:
   ```
   regexp=(http://172.31.112.1:\d+/(callback|logout/callback))
   ```

   **Nota:** Reemplaza `172.31.112.1` con la IP real de tu mini-app.

6. Configura los Scopes: `openid profile email`
7. Guarda y copia el `Client ID` y `Client Secret`.

### 3. Configuración local

1. Duplica `env.sample` → `.env` y rellena tus valores:
   - `WSO2_BASE_URL=https://<tu-ip>:9443`
   - `WSO2_CLIENT_ID` / `WSO2_CLIENT_SECRET`
   - `APP_BASE_URL=http://<ip-de-tu-app>:3000`
   - `SESSION_SECRET`: cadena larga aleatoria (se usa para firmar cookies).
   - `ALLOW_INSECURE_TLS=true`: solo en entornos de prueba con certificados autofirmados. En producción debe ser `false` o eliminarse.
   - `CLOCK_TOLERANCE_SECONDS=300`: margen para tolerar desfases horario entre tu servidor y WSO2 (ajusta según tu entorno).
2. Instala dependencias:

   ```bash
   npm install
   ```

3. Levanta en modo desarrollo:

   ```bash
   npm run dev
   ```

   o construye + ejecuta:

   ```bash
   npm run build
   npm start
   ```

### 4. Endpoints relevantes

- `GET /login`: redirige al endpoint de autorización de WSO2 con `state` y `nonce`.
- `GET /callback`: recibe el `code`, lo intercambia en `/oauth2/token`, valida el `id_token` contra JWKS y crea la cookie `miniapp_session`.
- `GET /auth-check`: responde `200` si la cookie de sesión es válida; caso contrario `401`.
- `GET /me`: ejemplo de recurso protegido por Express.
- `GET /logout`: destruye la sesión local, invoca `https://<WSO2>/oidc/logout` con `id_token_hint` y redirige al usuario hacia `/logout/callback`.
- `GET /logout/callback`: verifica el `state` y regresa al usuario a `/` tras el logout de WSO2.

### 5. Integración con Nginx

Nginx actúa como **reverse proxy** y **guardián de autenticación** usando el módulo `ngx_http_auth_request_module`.

#### 5.1. Verificar que Nginx tiene el módulo requerido

```bash
nginx -V 2>&1 | grep -o with-http_auth_request_module
```

Si no aparece, necesitarás recompilar Nginx con `--with-http_auth_request_module` o instalar una versión que lo incluya.

#### 5.2. Configurar Nginx

1. **Copia el archivo de ejemplo:**
   ```bash
   cp nginx.conf.example /etc/nginx/sites-available/mini-app
   ```

2. **Edita la configuración** (`/etc/nginx/sites-available/mini-app`):
   - Cambia `server_name tu-dominio.com 172.31.112.1;` por tu dominio/IP real
   - Ajusta `upstream mini_app` si tu app corre en otro puerto
   - Personaliza las rutas protegidas según tus necesidades

3. **Habilita el sitio:**
   ```bash
   ln -s /etc/nginx/sites-available/mini-app /etc/nginx/sites-enabled/
   ```

4. **Verifica la configuración:**
   ```bash
   nginx -t
   ```

5. **Recarga Nginx:**
   ```bash
   systemctl reload nginx
   # O si usas otro método:
   sudo nginx -s reload
   ```

#### 5.3. Cómo funciona

1. **Usuario solicita `/recurso-protegido`**
2. **Nginx ejecuta sub-petición interna** a `/auth-check` (endpoint interno, no accesible desde fuera)
3. **La mini-app verifica la cookie de sesión:**
   - Si existe y es válida → devuelve `200 OK`
   - Si no existe o es inválida → devuelve `401 Unauthorized`
4. **Nginx decide:**
   - Si `200` → permite el acceso y pasa la petición al backend
   - Si `401` → redirige al usuario a `/login` (inicia flujo OIDC)

#### 5.4. Ejemplos de configuración

**Proteger una ruta específica:**
```nginx
location /recurso-protegido/ {
    auth_request /auth-check;
    error_page 401 = @login;
    proxy_pass http://mini_app;
}
```

**Proteger múltiples rutas con patrón:**
```nginx
location ~ ^/(api|admin|dashboard)/ {
    auth_request /auth-check;
    error_page 401 = @login;
    proxy_pass http://mini_app;
}
```

**Proteger todo excepto rutas públicas:**
```nginx
location / {
    auth_request /auth-check;
    error_page 401 = @login;
    proxy_pass http://mini_app;
}

# Rutas públicas (sin auth_request)
location ~ ^/(login|callback|logout|health|index\.html)$ {
    proxy_pass http://mini_app;
}
```

Ver el archivo `nginx.conf.example` para una configuración completa y comentada.

### 6. Flujo resumido

1. Usuario hace clic en “Entrar con WSO2”.
2. `/login` genera `state`/`nonce`, los guarda en una cookie firmada y redirige a WSO2.
3. Tras autenticarse, WSO2 redirige a `/callback?code=...&state=...`.
4. El backend:
   - Valida el `state`.
   - Intercambia el `code` en `/oauth2/token`.
   - Valida el `id_token` usando JWKS.
   - Crea sesión local (`miniapp_session`) y redirige a `/protected.html`.
5. `/auth-check` verifica la cookie en cada request protegida.

### 7. Próximos pasos

- Persistir sesiones en Redis/memcached en lugar de memoria.
- Usar HTTPS (requerido para `secure cookies` en producción).
- Añadir refresco de tokens con `refresh_token` si fuera necesario.

