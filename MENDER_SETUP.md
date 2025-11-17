# Configuración de Mender.io Online

Esta guía te ayudará a configurar la integración con Mender.io online (hosted.mender.io).

## Pasos para Configurar Mender.io Online

### 1. Obtener Token de API

1. **Inicia sesión en Mender.io Online**
   - Ve a [https://hosted.mender.io](https://hosted.mender.io)
   - Inicia sesión con tu cuenta

2. **Crear Token de API**
   - Ve a **Settings** (Configuración) en el menú lateral
   - Selecciona **API Tokens** (Tokens de API)
   - Haz clic en **Create API Token** (Crear Token de API)
   - Asigna un nombre descriptivo (ej: "Mini-App Integration")
   - Selecciona los permisos necesarios:
     - `devices:read` - Para leer información de dispositivos
     - `devices:write` - Si necesitas modificar dispositivos (opcional)
   - Haz clic en **Create** (Crear)
   - **IMPORTANTE**: Copia el token inmediatamente, ya que solo se muestra una vez

### 2. Configurar Variables de Entorno

Edita tu archivo `.env` y agrega:

```env
# Mender.io Online Configuration
MENDER_SERVER_URL=https://hosted.mender.io
MENDER_API_TOKEN=tu_token_aqui_pegado_del_paso_anterior
```

**Nota**: Reemplaza `tu_token_aqui_pegado_del_paso_anterior` con el token que copiaste.

### 3. Verificar la Configuración

Una vez configurado, reinicia tu aplicación:

```bash
npm run dev
```

Luego accede a la página protegida (`/protected.html`) después de autenticarte con WSO2. Deberías ver:

- ✅ Estado del servidor Mender (Operativo)
- 📱 Lista de tus dispositivos gestionados
- 📊 Estado de salud de cada dispositivo

## Endpoints Disponibles

Una vez configurado, los siguientes endpoints estarán disponibles (requieren autenticación WSO2):

- `GET /api/mender/health` - Verifica el estado del servidor Mender
- `GET /api/mender/devices` - Lista todos los dispositivos
- `GET /api/mender/devices/:deviceId` - Obtiene información de un dispositivo específico

## Solución de Problemas

### Error: "Mender no está configurado"

**Problema**: Las variables de entorno no están configuradas correctamente.

**Solución**: 
- Verifica que `MENDER_SERVER_URL` y `MENDER_API_TOKEN` estén en tu archivo `.env`
- Asegúrate de reiniciar la aplicación después de agregar las variables

### Error: "401 Unauthorized" o "403 Forbidden"

**Problema**: El token de API no es válido o no tiene los permisos necesarios.

**Solución**:
- Verifica que el token esté correctamente copiado (sin espacios extra)
- Asegúrate de que el token tenga el permiso `devices:read`
- Genera un nuevo token si es necesario

### Error: "Network Error" o "Timeout"

**Problema**: No se puede conectar al servidor de Mender.io.

**Solución**:
- Verifica tu conexión a internet
- Confirma que la URL sea correcta: `https://hosted.mender.io`
- Verifica que no haya un firewall bloqueando la conexión

### No se muestran dispositivos

**Problema**: No hay dispositivos registrados o no tienes permisos para verlos.

**Solución**:
- Verifica en el dashboard de Mender.io que tengas dispositivos registrados
- Asegúrate de que el token tenga permisos para leer dispositivos
- Verifica que los dispositivos estén en estado "accepted"

## Estructura de la API de Mender.io

La integración usa la API Management v1 de Mender:

- Base URL: `https://hosted.mender.io/api/management/v1`
- Autenticación: Bearer Token en el header `Authorization`
- Endpoints principales:
  - `GET /inventory/devices` - Lista dispositivos
  - `GET /inventory/devices/:id` - Información de un dispositivo

**Nota**: Mender.io online usa la ruta `/inventory/devices` en lugar de `/devices`.

## Recursos Adicionales

- [Documentación de Mender.io](https://docs.mender.io/)
- [API Reference de Mender](https://docs.mender.io/api/)
- [Dashboard de Mender.io Online](https://hosted.mender.io)

