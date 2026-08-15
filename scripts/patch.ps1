[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildRoot = Join-Path $repoRoot "dist"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$programsRoot = Join-Path $localAppData "Programs"
$installRoot = Join-Path $programsRoot "BetterCodex"
$stageRoot = Join-Path $programsRoot "BetterCodex.installing.$PID"
$backupRoot = Join-Path $programsRoot "BetterCodex.previous.$PID"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$installActions = Join-Path $repoRoot "installer\Install-Actions.ps1"

function Assert-ChildPath([string]$path, [string]$parent) {
    $fullPath = [IO.Path]::GetFullPath($path)
    $fullParent = [IO.Path]::GetFullPath($parent).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($fullParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside $parent."
    }
}

foreach ($path in @($installRoot, $stageRoot, $backupRoot)) { Assert-ChildPath $path $programsRoot }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found on PATH. Install Node.js 22 or newer first."
}

& node (Join-Path $repoRoot "scripts\build.mjs")
if ($LASTEXITCODE -ne 0) { throw "BetterCodex build failed." }

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the previous runtime before updating")) {
    & $installActions -Action PrepareInstall
}

if ($PSCmdlet.ShouldProcess($installRoot, "Install the BetterCodex runtime transactionally")) {
    New-Item -ItemType Directory -Path $programsRoot -Force | Out-Null
    if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
    if (Test-Path -LiteralPath $backupRoot) { Remove-Item -LiteralPath $backupRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $buildRoot "*") -Destination $stageRoot -Recurse -Force
    try {
        if (Test-Path -LiteralPath $installRoot) { Move-Item -LiteralPath $installRoot -Destination $backupRoot }
        Move-Item -LiteralPath $stageRoot -Destination $installRoot
        if (Test-Path -LiteralPath $backupRoot) { Remove-Item -LiteralPath $backupRoot -Recurse -Force }
    } catch {
        if ((-not (Test-Path -LiteralPath $installRoot)) -and (Test-Path -LiteralPath $backupRoot)) {
            Move-Item -LiteralPath $backupRoot -Destination $installRoot
        }
        throw
    } finally {
        if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
    }
}

if ($PSCmdlet.ShouldProcess("BetterCodex startup entry", "Start the tray manager with Windows")) {
    New-Item -Path $runKey -Force | Out-Null
    $managerPath = Join-Path $installRoot "BetterCodex.Manager.exe"
    Set-ItemProperty -LiteralPath $runKey -Name "BetterCodex" -Value "`"$managerPath`" --startup"
    & $installActions -Action CompleteInstall
    Start-Process -FilePath $managerPath
}

if ($WhatIfPreference) {
    Write-Host "BetterCodex patch dry run completed."
} else {
    Write-Host "BetterCodex is patched. Its tray manager is watching for verified Codex launches."
}
