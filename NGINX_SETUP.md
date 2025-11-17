# Guía de Configuración de Nginx para Windows

Esta guía te ayudará a configurar Nginx en Windows para proteger tus recursos usando la mini-app como autenticador.

## Requisitos Previos

1. **Nginx instalado en Windows**
   - Descarga desde: https://nginx.org/en/download.html
   - O usa Chocolatey: `choco install nginx`

2. **Verificar que Nginx tiene el módulo `auth_request`**
   ```powershell
   nginx.exe -V 2>&1 | Select-String "auth_request"
   ```
   
   Si no aparece, necesitarás compilar Nginx desde el código fuente con `--with-http_auth_request_module`.

## Pasos de Configuración

### 1. Ubicar el directorio de configuración de Nginx

Por defecto en Windows, Nginx se instala en:
- `C:\nginx\` (si lo descargaste manualmente)
- `C:\Program Files\nginx\` (si lo instalaste con Chocolatey)

El archivo principal de configuración suele estar en:
- `C:\nginx\conf\nginx.conf`
- `C:\Program Files\nginx\conf\nginx.conf`

### 2. Editar la configuración

1. **Abre `nginx.conf` con un editor de texto** (como Notepad++, VS Code, etc.)

2. **Busca el bloque `http {`** y dentro de él, agrega o modifica según necesites.

3. **Copia la configuración del archivo `nginx.conf.example`** y ajústala:

   - Cambia `server_name tu-dominio.com 172.31.112.1;` por tu IP o dominio
   - Ajusta `upstream mini_app` si tu app corre en otro puerto (por defecto `127.0.0.1:3000`)
   - Personaliza las rutas protegidas según tus necesidades

### 3. Ejemplo de configuración mínima

Agrega esto dentro del bloque `http {` en tu `nginx.conf`:

```nginx
upstream mini_app {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name localhost 172.31.112.1;

    # Pasar headers importantes
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Endpoint interno para verificar autenticación
    location = /auth-check {
        internal;
        proxy_pass http://mini_app/auth-check;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
    }

    # Rutas públicas (sin autenticación)
    location ~ ^/(login|callback|logout|logout/callback|health|index\.html|\.(css|js|png|jpg|gif|ico|svg))$ {
        proxy_pass http://mini_app;
        proxy_set_header Cookie $http_cookie;
    }

    # Recurso protegido (requiere autenticación)
    location /recurso-protegido/ {
        auth_request /auth-check;
        error_page 401 = @login;
        proxy_pass http://mini_app;
        proxy_set_header Cookie $http_cookie;
    }

    # Handler de login cuando hay 401
    location @login {
        return 302 http://$host/login;
    }

    # Por defecto, pasar todo al backend
    location / {
        proxy_pass http://mini_app;
        proxy_set_header Cookie $http_cookie;
    }
}
```

### 4. Verificar la configuración

Abre PowerShell como Administrador y ejecuta:

```powershell
cd C:\nginx  # O la ruta donde instalaste Nginx
.\nginx.exe -t
```

Si todo está bien, verás:
```
nginx: the configuration file C:\nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:\nginx/conf/nginx.conf test is successful
```

### 5. Iniciar/Recargar Nginx

**Iniciar Nginx:**
```powershell
.\nginx.exe
```

**Recargar configuración (sin reiniciar):**
```powershell
.\nginx.exe -s reload
```

**Detener Nginx:**
```powershell
.\nginx.exe -s stop
```

**Verificar que está corriendo:**
```powershell
Get-Process nginx
```

### 6. Probar la configuración

1. **Asegúrate de que tu mini-app está corriendo** en el puerto 3000:
   ```powershell
   npm run dev
   ```

2. **Abre un navegador** y visita:
   - `http://localhost/recurso-protegido/` → Debería redirigirte a `/login`
   - `http://localhost/login` → Debería iniciar el flujo OIDC con WSO2

3. **Revisa los logs de Nginx** (si los configuraste):
   - `C:\nginx\logs\access.log`
   - `C:\nginx\logs\error.log`

## Solución de Problemas

### Error: "unknown directive auth_request"

**Problema:** Nginx no tiene compilado el módulo `auth_request`.

**Solución:** 
- Descarga una versión de Nginx que incluya este módulo
- O compila Nginx desde el código fuente con `--with-http_auth_request_module`

### Error: "connection refused" al hacer auth_request

**Problema:** La mini-app no está corriendo o está en otro puerto.

**Solución:**
- Verifica que la mini-app está corriendo: `netstat -an | findstr :3000`
- Ajusta el `upstream` en la configuración de Nginx

### Las cookies no se pasan correctamente

**Problema:** Nginx no está pasando las cookies al backend.

**Solución:**
- Asegúrate de tener `proxy_set_header Cookie $http_cookie;` en todas las `location` que necesiten cookies

### Redirección infinita en /login

**Problema:** La ruta `/login` también está protegida con `auth_request`.

**Solución:**
- Asegúrate de que `/login` esté en la lista de rutas públicas (sin `auth_request`)

## Configuración Avanzada

### Múltiples instancias del backend (load balancing)

```nginx
upstream mini_app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

### Configurar HTTPS (producción)

Necesitarás certificados SSL. Puedes usar Let's Encrypt con Certbot o certificados autofirmados para pruebas.

Ejemplo con certificado autofirmado:
```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    ssl_certificate C:/path/to/cert.pem;
    ssl_certificate_key C:/path/to/key.pem;

    # ... resto de la configuración ...
}
```

## Recursos Adicionales

- Documentación oficial de Nginx: https://nginx.org/en/docs/
- Módulo auth_request: https://nginx.org/en/docs/http/ngx_http_auth_request_module.html
- Configuración de proxy: https://nginx.org/en/docs/http/ngx_http_proxy_module.html

