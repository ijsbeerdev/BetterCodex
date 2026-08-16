[CmdletBinding()]
param(
    [switch]$Managed,
    [switch]$SelfTest,
    [switch]$Once
)

$ErrorActionPreference = "Stop"
$runtimeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $runtimeRoot "start.ps1"
$launcherPath = Join-Path $runtimeRoot "launcher.mjs"
$dataRoot = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "BetterCodex"
$logRoot = Join-Path $dataRoot "Logs"
$logPath = Join-Path $logRoot "bettercodex.log"
$statusPath = Join-Path $dataRoot "watcher-status.json"
$settingsPath = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "BetterCodex\watcher-settings.json"
$commandPath = Join-Path $dataRoot "watcher-command.json"
$launchRequestPath = Join-Path $dataRoot "launch-request.json"
$debugPort = if ($env:BETTERCODEX_DEBUG_PORT) { [int]$env:BETTERCODEX_DEBUG_PORT } else { 11983 }
$mutex = New-Object System.Threading.Mutex($false, "Local\BetterCodexCodexWatcher")
$ownsMutex = $false
$watcherSource = "BetterCodex.ProcessStart.$PID"
$currentSessionId = [System.Diagnostics.Process]::GetCurrentProcess().SessionId
$lastStatusState = $null
$lastStatusMessage = $null

function Write-BetterCodexLog([string]$message) {
    try {
        if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 2MB) {
            $archivePath = Join-Path $logRoot "bettercodex.previous.log"
            Move-Item -LiteralPath $logPath -Destination $archivePath -Force
        }
        Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) [watcher] $message" -ErrorAction SilentlyContinue
    } catch {}
}

function Write-BetterCodexJson([string]$path, [object]$value) {
    $parent = Split-Path -Parent $path
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $temporaryPath = "$path.$PID.tmp"
    $value | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
    Move-Item -LiteralPath $temporaryPath -Destination $path -Force
}

function Write-BetterCodexStatus([string]$state, [string]$message, [Nullable[int]]$codexPid = $null) {
    if ($state -eq $lastStatusState -and $message -eq $lastStatusMessage -and (Test-Path -LiteralPath $statusPath)) { return }
    $script:lastStatusState = $state
    $script:lastStatusMessage = $message
    Write-BetterCodexJson $statusPath ([ordered]@{
        state = $state
        message = $message
        paused = Test-BetterCodexPaused
        updatedAt = (Get-Date).ToUniversalTime().ToString("o")
        watcherPid = $PID
        codexPid = $codexPid
    })
}

function Test-BetterCodexPaused {
    try {
        if (-not (Test-Path -LiteralPath $settingsPath)) { return $false }
        return [bool]((Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json).paused)
    } catch {
        Write-BetterCodexLog "Could not read watcher settings: $($_.Exception.Message)"
        return $false
    }
}

function Get-BetterCodexExecutable {
    $package = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue |
        Sort-Object Version -Descending |
        Select-Object -First 1
    if ($null -eq $package) { return $null }
    $candidate = Join-Path $package.InstallLocation "app\ChatGPT.exe"
    if (-not (Test-Path -LiteralPath $candidate)) { return $null }
    return [IO.Path]::GetFullPath($candidate)
}

function Test-BetterCodexCandidate([object]$process, [string]$expectedExecutable, [int]$sessionId = $currentSessionId) {
    if ($null -eq $process -or [string]::IsNullOrWhiteSpace($expectedExecutable)) { return $false }
    $processPath = [string]$process.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($processPath)) {
        try { $processPath = (Get-Process -Id ([int]$process.ProcessId) -ErrorAction Stop).Path } catch { return $false }
    }
    try { $processPath = [IO.Path]::GetFullPath($processPath) } catch { return $false }
    if (-not $processPath.Equals($expectedExecutable, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    if ($null -ne $process.SessionId -and [int]$process.SessionId -ne $sessionId) { return $false }
    if ([string]$process.CommandLine -match '(?:^|\s)--type(?:=|\s)') { return $false }
    return $true
}

function Test-BetterCodexPatched([object]$process) {
    $portPattern = [Regex]::Escape([string]$debugPort)
    return [string]$process.CommandLine -match "(?:^|\s)--remote-debugging-port(?:=|\s+)$portPattern(?:\s|$)"
}

function Get-BetterCodexProcesses([string]$expectedExecutable) {
    if ([string]::IsNullOrWhiteSpace($expectedExecutable)) { return @() }
    return @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction SilentlyContinue |
        Where-Object { Test-BetterCodexCandidate $_ $expectedExecutable })
}

function Test-BetterCodexRuntimeRunning {
    $runtime = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*$startScript*" -or
            $_.CommandLine -like "*$launcherPath*"
        } |
        Select-Object -First 1
    return $null -ne $runtime
}

function Start-BetterCodexRuntime {
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -ArgumentList @("-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$startScript`"") `
        -WorkingDirectory $runtimeRoot -WindowStyle Hidden
}

function ConvertFrom-BetterCodexCommandLine([string]$commandLine) {
    if ([string]::IsNullOrWhiteSpace($commandLine)) { return @() }
    if (-not ("BetterCodex.CommandLine" -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace BetterCodex {
    internal static class CommandLine {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string commandLine, out int argc);
        [DllImport("kernel32.dll")]
        private static extern IntPtr LocalFree(IntPtr value);
        internal static string[] Split(string commandLine) {
            int argc;
            IntPtr argv = CommandLineToArgvW(commandLine, out argc);
            if (argv == IntPtr.Zero) return new string[0];
            try {
                string[] result = new string[argc];
                for (int i = 0; i < argc; i++) result[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(argv, i * IntPtr.Size));
                return result;
            } finally { LocalFree(argv); }
        }
    }
}
'@
    }
    try { return @([BetterCodex.CommandLine]::Split($commandLine)) } catch { return @() }
}

function Save-BetterCodexLaunchRequest([object]$process) {
    $parts = @(ConvertFrom-BetterCodexCommandLine ([string]$process.CommandLine))
    $arguments = if ($parts.Count -gt 1) { @($parts[1..($parts.Count - 1)]) } else { @() }
    $safeArguments = New-Object 'System.Collections.Generic.List[string]'
    $skipNext = $false
    foreach ($argument in $arguments) {
        if ($skipNext) { $skipNext = $false; continue }
        if ($argument -match '^--remote-debugging-(port|address)$') { $skipNext = $true; continue }
        if ($argument -match '^--remote-(debugging-port|debugging-address|allow-origins)=') { continue }
        if ($argument -match '^--type(?:=|$)') { continue }
        [void]$safeArguments.Add($argument)
    }
    Write-BetterCodexJson $launchRequestPath ([ordered]@{
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        arguments = @($safeArguments)
    })
}

function Stop-BetterCodexGracefully([object]$process) {
    $processId = [int]$process.ProcessId
    try {
        $nativeProcess = Get-Process -Id $processId -ErrorAction Stop
        if ($nativeProcess.CloseMainWindow()) {
            try { Wait-Process -Id $processId -Timeout 2 -ErrorAction Stop; return } catch {}
        }
    } catch {}
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $processId -Timeout 10 -ErrorAction SilentlyContinue
}

function Restart-CodexWithBetterCodex([object]$process) {
    $processId = [int]$process.ProcessId
    Write-BetterCodexLog "Intercepting verified Codex launch (PID $processId)."
    Write-BetterCodexStatus "relaunching" "Restarting Codex with BetterCodex…" $processId
    Save-BetterCodexLaunchRequest $process
    Stop-BetterCodexGracefully $process
    Start-BetterCodexRuntime
}

function Stop-BetterCodexRuntimeProcesses {
    $processIds = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessId -ne $PID -and (
                $_.CommandLine -like "*$startScript*" -or
                $_.CommandLine -like "*$launcherPath*"
            )
        } | Select-Object -ExpandProperty ProcessId)
    foreach ($processId in $processIds) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
}

function Invoke-BetterCodexCommand {
    if (-not (Test-Path -LiteralPath $commandPath)) { return }
    try {
        $command = Get-Content -LiteralPath $commandPath -Raw | ConvertFrom-Json
        Remove-Item -LiteralPath $commandPath -Force -ErrorAction SilentlyContinue
        if ($command.action -eq "restart-runtime") {
            Write-BetterCodexLog "Restarting the runtime at the user's request."
            Stop-BetterCodexRuntimeProcesses
            Start-BetterCodexRuntime
        }
    } catch {
        Write-BetterCodexLog "Could not process watcher command: $($_.Exception.Message)"
        Remove-Item -LiteralPath $commandPath -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-BetterCodexScan([string]$expectedExecutable, [switch]$AllowIntercept) {
    if ([string]::IsNullOrWhiteSpace($expectedExecutable)) {
        Write-BetterCodexStatus "error" "The official ChatGPT Codex app is not installed."
        return
    }
    $processes = @(Get-BetterCodexProcesses $expectedExecutable)
    $patched = $processes | Where-Object { Test-BetterCodexPatched $_ } | Select-Object -First 1
    if ($null -ne $patched) {
        if (-not (Test-BetterCodexRuntimeRunning)) {
            Write-BetterCodexLog "Attaching the refreshed BetterCodex runtime to verified Codex PID $($patched.ProcessId)."
            Start-BetterCodexRuntime
        }
        Write-BetterCodexStatus "active" "BetterCodex is attached to Codex." ([int]$patched.ProcessId)
        return
    }
    if ($processes.Count -gt 0 -and $AllowIntercept -and -not (Test-BetterCodexPaused)) {
        Restart-CodexWithBetterCodex ($processes | Select-Object -First 1)
        return
    }
    if (Test-BetterCodexPaused) {
        Write-BetterCodexStatus "paused" "Automatic Codex enhancement is paused."
    } elseif ($processes.Count -gt 0) {
        Write-BetterCodexStatus "waiting" "Codex is running without BetterCodex."
    } else {
        Write-BetterCodexStatus "ready" "Watching for Codex."
    }
}

function Invoke-BetterCodexSelfTest {
    $expected = "C:\Program Files\WindowsApps\OpenAI.Codex_1.0.0.0_x64__example\app\ChatGPT.exe"
    $valid = [pscustomobject]@{ ProcessId = 12; ExecutablePath = $expected; SessionId = $currentSessionId; CommandLine = "`"$expected`" --foo" }
    $wrongPath = [pscustomobject]@{ ProcessId = 13; ExecutablePath = "C:\Program Files\ChatGPT\ChatGPT.exe"; SessionId = $currentSessionId; CommandLine = '"C:\Program Files\ChatGPT\ChatGPT.exe"' }
    $renderer = [pscustomobject]@{ ProcessId = 14; ExecutablePath = $expected; SessionId = $currentSessionId; CommandLine = "`"$expected`" --type=renderer" }
    if (-not (Test-BetterCodexCandidate $valid $expected)) { throw "A verified Codex root process was rejected." }
    if (Test-BetterCodexCandidate $wrongPath $expected) { throw "An unrelated ChatGPT executable was accepted." }
    if (Test-BetterCodexCandidate $renderer $expected) { throw "A renderer process was accepted." }
    $valid.CommandLine = "`"$expected`" --remote-debugging-port=$debugPort"
    if (-not (Test-BetterCodexPatched $valid)) { throw "The BetterCodex debugger port was not recognized." }
    $valid.CommandLine = "`"$expected`" --remote-debugging-port=9222"
    if (Test-BetterCodexPatched $valid) { throw "A foreign debugger port was accepted." }
    Write-Output "BetterCodex watcher self-test passed."
}

if ($SelfTest) {
    try { Invoke-BetterCodexSelfTest } finally { $mutex.Dispose() }
    return
}

New-Item -ItemType Directory -Path $dataRoot, $logRoot -Force | Out-Null

try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
        Write-BetterCodexLog "Recovered the launch watcher after an interrupted previous session."
    }
    if (-not $ownsMutex) { return }

    $expectedExecutable = Get-BetterCodexExecutable
    Write-BetterCodexLog "Event-driven launch watcher ready for $expectedExecutable."
    if ($Once) {
        Invoke-BetterCodexScan $expectedExecutable -AllowIntercept
        return
    }

    $eventDriven = $true
    try {
        Register-CimIndicationEvent -Namespace root/cimv2 `
            -Query "SELECT * FROM Win32_ProcessStartTrace WHERE ProcessName = 'ChatGPT.exe'" `
            -SourceIdentifier $watcherSource | Out-Null
    } catch {
        $eventDriven = $false
        Write-BetterCodexLog "Process-start events are unavailable; using a two-second fallback scan: $($_.Exception.Message)"
        # Polling is a fully supported fallback on systems where process-start
        # event subscriptions are unavailable to a standard user. Keep the
        # tray healthy instead of presenting a false warning at Windows login.
        Write-BetterCodexStatus "ready" "Watching for Codex."
    }

    Invoke-BetterCodexScan $expectedExecutable -AllowIntercept
    $nextHealthCheck = Get-Date
    $nextExecutableRefresh = (Get-Date).AddMinutes(1)
    while ($true) {
        Invoke-BetterCodexCommand
        $paused = Test-BetterCodexPaused
        if ($eventDriven) {
            $event = Wait-Event -SourceIdentifier $watcherSource -Timeout 1 -ErrorAction SilentlyContinue
            if ($null -ne $event) {
                $eventProcessId = [int]$event.SourceEventArgs.NewEvent.ProcessID
                $eventSessionId = [int]$event.SourceEventArgs.NewEvent.SessionID
                Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
                if (-not $paused -and $eventSessionId -eq $currentSessionId) {
                    $process = $null
                    for ($attempt = 0; $attempt -lt 8 -and $null -eq $process; $attempt += 1) {
                        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $eventProcessId" -ErrorAction SilentlyContinue
                        if ($null -eq $process -or [string]::IsNullOrWhiteSpace([string]$process.CommandLine)) {
                            $process = $null
                            Start-Sleep -Milliseconds 50
                        }
                    }
                    if (-not (Test-BetterCodexCandidate $process $expectedExecutable)) {
                        $refreshedExecutable = Get-BetterCodexExecutable
                        if (-not [string]::IsNullOrWhiteSpace($refreshedExecutable)) { $expectedExecutable = $refreshedExecutable }
                    }
                    if (Test-BetterCodexCandidate $process $expectedExecutable) {
                        if (Test-BetterCodexPatched $process) {
                            Write-BetterCodexStatus "active" "BetterCodex is attached to Codex." $eventProcessId
                        } else {
                            Restart-CodexWithBetterCodex $process
                        }
                    }
                }
            }
        } else {
            Start-Sleep -Seconds 2
            Invoke-BetterCodexScan $expectedExecutable -AllowIntercept
        }

        $now = Get-Date
        if ($now -ge $nextExecutableRefresh) {
            $nextExecutableRefresh = $now.AddMinutes(1)
            $refreshedExecutable = Get-BetterCodexExecutable
            if (-not [string]::IsNullOrWhiteSpace($refreshedExecutable) -and
                -not $refreshedExecutable.Equals($expectedExecutable, [StringComparison]::OrdinalIgnoreCase)) {
                Write-BetterCodexLog "Codex package path changed to $refreshedExecutable."
                $expectedExecutable = $refreshedExecutable
            }
        }
        if ($now -ge $nextHealthCheck) {
            $nextHealthCheck = $now.AddSeconds(2)
            Invoke-BetterCodexScan $expectedExecutable
        }
    }
} catch {
    Write-BetterCodexLog "Watcher failed: $($_.Exception.Message)"
    Write-BetterCodexStatus "error" "Watcher failed: $($_.Exception.Message)"
    throw
} finally {
    Unregister-Event -SourceIdentifier $watcherSource -ErrorAction SilentlyContinue
    Get-Event -SourceIdentifier $watcherSource -ErrorAction SilentlyContinue | Remove-Event -ErrorAction SilentlyContinue
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
