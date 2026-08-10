[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "Blackbox"
$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Blackbox for Codex.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Blackbox for Codex.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Startup")) "Blackbox Codex Watcher.lnk")
)

if ($PSCmdlet.ShouldProcess("Blackbox runtime processes", "Stop the running Blackbox runtime")) {
    $runtimeProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*${installRoot}\watcher.ps1*" -or
            $_.CommandLine -like "*${installRoot}\start.ps1*" -or
            $_.CommandLine -like "*${installRoot}\launcher.mjs*"
        } |
        Select-Object -ExpandProperty ProcessId)
    foreach ($processId in $runtimeProcesses) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
    foreach ($processId in $runtimeProcesses) { Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue }
}

foreach ($shortcut in $shortcuts) {
    if ((Test-Path -LiteralPath $shortcut) -and $PSCmdlet.ShouldProcess($shortcut, "Remove Blackbox shortcut")) {
        Remove-Item -LiteralPath $shortcut -Force
    }
}

if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a directory outside Local AppData."
}
if ((Test-Path -LiteralPath $installRoot) -and $PSCmdlet.ShouldProcess($installRoot, "Remove the Blackbox runtime")) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
}

Write-Host "Blackbox is unpatched. The official Codex installation was not changed."
