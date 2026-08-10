$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $runtimeRoot "launcher.mjs")
