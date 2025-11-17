# Script para detectar la IP del host y actualizar configuración
# Uso: .\scripts\detect-host-ip.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuracion de IP del Host" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mostrar IP actual en .env si existe
if (Test-Path ".env") {
    $currentEnv = Get-Content ".env" -Raw
    if ($currentEnv -match "APP_BASE_URL=http://([^\s]+)") {
        $currentIP = $matches[1]
        Write-Host "IP actual en .env: $currentIP" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "Detectando interfaces de red activas..." -ForegroundColor Yellow

# Obtener todas las interfaces de red activas
$networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    ($_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual")
} | Sort-Object IPAddress

if ($networkAdapters.Count -eq 0) {
    Write-Host "[ERROR] No se encontraron interfaces de red activas" -ForegroundColor Red
    exit 1
}

# Mostrar opciones
Write-Host ""
Write-Host "Interfaces de red encontradas:" -ForegroundColor Cyan
$index = 1
foreach ($adapter in $networkAdapters) {
    $interface = Get-NetAdapter | Where-Object { $_.InterfaceIndex -eq $adapter.InterfaceIndex }
    $isCurrent = ($currentIP -and $adapter.IPAddress -eq $currentIP)
    $marker = if ($isCurrent) { " <-- ACTUAL" } else { "" }
    Write-Host "  [$index] $($adapter.IPAddress) - $($interface.Name)$marker" -ForegroundColor $(if ($isCurrent) { "Green" } else { "White" })
    $index++
}

# Si hay más de una, pedir al usuario que elija
$selectedIP = $null
if ($networkAdapters.Count -eq 1) {
    $selectedIP = $networkAdapters[0].IPAddress
    Write-Host ""
    Write-Host "[OK] Usando IP: $selectedIP" -ForegroundColor Green
} else {
    Write-Host ""
    $choice = Read-Host "Selecciona el numero de la IP que quieres usar (1-$($networkAdapters.Count))"
    $choiceNum = [int]$choice
    if ($choiceNum -ge 1 -and $choiceNum -le $networkAdapters.Count) {
        $selectedIP = $networkAdapters[$choiceNum - 1].IPAddress
        Write-Host "[OK] IP seleccionada: $selectedIP" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Seleccion invalida" -ForegroundColor Red
        exit 1
    }
}

# Confirmar antes de actualizar
Write-Host ""
if ($currentIP -and $selectedIP -eq $currentIP) {
    Write-Host "[INFO] La IP seleccionada ya esta configurada. No se realizaran cambios." -ForegroundColor Cyan
} else {
    if ($currentIP) {
        Write-Host "Se cambiara la IP de: $currentIP -> $selectedIP" -ForegroundColor Yellow
    }
    $confirm = Read-Host "¿Deseas actualizar el archivo .env con esta IP? (S/N)"
    if ($confirm -eq "S" -or $confirm -eq "s" -or $confirm -eq "Y" -or $confirm -eq "y") {
        # Actualizar .env si existe
        if (Test-Path ".env") {
            Write-Host ""
            Write-Host "Actualizando .env..." -ForegroundColor Yellow
            $envContent = Get-Content ".env" -Raw
            $envContent = $envContent -replace "APP_BASE_URL=http://localhost", "APP_BASE_URL=http://$selectedIP"
            $envContent = $envContent -replace "APP_BASE_URL=http://\d+\.\d+\.\d+\.\d+", "APP_BASE_URL=http://$selectedIP"
            Set-Content ".env" -Value $envContent -NoNewline
            Write-Host "[OK] .env actualizado con IP: $selectedIP" -ForegroundColor Green
        } else {
            Write-Host "[ADVERTENCIA] No se encontro .env. Creando uno nuevo..." -ForegroundColor Yellow
            Copy-Item "env.sample" ".env"
            $envContent = Get-Content ".env" -Raw
            $envContent = $envContent -replace "APP_BASE_URL=http://localhost", "APP_BASE_URL=http://$selectedIP"
            Set-Content ".env" -Value $envContent -NoNewline
            Write-Host "[OK] .env creado con IP: $selectedIP" -ForegroundColor Green
        }
    } else {
        Write-Host "[INFO] Operacion cancelada. No se realizaron cambios." -ForegroundColor Cyan
        exit 0
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IP del host configurada: $selectedIP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La aplicacion estara disponible en:" -ForegroundColor Yellow
Write-Host "  - http://$selectedIP (Nginx)" -ForegroundColor White
Write-Host "  - http://$selectedIP:3000 (Mini-app directa)" -ForegroundColor White
Write-Host ""
Write-Host "[IMPORTANTE] Asegurate de actualizar la Callback URL en WSO2 con:" -ForegroundColor Yellow
Write-Host "  - http://$selectedIP/callback" -ForegroundColor White
Write-Host "  - http://$selectedIP/logout/callback" -ForegroundColor White
Write-Host ""

