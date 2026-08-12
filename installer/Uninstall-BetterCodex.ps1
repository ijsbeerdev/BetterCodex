[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$installRoot = Join-Path $localAppData "BetterCodex"
$watcherTaskName = "BetterCodex ChatGPT Codex Watcher"
$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath("Programs")) "BetterCodex for ChatGPT Codex.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "BetterCodex for ChatGPT Codex.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Startup")) "BetterCodex ChatGPT Codex Watcher.lnk")
)

if (-not $installRoot.StartsWith($localAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a directory outside Local AppData."
}

if ($PSCmdlet.ShouldProcess("BetterCodex runtime processes", "Stop the running BetterCodex runtime")) {
    Stop-ScheduledTask -TaskName $watcherTaskName -ErrorAction SilentlyContinue
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

if ($PSCmdlet.ShouldProcess($watcherTaskName, "Remove the BetterCodex launch watcher")) {
    Unregister-ScheduledTask -TaskName $watcherTaskName -Confirm:$false -ErrorAction SilentlyContinue
}

foreach ($shortcut in $shortcuts) {
    if ((Test-Path -LiteralPath $shortcut) -and $PSCmdlet.ShouldProcess($shortcut, "Remove BetterCodex shortcut")) {
        Remove-Item -LiteralPath $shortcut -Force
    }
}

if ((Test-Path -LiteralPath $installRoot) -and $PSCmdlet.ShouldProcess($installRoot, "Remove the BetterCodex runtime")) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
}

Write-Host ""
Write-Host "BetterCodex is uninstalled. The official ChatGPT Codex app was not changed." -ForegroundColor Green
Write-Host "Your BetterCodex preferences remain saved in the Windows user profile for a future reinstall."
