[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$packageRoot = $PSScriptRoot
$runtimeSource = Join-Path $packageRoot "runtime"
$nodeSource = Join-Path $packageRoot "node"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "BetterCodex"
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "BetterCodex for ChatGPT Codex.lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "BetterCodex for ChatGPT Codex.lnk"
$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "BetterCodex ChatGPT Codex Watcher.lnk"
$notificationMarker = Join-Path $installRoot "patch-notification-pending"

if (-not (Test-Path -LiteralPath (Join-Path $runtimeSource "package.json"))) {
    throw "The BetterCodex runtime is missing. Extract the entire release ZIP before running the installer."
}
if (-not (Test-Path -LiteralPath (Join-Path $nodeSource "node.exe"))) {
    throw "The bundled BetterCodex runtime is missing. Extract the entire release ZIP before running the installer."
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw "This BetterCodex release supports 64-bit Windows only."
}

$codexPackage = Get-AppxPackage -Name OpenAI.Codex |
    Sort-Object Version -Descending |
    Select-Object -First 1
if ($null -eq $codexPackage) {
    throw "The official ChatGPT Codex Windows app is not installed."
}
if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install outside Local AppData."
}

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the previous runtime before updating")) {
    $runtimeProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*$installRoot\watcher.ps1*" -or
            $_.CommandLine -like "*$installRoot\start.ps1*" -or
            $_.CommandLine -like "*$installRoot\launcher.mjs*"
        } |
        Select-Object -ExpandProperty ProcessId)
    foreach ($processId in $runtimeProcesses) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    foreach ($processId in $runtimeProcesses) {
        Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue
    }
}

if ($PSCmdlet.ShouldProcess($installRoot, "Install the BetterCodex runtime")) {
    if (Test-Path -LiteralPath $installRoot) {
        Remove-Item -LiteralPath $installRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $runtimeSource "*") -Destination $installRoot -Recurse -Force
    Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $installRoot "node") -Recurse -Force
}

function New-BetterCodexShortcut([string]$path, [string]$scriptName, [string]$description) {
    if (-not $PSCmdlet.ShouldProcess($path, "Create BetterCodex shortcut")) { return }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $installRoot $scriptName)
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = $description
    $shortcut.IconLocation = "$(Join-Path $codexPackage.InstallLocation 'app\ChatGPT.exe'),0"
    $shortcut.Save()
}

New-BetterCodexShortcut $startMenu "start.ps1" "Launch the official ChatGPT Codex app with BetterCodex"
New-BetterCodexShortcut $desktop "start.ps1" "Launch the official ChatGPT Codex app with BetterCodex"
New-BetterCodexShortcut $startup "watcher.ps1" "Load BetterCodex when the official ChatGPT Codex app starts"

if ($PSCmdlet.ShouldProcess($notificationMarker, "Queue the successful patch notification")) {
    New-Item -ItemType File -Path $notificationMarker -Force | Out-Null
}

if ($PSCmdlet.ShouldProcess("BetterCodex launch watcher", "Start the normal-launch watcher")) {
    $watcherScript = Join-Path $installRoot "watcher.ps1"
    $watcherArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $watcherScript
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $watcherArguments -WorkingDirectory $installRoot -WindowStyle Hidden
}

Write-Host ""
if ($WhatIfPreference) {
    Write-Host "BetterCodex installer dry run completed." -ForegroundColor Green
} else {
    Write-Host "BetterCodex is installed." -ForegroundColor Green
    Write-Host "The launch watcher is active. An open Codex window may briefly restart, then the package icon will appear beside Help."
}
