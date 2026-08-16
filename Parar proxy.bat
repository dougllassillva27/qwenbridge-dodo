@echo off
@setlocal
title QwenBridge - Parar Proxy Docker

echo.
echo ===================================================================
echo   PARANDO QWENBRIDGE NO DOCKER
echo ===================================================================
echo.

cd /d "%~dp0"

echo Desligando o container...
docker compose down

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Container parado e memoria liberada com sucesso!
) else (
    echo.
    echo [AVISO] O container ja estava parado ou ocorreu uma mensagem do Docker.
)

echo.
timeout /t 3 >nul
