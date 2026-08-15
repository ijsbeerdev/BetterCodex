[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$programsRoot = Join-Path $localAppData "Programs"
$installRoot = Join-Path $programsRoot "BetterCodex"
$installActions = Join-Path $repoRoot "installer\Install-Actions.ps1"

$fullInstallRoot = [IO.Path]::GetFullPath($installRoot)
$fullProgramsRoot = [IO.Path]::GetFullPath($programsRoot).TrimEnd('\') + '\'
if (-not $fullInstallRoot.StartsWith($fullProgramsRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a directory outside Local AppData Programs."
}

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the running BetterCodex manager and runtime")) {
    & $installActions -Action StopCurrent
}

if ((Test-Path -LiteralPath $installRoot) -and $PSCmdlet.ShouldProcess($installRoot, "Remove the BetterCodex runtime")) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
}

Write-Host "BetterCodex is unpatched. The official Codex app was not changed, and your preferences remain saved."
