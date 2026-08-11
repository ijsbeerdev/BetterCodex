$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $runtimeRoot "start.ps1"
$notifyScript = Join-Path $runtimeRoot "notify.ps1"
$logPath = Join-Path $runtimeRoot "bettercodex.log"
$mutex = New-Object System.Threading.Mutex($false, "Local\BetterCodexCodexWatcher")

if (-not $mutex.WaitOne(0)) { return }

function Write-BetterCodexLog([string]$message) {
    Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) [watcher] $message" -ErrorAction SilentlyContinue
}

function Show-BetterCodexNotification([string]$title, [string]$message) {
    if (-not (Test-Path -LiteralPath $notifyScript)) { return }
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$notifyScript`"", "-Title", "`"$title`"", "-Message", "`"$message`"") `
        -WorkingDirectory $runtimeRoot -WindowStyle Hidden
}

function Get-CodexRootProcess([int]$processId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.Name -ne "ChatGPT.exe" -or $process.CommandLine -match "--type=") { return $null }
    return $process
}

function Test-BetterCodexLauncherRunning {
    $launcherPath = Join-Path $runtimeRoot "launcher.mjs"
    $launcher = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*$launcherPath*" } |
        Select-Object -First 1
    return $null -ne $launcher
}

function Start-BetterCodexRuntime {
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$startScript`"") `
        -WorkingDirectory $runtimeRoot -WindowStyle Hidden
}

function Start-PatchedCodex([object]$process) {
    if ($process.CommandLine -match "--remote-debugging-port=") {
        if (-not (Test-BetterCodexLauncherRunning)) {
            Write-BetterCodexLog "Attaching the refreshed BetterCodex runtime to Codex PID $($process.ProcessId)."
            Start-BetterCodexRuntime
        }
        return
    }
    Write-BetterCodexLog "Intercepting normal Codex launch (PID $($process.ProcessId))."
    Show-BetterCodexNotification "BetterCodex is restarting Codex" "Restarting Codex to load BetterCodex."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    Start-BetterCodexRuntime
}

$seen = New-Object 'System.Collections.Generic.HashSet[int]'
try {
    Write-BetterCodexLog "Launch watcher ready."
    while ($true) {
        $roots = @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -notmatch "--type=" })
        $liveIds = New-Object 'System.Collections.Generic.HashSet[int]'
        foreach ($process in $roots) {
            $processId = [int]$process.ProcessId
            [void]$liveIds.Add($processId)
            if ($seen.Add($processId)) {
                Start-PatchedCodex $process
            }
        }
        foreach ($processId in @($seen)) {
            if (-not $liveIds.Contains($processId)) { [void]$seen.Remove($processId) }
        }
        Start-Sleep -Milliseconds 750
    }
} catch {
    Write-BetterCodexLog "Watcher failed: $($_.Exception.Message)"
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
