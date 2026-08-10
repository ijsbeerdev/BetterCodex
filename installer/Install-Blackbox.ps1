[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$packageRoot = $PSScriptRoot
$runtimeSource = Join-Path $packageRoot "runtime"
$nodeSource = Join-Path $packageRoot "node"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "Blackbox"
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Blackbox for Codex.lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Blackbox for Codex.lnk"
$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "Blackbox Codex Watcher.lnk"

if (-not (Test-Path -LiteralPath (Join-Path $runtimeSource "package.json"))) {
    throw "The Blackbox runtime is missing. Extract the entire release ZIP before running the installer."
}
if (-not (Test-Path -LiteralPath (Join-Path $nodeSource "node.exe"))) {
    throw "The bundled Blackbox runtime is missing. Extract the entire release ZIP before running the installer."
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw "This Blackbox release supports 64-bit Windows only."
}

$codexPackage = Get-AppxPackage -Name OpenAI.Codex |
    Sort-Object Version -Descending |
    Select-Object -First 1
if ($null -eq $codexPackage) {
    throw "The official Codex Windows app is not installed."
}
if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install outside Local AppData."
}

if ($PSCmdlet.ShouldProcess("Blackbox runtime processes", "Stop the previous runtime before updating")) {
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

if ($PSCmdlet.ShouldProcess($installRoot, "Install the Blackbox runtime")) {
    if (Test-Path -LiteralPath $installRoot) {
        Remove-Item -LiteralPath $installRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $runtimeSource "*") -Destination $installRoot -Recurse -Force
    Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $installRoot "node") -Recurse -Force
}

# Remove registrations left by pre-patcher Blackbox builds.
if (Get-Command codex -ErrorAction SilentlyContinue) {
    $savedErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        if ($PSCmdlet.ShouldProcess("blackbox@blackbox", "Remove the old Blackbox native plugin")) {
            & codex plugin remove blackbox@blackbox --json 2>$null | Out-Null
        }
        if ($PSCmdlet.ShouldProcess("blackbox", "Remove the old Blackbox marketplace")) {
            & codex plugin marketplace remove blackbox --json 2>$null | Out-Null
        }
    } finally {
        $ErrorActionPreference = $savedErrorPreference
    }
}

function New-BlackboxShortcut([string]$path, [string]$scriptName, [string]$description) {
    if (-not $PSCmdlet.ShouldProcess($path, "Create Blackbox shortcut")) { return }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $installRoot $scriptName)
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = $description
    $shortcut.IconLocation = "$(Join-Path $codexPackage.InstallLocation 'app\ChatGPT.exe'),0"
    $shortcut.Save()
}

New-BlackboxShortcut $startMenu "start.ps1" "Launch the official Codex app with Blackbox"
New-BlackboxShortcut $desktop "start.ps1" "Launch the official Codex app with Blackbox"
New-BlackboxShortcut $startup "watcher.ps1" "Load Blackbox when the official Codex app starts"

if ($PSCmdlet.ShouldProcess("Blackbox launch watcher", "Start the normal-launch watcher")) {
    $watcherScript = Join-Path $installRoot "watcher.ps1"
    $watcherArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -IgnoreExisting' -f $watcherScript
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $watcherArguments -WorkingDirectory $installRoot -WindowStyle Hidden
}

Write-Host ""
if ($WhatIfPreference) {
    Write-Host "Blackbox installer dry run completed." -ForegroundColor Green
} else {
    Write-Host "Blackbox is installed." -ForegroundColor Green
    Write-Host "Quit Codex completely, then open it normally. The package icon will appear beside Help."
}
