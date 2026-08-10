[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildRoot = Join-Path $repoRoot "dist"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "BetterCodex"
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "BetterCodex for ChatGPT Codex.lnk"
$desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "BetterCodex for ChatGPT Codex.lnk"
$startup = Join-Path ([Environment]::GetFolderPath("Startup")) "BetterCodex ChatGPT Codex Watcher.lnk"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found on PATH. Install Node.js 22 or newer first."
}

& node (Join-Path $repoRoot "scripts\build.mjs")
if ($LASTEXITCODE -ne 0) { throw "BetterCodex build failed." }

if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install outside Local AppData."
}

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the previous runtime before updating")) {
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

if ($PSCmdlet.ShouldProcess($installRoot, "Install the BetterCodex runtime")) {
    if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    Copy-Item -Path (Join-Path $buildRoot "*") -Destination $installRoot -Recurse -Force
}

function New-BetterCodexShortcut([string]$path) {
    if (-not $PSCmdlet.ShouldProcess($path, "Create BetterCodex for ChatGPT Codex shortcut")) { return }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'start.ps1')`""
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = "Launch the official ChatGPT Codex app with BetterCodex"
    try {
        $codexRoot = (Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1).InstallLocation
        $shortcut.IconLocation = "$(Join-Path $codexRoot 'app\ChatGPT.exe'),0"
    } catch {}
    $shortcut.Save()
}

New-BetterCodexShortcut $startMenu
New-BetterCodexShortcut $desktop

if ($PSCmdlet.ShouldProcess($startup, "Create the normal-launch watcher")) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($startup)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $installRoot 'watcher.ps1')`""
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = "Load BetterCodex when the official ChatGPT Codex app starts"
    $shortcut.Save()
}

if ($PSCmdlet.ShouldProcess("BetterCodex launch watcher", "Start the watcher without interrupting the current Codex session")) {
    $watcherScript = Join-Path $installRoot "watcher.ps1"
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcherScript`" -IgnoreExisting" `
        -WorkingDirectory $installRoot -WindowStyle Hidden
}

Write-Host "BetterCodex is patched. Quit ChatGPT Codex completely, then launch it normally."
