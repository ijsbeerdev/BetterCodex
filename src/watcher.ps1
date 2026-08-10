[CmdletBinding()]
param(
    [switch]$IgnoreExisting
)

$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $runtimeRoot "start.ps1"
$logPath = Join-Path $runtimeRoot "bettercodex.log"
$mutex = New-Object System.Threading.Mutex($false, "Local\BetterCodexCodexWatcher")

if (-not $mutex.WaitOne(0)) { return }

function Write-BetterCodexLog([string]$message) {
    Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) [watcher] $message" -ErrorAction SilentlyContinue
}

function Get-CodexRootProcess([int]$processId) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.Name -ne "ChatGPT.exe" -or $process.CommandLine -match "--type=") { return $null }
    return $process
}

function Start-PatchedCodex([object]$process) {
    if ($process.CommandLine -match "--remote-debugging-port=") { return }
    Write-BetterCodexLog "Intercepting normal Codex launch (PID $($process.ProcessId))."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$startScript`"") `
        -WorkingDirectory $runtimeRoot -WindowStyle Hidden
}

$seen = New-Object 'System.Collections.Generic.HashSet[int]'
try {
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -notmatch "--type=" }
    foreach ($process in $existing) {
        if ($IgnoreExisting) {
            [void]$seen.Add([int]$process.ProcessId)
            Write-BetterCodexLog "Leaving existing Codex PID $($process.ProcessId) untouched."
        }
    }

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
