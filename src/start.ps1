$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledNode = Join-Path $runtimeRoot "node\node.exe"
if (Test-Path -LiteralPath $bundledNode) {
    $node = $bundledNode
} else {
    $node = (Get-Command node -ErrorAction Stop).Source
}
$mutex = New-Object System.Threading.Mutex($false, "Local\BlackboxCodexLauncher")
if (-not $mutex.WaitOne(15000)) { return }
try {
    & $node (Join-Path $runtimeRoot "launcher.mjs")
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
