param (
    [string]$Action = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = "QwenBridge - Central de Controle" } catch {}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Log-Launcher([string]$msg) {
    $logFile = Join-Path $scriptDir "launcher_debug.log"
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    "[$timestamp] $msg" | Out-File -FilePath $logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Stop-QwenServices {
    param ([bool]$Silent = $false)
    Log-Launcher "Stop-QwenServices called (Silent=$Silent)"
    if (-not $Silent) {
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host "  PARANDO SERVICOS: QWENBRIDGE e CAPTCHA RESOLVE" -ForegroundColor Yellow
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "[1/2] Encerrando processos na porta 50002 (QwenBridge)..." -ForegroundColor Gray
    }
    
    # Encerra processos na porta 50002
    try {
        $conns50002 = Get-NetTCPConnection -LocalPort 50002 -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns50002) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    $netstat50002 = netstat -ano | Select-String ":50002\s+.*LISTENING"
    foreach ($line in $netstat50002) {
        $tokens = ($line.ToString().Trim() -split '\s+')
        if ($tokens.Count -gt 4) {
            $pidToKill = $tokens[-1]
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not $Silent) {
        Write-Host "[2/2] Encerrando processos na porta 50006 (CaptchaResolve)..." -ForegroundColor Gray
    }

    # Encerra processos na porta 50006
    try {
        $conns50006 = Get-NetTCPConnection -LocalPort 50006 -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns50006) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    $netstat50006 = netstat -ano | Select-String ":50006\s+.*LISTENING"
    foreach ($line in $netstat50006) {
        $tokens = ($line.ToString().Trim() -split '\s+')
        if ($tokens.Count -gt 4) {
            $pidToKill = $tokens[-1]
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        }
    }

    # Limpa janelas residuais caso existam
    Get-Process -Name "node", "cmd" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -like "QwenBridge Server*" -or $_.MainWindowTitle -like "CaptchaResolve Service*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    try {
        Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*captchaResolve*"
        } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch {}

    if (-not $Silent) {
        Write-Host ""
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host "  [OK] SERVICOS PARADOS E MEMORIA LIBERADA COM SUCESSO!" -ForegroundColor Green
        Write-Host "===================================================================" -ForegroundColor Cyan
        Start-Sleep -Seconds 2
    }
}

$script:lastScreenContent = ""

function Set-ScreenCoordinates {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        $p = Get-Process -Id $PID
        $h = $p.MainWindowHandle
        $s = $null
        if ($h -and $h -ne [IntPtr]::Zero) {
            $s = [System.Windows.Forms.Screen]::FromHandle($h)
        }
        if (-not $s) {
            $s = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position)
        }
        if (-not $s) {
            $s = [System.Windows.Forms.Screen]::PrimaryScreen
        }
        if ($s) {
            $cx = [int]($s.Bounds.Left + ($s.Bounds.Width / 2))
            $cy = [int]($s.Bounds.Top + ($s.Bounds.Height / 2))
            $env:LAUNCHER_WINDOW_X = "$cx"
            $env:LAUNCHER_WINDOW_Y = "$cy"

            $dataPath = Join-Path $scriptDir "data"
            if (-not (Test-Path $dataPath)) { New-Item -ItemType Directory -Path $dataPath -Force | Out-Null }
            $screenFile = Join-Path $dataPath ".launcher_screen.json"
            $content = "{`"x`":$cx,`"y`":$cy}"
            if ($script:lastScreenContent -ne $content) {
                [System.IO.File]::WriteAllText($screenFile, $content)
                $script:lastScreenContent = $content
                Log-Launcher "Monitor detectado: Bounds=$($s.Bounds.ToString()) -> X=$cx, Y=$cy"
            }
        }
    } catch {
        Log-Launcher "Error in Set-ScreenCoordinates: $_"
    }
}

function Start-CaptchaResolveService {
    $captchaDir = Join-Path $scriptDir "..\..\captchaResolve"
    if (Test-Path (Join-Path $captchaDir "package.json")) {
        $captchaListening = $false
        try {
            $c = Get-NetTCPConnection -LocalPort 50006 -State Listen -ErrorAction SilentlyContinue
            if ($c) { $captchaListening = $true }
        } catch {}
        if (-not $captchaListening) {
            $ns = netstat -ano | Select-String ":50006\s+.*LISTENING"
            if ($ns) { $captchaListening = $true }
        }
        if (-not $captchaListening) {
            Write-Host "[*] Iniciando CaptchaResolve na porta 50006 (background oculto)..." -ForegroundColor Yellow
            $captchaTsx = Join-Path $captchaDir "node_modules\tsx\dist\cli.mjs"
            if (Test-Path $captchaTsx) {
                Start-Process -FilePath "node.exe" -ArgumentList "`"$captchaTsx`" src/index.ts" -WorkingDirectory $captchaDir -WindowStyle Hidden
            } else {
                Start-Process -FilePath "npx.cmd" -ArgumentList "tsx src/index.ts" -WorkingDirectory $captchaDir -WindowStyle Hidden
            }
            Start-Sleep -Seconds 1
        } else {
            Write-Host "[*] CaptchaResolve ja esta ativo na porta 50006." -ForegroundColor Green
        }
    }
}

function Start-ServicesForeground {
    Log-Launcher "Start-ServicesForeground initiated"
    Set-ScreenCoordinates
    Clear-Host
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  INICIANDO SERVICOS EM PRIMEIRO PLANO (LOGS AO VIVO)" -ForegroundColor Green
    Write-Host "  - QwenBridge     [Porta 50002] - Admin: http://127.0.0.1:50002/admin" -ForegroundColor White
    Write-Host "  - CaptchaResolve [Porta 50006]" -ForegroundColor White
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host ""

    Start-CaptchaResolveService

    Write-Host "[*] Iniciando QwenBridge nesta janela..." -ForegroundColor Cyan
    Write-Host "[*] Dica: Pressione 'Q' ou Ctrl+C a qualquer momento para voltar ao menu." -ForegroundColor Magenta
    Write-Host ""

    # Intercepta Ctrl+C para leitura como tecla comum, evitando que o Windows finalize a janela do terminal
    try { [Console]::TreatControlCAsInput = $true } catch {}

    $qwenTsx = Join-Path $scriptDir "node_modules\tsx\dist\cli.mjs"
    $nodeArgs = if (Test-Path $qwenTsx) { "`"$qwenTsx`" `"src/index.ts`"" } else { "src/index.ts" }

    Log-Launcher "Launching Node foreground process (node.exe $nodeArgs)"
    $proc = Start-Process -FilePath "node.exe" -ArgumentList $nodeArgs -WorkingDirectory $scriptDir -PassThru -NoNewWindow

    $loopCount = 0
    try {
        while (-not $proc.HasExited) {
            $loopCount++
            if ($loopCount % 10 -eq 0) {
                Set-ScreenCoordinates
            }
            if ([Console]::KeyAvailable) {
                $k = [Console]::ReadKey($true)
                if ($k.Key -eq 'Q' -or ($k.Modifiers -band [ConsoleModifiers]::Control -and $k.Key -eq 'C') -or ($k.KeyChar -eq [char]3)) {
                    Log-Launcher "User requested stop via key: $($k.Key)"
                    Write-Host "`n[*] Interrupcao solicitada pelo usuario. Encerrando..." -ForegroundColor Yellow
                    break
                }
            }
            Start-Sleep -Milliseconds 150
        }
    } catch {
        Log-Launcher "Exception in foreground loop: $_"
    } finally {
        $screenFile = Join-Path $scriptDir "data\.launcher_screen.json"
        if (Test-Path $screenFile) { Remove-Item $screenFile -Force -ErrorAction SilentlyContinue }
        try { [Console]::TreatControlCAsInput = $false } catch {}
        if (-not $proc.HasExited) {
            Log-Launcher "Stopping child Node process (PID=$($proc.Id))"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Stop-QwenServices -Silent $true
        Log-Launcher "Foreground session ended cleanly. Returning to menu."
        Write-Host "[OK] Portas liberadas. Retornando ao menu principal..." -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
}

function Start-ServicesBackground {
    Log-Launcher "Start-ServicesBackground initiated"
    Set-ScreenCoordinates
    Clear-Host
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host "  INICIANDO SERVICOS EM JANELA DEDICADA" -ForegroundColor Green
    Write-Host ""

    Start-CaptchaResolveService

    Write-Host "[*] Iniciando QwenBridge na porta 50002 em janela dedicada..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c title QwenBridge Server && npm run start:qwenbridge" -WorkingDirectory $scriptDir

    Write-Host ""
    Write-Host "[OK] Servicos iniciados com sucesso!" -ForegroundColor Green
    Write-Host "Acompanhe os logs na janela aberta do QwenBridge." -ForegroundColor Gray
    Write-Host "Aguardando 3 segundos para sincronizacao..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

function Show-Menu {
    Log-Launcher "Show-Menu rendered"
    while ($true) {
        Clear-Host

        # Verifica porta 50002
        $qwenListening = $false
        try {
            $c = Get-NetTCPConnection -LocalPort 50002 -State Listen -ErrorAction SilentlyContinue
            if ($c) { $qwenListening = $true }
        } catch {}
        if (-not $qwenListening) {
            $ns = netstat -ano | Select-String ":50002\s+.*LISTENING"
            if ($ns) { $qwenListening = $true }
        }

        # Verifica porta 50006
        $captchaListening = $false
        try {
            $c = Get-NetTCPConnection -LocalPort 50006 -State Listen -ErrorAction SilentlyContinue
            if ($c) { $captchaListening = $true }
        } catch {}
        if (-not $captchaListening) {
            $ns = netstat -ano | Select-String ":50006\s+.*LISTENING"
            if ($ns) { $captchaListening = $true }
        }

        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host "                     PAINEL DE CONTROLE QWENBRIDGE" -ForegroundColor White
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host "  STATUS ATUAL:" -ForegroundColor White

        Write-Host -NoNewline "    - QwenBridge     (Porta 50002): "
        if ($qwenListening) {
            Write-Host "[ ONLINE ]" -ForegroundColor Green
        } else {
            Write-Host "[ PARADO ]" -ForegroundColor Red
        }

        Write-Host -NoNewline "    - CaptchaResolve (Porta 50006): "
        if ($captchaListening) {
            Write-Host "[ ONLINE ]" -ForegroundColor Green
        } else {
            Write-Host "[ PARADO ]" -ForegroundColor Red
        }

        Write-Host "    - Admin Dashboard             : http://127.0.0.1:50002/admin" -ForegroundColor Gray
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  OPCOES:" -ForegroundColor White
        Write-Host ""
        Write-Host "    [1] Iniciar Servicos (Nesta Janela - Logs ao Vivo)" -ForegroundColor Yellow
        Write-Host "    [2] Iniciar Servicos (Janela Separada - Mantem Menu)" -ForegroundColor Yellow
        Write-Host "    [3] Parar Servicos (Liberar portas e memoria)" -ForegroundColor Yellow
        Write-Host "    [4] Reiniciar Servicos" -ForegroundColor Yellow
        Write-Host "    [5] Abrir Painel Admin no Navegador" -ForegroundColor Yellow
        Write-Host "    [6] Atualizar Status" -ForegroundColor Yellow
        Write-Host "    [7] Resetar Cooldowns e Sessoes Expiradas" -ForegroundColor Yellow
        Write-Host "    [0] Sair" -ForegroundColor Gray
        Write-Host ""
        Write-Host "===================================================================" -ForegroundColor Cyan
        
        $choice = Read-Host "Digite o numero da opcao desejada [1-7, 0]"
        Log-Launcher "User menu choice: '$choice'"

        switch ($choice.Trim()) {
            "1" { Start-ServicesForeground }
            "2" { Start-ServicesBackground }
            "3" { Stop-QwenServices }
            "4" {
                Stop-QwenServices -Silent $true
                Start-ServicesForeground
            }
            "5" {
                Start-Process "http://127.0.0.1:50002/admin"
                Start-Sleep -Seconds 1
            }
            "6" { continue }
            "7" {
                Stop-QwenServices -Silent $true
                $qwenTsx = Join-Path $scriptDir "node_modules\tsx\dist\cli.mjs"
                $resetScript = Join-Path $scriptDir "src\tools\reset-sessions.ts"
                if (Test-Path $qwenTsx) {
                    & node.exe "$qwenTsx" "$resetScript"
                } else {
                    & npx tsx "$resetScript"
                }
                Start-Sleep -Seconds 2
            }
            "0" {
                Log-Launcher "User requested exit (0)"
                exit 0
            }
            default {
                Write-Host "Opcao invalida!" -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
    }
}

# Tratamento flexivel de argumentos CLI
$rawArgs = "$Action " + ($args -join " ")
Log-Launcher "manager.ps1 started with rawArgs: '$rawArgs'"
if ($rawArgs -match "stop") {
    Stop-QwenServices
    exit 0
} elseif ($rawArgs -match "restart") {
    Stop-QwenServices -Silent $true
    Start-ServicesForeground
    exit 0
} elseif ($rawArgs -match "start") {
    Start-ServicesForeground
    exit 0
} else {
    Show-Menu
}
