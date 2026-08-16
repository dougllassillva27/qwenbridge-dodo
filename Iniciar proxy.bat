@echo off
@setlocal
title QwenBridge - Iniciar Proxy Docker

echo.
echo ===================================================================
echo   INICIANDO QWENBRIDGE EM DOCKER (ISOLADO - TETO 4GB RAM)
echo   Porta: 50002 - Dashboard: http://localhost:50002/
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/3] Construindo e inicializando container...
docker compose up -d --build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Nao foi possivel iniciar o container Docker.
    echo 1. Verifique se o Docker Desktop esta aberto.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Container iniciado com sucesso!
echo [3/3] Aguardando o servidor e o proxy ficarem 100%% online...

:: Aguarda ativamente a resposta HTTP 200 do servidor antes de abrir o navegador
powershell -NoProfile -Command "$ok = $false; for ($i=0; $i -lt 25; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:50002/api/dashboard/status' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch {}; Start-Sleep -Milliseconds 800 }; if (-not $ok) { exit 1 }"

echo.
echo [OK] Servidor online e pronto!
echo Abrindo o Dashboard Web no navegador: http://localhost:50002/
start "" "http://localhost:50002/"

echo.
echo ===================================================================
echo   [OK] PROXY ATIVO E RODANDO EM SEGUNDO PLANO!
echo   Dashboard: http://localhost:50002/
echo ===================================================================
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
