# Guía de Despliegue con Docker

Esta guía te ayudará a ejecutar **solo Nginx en Docker** mientras la mini-app corre directamente en tu máquina.

## Requisitos Previos

- Docker Desktop (Windows/Mac) o Docker Engine + Docker Compose (Linux)
- Node.js >= 18 instalado en tu máquina
- Archivo `.env` configurado con tus credenciales de WSO2

## Configuración Rápida

### 1. Iniciar la mini-app (fuera de Docker)

**Primero**, inicia la mini-app en tu máquina:

```bash
# Instalar dependencias (solo la primera vez)
npm install

# Iniciar en modo desarrollo
npm run dev
```

La mini-app debe estar corriendo en `http://localhost:3000`. **No cierres esta terminal.**

### 2. Crear el archivo `.env`

En otra terminal, copia `env.sample` a `.env` y completa los valores:

```bash
cp env.sample .env
```

Edita `.env` con tus valores:
```env
WSO2_BASE_URL=https://172.31.125.215:9443
WSO2_TENANT_DOMAIN=carbon.super
WSO2_CLIENT_ID=tu_client_id
WSO2_CLIENT_SECRET=tu_client_secret
APP_BASE_URL=http://localhost
SESSION_SECRET=tu-secret-super-largo-y-aleatorio
SESSION_TTL_MS=3600000
ALLOW_INSECURE_TLS=true
CLOCK_TOLERANCE_SECONDS=300
```

**Importante:** 
- `APP_BASE_URL` debe ser la URL desde la que accederás a la aplicación (ej: `http://localhost` o `http://172.31.112.1`)
- Asegúrate de que esta URL coincida con la configurada en WSO2 como Callback URL

### 3. Construir y levantar Nginx en Docker

```bash
# Construir la imagen de Nginx y levantar el servicio
docker-compose up -d

# Ver los logs
docker-compose logs -f nginx
```

O usa el script automatizado:
- Windows: `.\docker-start.ps1`
- Linux/Mac: `./docker-start.sh`

### 4. Verificar que todo está funcionando

```bash
# Ver el estado de los contenedores
docker-compose ps

# Verificar health checks
docker-compose ps --format "table {{.Name}}\t{{.Status}}"
```

### 4. Probar la aplicación

Abre tu navegador y visita:
- `http://localhost/` → Página principal
- `http://localhost/login` → Inicia el flujo OIDC
- `http://localhost/recurso-protegido/` → Debería redirigir a login si no estás autenticado

## Comandos Útiles

### Gestión de contenedores

```bash
# Detener los contenedores
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v

# Reiniciar un servicio específico
docker-compose restart nginx
docker-compose restart mini-app

# Reconstruir después de cambios en el código
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f
```

### Debugging

```bash
# Entrar al contenedor de la mini-app
docker-compose exec mini-app sh

# Entrar al contenedor de Nginx
docker-compose exec nginx sh

# Ver configuración de Nginx dentro del contenedor
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf

# Probar configuración de Nginx
docker-compose exec nginx nginx -t

# Ver variables de entorno del contenedor
docker-compose exec mini-app env | grep WSO2
```

### Limpieza

```bash
# Eliminar contenedores, redes y volúmenes
docker-compose down -v

# Eliminar también las imágenes
docker-compose down -v --rmi all

# Limpiar todo (cuidado: elimina contenedores e imágenes)
docker system prune -a
```

## Estructura de Archivos Docker

```
.
├── docker-compose.yml          # Orquestación de servicios
├── Dockerfile                  # Imagen de la mini-app
├── docker/
│   ├── Dockerfile.nginx       # Imagen de Nginx
│   └── nginx.conf             # Configuración de Nginx
├── .dockerignore              # Archivos a ignorar en build
└── .env                       # Variables de entorno (no versionar)
```

## Configuración Avanzada

### Cambiar el puerto de Nginx

Edita `docker-compose.yml` y cambia:
```yaml
nginx:
  ports:
    - "8080:80"  # Cambia 8080 por el puerto que quieras
```

### Agregar HTTPS

1. Coloca tus certificados SSL en `docker/certs/`
2. Descomenta las líneas de HTTPS en `docker-compose.yml`
3. Actualiza `docker/nginx.conf` para incluir configuración SSL
4. Cambia `APP_BASE_URL` a `https://tu-dominio`

### Múltiples instancias de la mini-app

Edita `docker-compose.yml`:
```yaml
mini-app:
  deploy:
    replicas: 3
```

Y actualiza `docker/nginx.conf`:
```nginx
upstream mini_app {
    server mini-app:3000;
    server mini-app:3001;
    server mini-app:3002;
}
```

### Variables de entorno por ambiente

Crea archivos `.env.production`, `.env.development`, etc.:

```bash
# Desarrollo
docker-compose --env-file .env.development up

# Producción
docker-compose --env-file .env.production up
```

## Solución de Problemas

### Error: "Cannot connect to mini-app"

**Problema:** Los contenedores no están en la misma red.

**Solución:**
```bash
docker-compose down
docker-compose up -d
```

### Error: "Port already in use"

**Problema:** El puerto 80 o 3000 ya está en uso.

**Solución:** Cambia los puertos en `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # En lugar de 80:80
```

### Las cookies no funcionan

**Problema:** `APP_BASE_URL` no coincide con la URL real.

**Solución:** Asegúrate de que `APP_BASE_URL` en `.env` sea exactamente la URL que ves en el navegador.

### Nginx no encuentra la mini-app

**Problema:** El nombre del servicio en `docker-compose.yml` no coincide.

**Solución:** Verifica que en `docker/nginx.conf` el upstream use `mini-app` (nombre del servicio en docker-compose).

## Producción

Para producción, considera:

1. **Usar HTTPS** con certificados válidos
2. **Configurar `ALLOW_INSECURE_TLS=false`** en `.env`
3. **Usar secretos de Docker** en lugar de `.env` para credenciales
4. **Configurar logs rotativos** para Nginx
5. **Usar un orquestador** como Kubernetes si necesitas escalabilidad
6. **Monitoreo** con herramientas como Prometheus/Grafana

## Recursos Adicionales

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)
- [Node.js Docker Image](https://hub.docker.com/_/node)

