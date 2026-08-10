[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "Blackbox"
$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Blackbox for Codex.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Blackbox for Codex.lnk")
)

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
