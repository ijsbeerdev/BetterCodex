[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("PrepareInstall", "CompleteInstall", "StopCurrent")]
    [string]$Action
)

$ErrorActionPreference = "Stop"
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$legacyRoot = Join-Path $localAppData "BetterCodex"
$installRoot = Join-Path $localAppData "Programs\BetterCodex"
$watcherTaskName = "BetterCodex ChatGPT Codex Watcher"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

function Assert-BetterCodexPath([string]$path, [string]$parent) {
    $fullPath = [IO.Path]::GetFullPath($path)
    $fullParent = [IO.Path]::GetFullPath($parent).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($fullParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside $parent."
    }
}

function Stop-BetterCodexManager([string]$root) {
    $manager = Join-Path $root "BetterCodex.Manager.exe"
    if (Test-Path -LiteralPath $manager) {
        $process = Start-Process -FilePath $manager -ArgumentList "--shutdown" -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -ne 0) { Write-Warning "The BetterCodex manager did not stop within ten seconds." }
    }
}

function Stop-BetterCodexRuntime([string[]]$roots) {
    $processIds = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $commandLine = [string]$_.CommandLine
            $matchesRoot = $false
            foreach ($root in $roots) {
                if ($commandLine -like "*$root\watcher.ps1*" -or
                    $commandLine -like "*$root\start.ps1*" -or
                    $commandLine -like "*$root\launcher.mjs*" -or
                    $commandLine -like "*$root\BetterCodex.Manager.exe*") {
                    $matchesRoot = $true
                    break
                }
            }
            $matchesRoot
        } | Select-Object -ExpandProperty ProcessId -Unique)
    foreach ($processId in $processIds) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
    foreach ($processId in $processIds) { Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue }
}

function Remove-LegacyIntegration {
    Stop-ScheduledTask -TaskName $watcherTaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $watcherTaskName -Confirm:$false -ErrorAction SilentlyContinue
    foreach ($shortcut in @(
        (Join-Path ([Environment]::GetFolderPath("Programs")) "BetterCodex for ChatGPT Codex.lnk"),
        (Join-Path ([Environment]::GetFolderPath("Desktop")) "BetterCodex for ChatGPT Codex.lnk"),
        (Join-Path ([Environment]::GetFolderPath("Startup")) "BetterCodex ChatGPT Codex Watcher.lnk")
    )) {
        if (Test-Path -LiteralPath $shortcut) { Remove-Item -LiteralPath $shortcut -Force }
    }
}

Assert-BetterCodexPath $legacyRoot $localAppData
Assert-BetterCodexPath $installRoot $localAppData

switch ($Action) {
    "PrepareInstall" {
        $codexPackage = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending |
            Select-Object -First 1
        if ($null -eq $codexPackage -or -not (Test-Path -LiteralPath (Join-Path $codexPackage.InstallLocation "app\ChatGPT.exe"))) {
            throw "The official ChatGPT Codex Windows app is not installed."
        }
        Stop-BetterCodexManager $installRoot
        Remove-LegacyIntegration
        Stop-BetterCodexRuntime @($legacyRoot, $installRoot)
    }
    "CompleteInstall" {
        $containsLegacyRuntime = (Test-Path -LiteralPath (Join-Path $legacyRoot "watcher.ps1")) -or
            (Test-Path -LiteralPath (Join-Path $legacyRoot "package.json"))
        if ($containsLegacyRuntime -and -not $legacyRoot.Equals($installRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $legacyRoot -Recurse -Force
        }
    }
    "StopCurrent" {
        Stop-BetterCodexManager $installRoot
        Stop-BetterCodexRuntime @($installRoot)
        Remove-LegacyIntegration
        if (Test-Path -LiteralPath $runKey) {
            Remove-ItemProperty -LiteralPath $runKey -Name "BetterCodex" -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $legacyRoot) {
            Remove-Item -LiteralPath $legacyRoot -Recurse -Force
        }
    }
}
