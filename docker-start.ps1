# Script de inicio rapido para Docker en Windows
# Uso: .\docker-start.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mini-App WSO2 + Nginx - Docker Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Docker esta corriendo
Write-Host "Verificando Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "[OK] Docker esta corriendo" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker no esta corriendo. Por favor inicia Docker Desktop." -ForegroundColor Red
    exit 1
}

# Verificar que existe .env
Write-Host "Verificando archivo .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "[INFO] No se encontro .env" -ForegroundColor Yellow
    Write-Host "Copiando env.sample a .env..." -ForegroundColor Yellow
    Copy-Item "env.sample" ".env"
    Write-Host "[OK] Archivo .env creado. Por favor editarlo con tus credenciales de WSO2." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Presiona cualquier tecla despues de editar .env para continuar..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Verificar que la mini-app esta corriendo
Write-Host "Verificando que la mini-app esta corriendo..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $port3000) {
    Write-Host "[ERROR] La mini-app no esta corriendo en el puerto 3000." -ForegroundColor Red
    Write-Host "[INFO] Por favor inicia la mini-app primero con: npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Mini-app detectada en puerto 3000" -ForegroundColor Green

# Verificar puertos disponibles
Write-Host "Verificando puertos..." -ForegroundColor Yellow
$port80 = Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue

if ($port80) {
    Write-Host "[ADVERTENCIA] Puerto 80 esta en uso. Puede causar conflictos con Nginx." -ForegroundColor Yellow
    Write-Host "[INFO] Si quieres usar otro puerto, edita docker-compose.yml" -ForegroundColor Yellow
}

# Construir imagenes
Write-Host ""
Write-Host "Construyendo imagenes..." -ForegroundColor Yellow
docker-compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al construir las imagenes" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Imagenes construidas" -ForegroundColor Green

# Levantar contenedores
Write-Host ""
Write-Host "Levantando contenedores..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Error al levantar los contenedores" -ForegroundColor Red
    Write-Host "[INFO] Si el error es por puertos en uso, deten el proceso que los usa o cambia los puertos en docker-compose.yml" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Contenedores levantados" -ForegroundColor Green

# Esperar que los servicios inicien
Write-Host ""
Write-Host "Esperando que los servicios inicien..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Detectar IP del host
Write-Host ""
Write-Host "Detectando IP del host..." -ForegroundColor Yellow
$hostIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    ($_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual")
} | Sort-Object IPAddress | Select-Object -First 1).IPAddress

if (-not $hostIP) {
    $hostIP = "localhost"
    Write-Host "[ADVERTENCIA] No se pudo detectar la IP del host. Usando localhost." -ForegroundColor Yellow
} else {
    Write-Host "[OK] IP del host detectada: $hostIP" -ForegroundColor Green
}

# Comparar con IP en .env
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "APP_BASE_URL=http://([^\s]+)") {
        $envIP = $matches[1]
        if ($envIP -ne $hostIP -and $envIP -ne "localhost") {
            Write-Host ""
            Write-Host "[ADVERTENCIA] La IP en .env ($envIP) es diferente a la detectada ($hostIP)" -ForegroundColor Yellow
            Write-Host "[INFO] Para actualizar el .env, ejecuta: .\scripts\detect-host-ip.ps1" -ForegroundColor Cyan
        }
    }
}

# Verificar estado
Write-Host ""
Write-Host "Estado de los contenedores:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Listo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La aplicacion esta disponible en:" -ForegroundColor Yellow
Write-Host "  - http://$hostIP (Nginx en Docker -> Mini-app en host:3000)" -ForegroundColor White
Write-Host "  - http://$hostIP:3000 (Mini-app directa)" -ForegroundColor White
Write-Host "  - http://localhost (tambien funciona)" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Solo Nginx esta corriendo en Docker." -ForegroundColor Cyan
Write-Host "[INFO] La mini-app debe estar corriendo fuera de Docker en el puerto 3000." -ForegroundColor Cyan
Write-Host ""
Write-Host "[IMPORTANTE] Asegurate de que la Callback URL en WSO2 incluya:" -ForegroundColor Yellow
Write-Host "  - http://$hostIP/callback" -ForegroundColor White
Write-Host "  - http://$hostIP/logout/callback" -ForegroundColor White
Write-Host ""
Write-Host "Comandos utiles:" -ForegroundColor Yellow
Write-Host "  - Ver logs: docker-compose logs -f" -ForegroundColor White
Write-Host "  - Detener: docker-compose down" -ForegroundColor White
Write-Host "  - Reiniciar: docker-compose restart" -ForegroundColor White
Write-Host ""
