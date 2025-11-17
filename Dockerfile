# Dockerfile para la mini-app Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY src ./src
COPY public ./public

# Compilar TypeScript
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS production

WORKDIR /app

# Copiar solo archivos necesarios para producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar archivos compilados y estáticos desde builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Exponer el puerto
EXPOSE 3000

# Variables de entorno (se pueden sobrescribir con docker-compose)
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar la aplicación
CMD ["node", "dist/server.js"]

