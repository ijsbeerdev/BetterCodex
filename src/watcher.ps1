$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $runtimeRoot "start.ps1"
$launcherPath = Join-Path $runtimeRoot "launcher.mjs"
$logPath = Join-Path $runtimeRoot "bettercodex.log"
$mutex = New-Object System.Threading.Mutex($false, "Local\BetterCodexCodexWatcher")
$ownsMutex = $false

function Write-BetterCodexLog([string]$message) {
    Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) [watcher] $message" -ErrorAction SilentlyContinue
}

function Test-BetterCodexRuntimeRunning {
    $runtime = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*$startScript*" -or
            $_.CommandLine -like "*$launcherPath*"
        } |
        Select-Object -First 1
    return $null -ne $runtime
}

function Start-BetterCodexRuntime {
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList @("-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$startScript`"") `
        -WorkingDirectory $runtimeRoot -WindowStyle Hidden
}

function Restart-CodexWithBetterCodex([object]$process) {
    Write-BetterCodexLog "Intercepting normal Codex launch (PID $($process.ProcessId))."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    Start-BetterCodexRuntime
}

$seen = New-Object 'System.Collections.Generic.HashSet[int]'
try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
        Write-BetterCodexLog "Recovered the launch watcher after an interrupted previous session."
    }
    if (-not $ownsMutex) { return }

    Write-BetterCodexLog "Launch watcher ready."
    $nextRuntimeCheck = [DateTime]::MinValue
    while ($true) {
        try {
            $roots = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -notmatch "--type=" })
            $liveIds = New-Object 'System.Collections.Generic.HashSet[int]'
            $hasPatchedCodex = $false

            foreach ($process in $roots) {
                $processId = [int]$process.ProcessId
                [void]$liveIds.Add($processId)
                if ($process.CommandLine -match "--remote-debugging-port=") {
                    $hasPatchedCodex = $true
                    continue
                }
                if ($seen.Add($processId)) {
                    try {
                        Restart-CodexWithBetterCodex $process
                    } catch {
                        [void]$seen.Remove($processId)
                        Write-BetterCodexLog "Could not intercept Codex PID ${processId}: $($_.Exception.Message)"
                    }
                }
            }

            foreach ($processId in @($seen)) {
                if (-not $liveIds.Contains($processId)) { [void]$seen.Remove($processId) }
            }

            $now = Get-Date
            if ($hasPatchedCodex -and $now -ge $nextRuntimeCheck) {
                $nextRuntimeCheck = $now.AddSeconds(2)
                if (-not (Test-BetterCodexRuntimeRunning)) {
                    Write-BetterCodexLog "Attaching the refreshed BetterCodex runtime to the running Codex process."
                    Start-BetterCodexRuntime
                }
            }
        } catch {
            Write-BetterCodexLog "Watcher scan failed and will retry: $($_.Exception.Message)"
        }
        Start-Sleep -Milliseconds 250
    }
} catch {
    Write-BetterCodexLog "Watcher failed: $($_.Exception.Message)"
    throw
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
