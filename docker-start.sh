#!/bin/bash
# Script de inicio rápido para Docker en Linux/Mac
# Uso: ./docker-start.sh

set -e

echo "========================================"
echo "  Mini-App WSO2 + Nginx - Docker Setup"
echo "========================================"
echo ""

# Verificar que Docker está corriendo
echo "Verificando Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "✗ Docker no está corriendo. Por favor inicia Docker."
    exit 1
fi
echo "✓ Docker está corriendo"

# Verificar que existe .env
echo "Verificando archivo .env..."
if [ ! -f .env ]; then
    echo "✗ No se encontró .env"
    echo "Copiando env.sample a .env..."
    cp env.sample .env
    echo "✓ Archivo .env creado. Por favor edítalo con tus credenciales de WSO2."
    echo ""
    read -p "Presiona Enter después de editar .env para continuar..."
fi

# Construir y levantar contenedores
echo ""
echo "Construyendo imágenes..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "✗ Error al construir las imágenes"
    exit 1
fi

echo "✓ Imágenes construidas"

# Levantar contenedores
echo ""
echo "Levantando contenedores..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "✗ Error al levantar los contenedores"
    exit 1
fi

echo "✓ Contenedores levantados"

# Esperar un momento para que los servicios inicien
echo ""
echo "Esperando que los servicios inicien..."
sleep 5

# Verificar estado
echo ""
echo "Estado de los contenedores:"
docker-compose ps

echo ""
echo "========================================"
echo "  ¡Listo!"
echo "========================================"
echo ""
echo "La aplicación está disponible en:"
echo "  - http://localhost (Nginx)"
echo "  - http://localhost:3000 (Mini-app directa)"
echo ""
echo "Comandos útiles:"
echo "  - Ver logs: docker-compose logs -f"
echo "  - Detener: docker-compose down"
echo "  - Reiniciar: docker-compose restart"
echo ""

