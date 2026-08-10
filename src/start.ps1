$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction Stop).Source
$mutex = New-Object System.Threading.Mutex($false, "Local\BlackboxCodexLauncher")
if (-not $mutex.WaitOne(15000)) { return }
try {
    & $node (Join-Path $runtimeRoot "launcher.mjs")
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
