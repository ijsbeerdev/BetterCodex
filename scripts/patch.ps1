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
$watcherTaskName = "BetterCodex ChatGPT Codex Watcher"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found on PATH. Install Node.js 22 or newer first."
}

& node (Join-Path $repoRoot "scripts\build.mjs")
if ($LASTEXITCODE -ne 0) { throw "BetterCodex build failed." }

if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install outside Local AppData."
}

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the previous runtime before updating")) {
    Stop-ScheduledTask -TaskName $watcherTaskName -ErrorAction SilentlyContinue
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

foreach ($legacyShortcut in @($startMenu, $desktop, $startup)) {
    if ((Test-Path -LiteralPath $legacyShortcut) -and $PSCmdlet.ShouldProcess($legacyShortcut, "Remove the legacy BetterCodex shortcut")) {
        Remove-Item -LiteralPath $legacyShortcut -Force
    }
}

if ($PSCmdlet.ShouldProcess($watcherTaskName, "Register the background per-user launch watcher")) {
    $watcherScript = Join-Path $installRoot "watcher.ps1"
    $powerShellPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $watcherArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $watcherScript
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $watcherArguments -WorkingDirectory $installRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings
    Register-ScheduledTask -TaskName $watcherTaskName -InputObject $task -Force | Out-Null
    Start-ScheduledTask -TaskName $watcherTaskName
}

if ($WhatIfPreference) {
    Write-Host "BetterCodex patch dry run completed."
} else {
    Write-Host "BetterCodex is patched and its background launch watcher is active. An open Codex window may briefly restart while BetterCodex loads."
}
