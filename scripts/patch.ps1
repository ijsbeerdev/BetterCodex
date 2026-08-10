[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildRoot = Join-Path $repoRoot "dist"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "Blackbox"
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Blackbox for Codex.lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Blackbox for Codex.lnk"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found on PATH. Install Node.js 22 or newer first."
}

& node (Join-Path $repoRoot "scripts\build.mjs")
if ($LASTEXITCODE -ne 0) { throw "Blackbox build failed." }

if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install outside Local AppData."
}

if ($PSCmdlet.ShouldProcess($installRoot, "Install the Blackbox runtime")) {
    if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $buildRoot "*") -Destination $installRoot -Recurse -Force
}

# Remove the superseded native-plugin registration, if an earlier Blackbox build installed it.
# Address the known IDs directly because enumeration fails after its old manifest is removed.
if (Get-Command codex -ErrorAction SilentlyContinue) {
    if ($PSCmdlet.ShouldProcess("blackbox@blackbox", "Remove the old Blackbox native plugin")) {
        & codex plugin remove blackbox@blackbox --json 2>$null | Out-Null
    }
    if ($PSCmdlet.ShouldProcess("blackbox", "Remove the old Blackbox marketplace")) {
        & codex plugin marketplace remove blackbox --json 2>$null | Out-Null
    }
}

function New-BlackboxShortcut([string]$path) {
    if (-not $PSCmdlet.ShouldProcess($path, "Create Blackbox for Codex shortcut")) { return }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'start.ps1')`""
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = "Launch the official Codex app with Blackbox"
    try {
        $codexRoot = (Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation
        $shortcut.IconLocation = "$(Join-Path $codexRoot 'app\ChatGPT.exe'),0"
    } catch {}
    $shortcut.Save()
}

New-BlackboxShortcut $startMenu
New-BlackboxShortcut $desktop

Write-Host "Blackbox is patched. Quit Codex completely, then open 'Blackbox for Codex'."
