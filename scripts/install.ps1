[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Replace
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI was not found on PATH. Install or update the ChatGPT desktop app first."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $repoRoot ".agents\plugins\marketplace.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Blackbox marketplace manifest not found at $manifestPath"
}

$marketplaces = (& codex plugin marketplace list --json | ConvertFrom-Json).marketplaces
if ($LASTEXITCODE -ne 0) { throw "Could not read configured Codex marketplaces." }
$registered = $marketplaces | Where-Object { $_.name -eq "blackbox" } | Select-Object -First 1

if ($registered -and ((Resolve-Path -LiteralPath $registered.root).Path -ne $repoRoot)) {
    if (-not $Replace) {
        throw "Blackbox is registered from '$($registered.root)'. Re-run with -Replace to migrate it to '$repoRoot'."
    }
    if ($PSCmdlet.ShouldProcess("blackbox", "Remove the previous Blackbox marketplace registration")) {
        $installed = (& codex plugin list --json | ConvertFrom-Json).installed
        foreach ($plugin in ($installed | Where-Object { $_.marketplaceName -eq "blackbox" })) {
            & codex plugin remove $plugin.pluginId --json
            if ($LASTEXITCODE -ne 0) { throw "Could not remove $($plugin.pluginId)." }
        }
        & codex plugin marketplace remove blackbox --json
        if ($LASTEXITCODE -ne 0) { throw "Could not remove the previous Blackbox marketplace." }
        $registered = $null
    }
}

if (-not $registered -and $PSCmdlet.ShouldProcess($repoRoot, "Register the Blackbox marketplace")) {
    & codex plugin marketplace add $repoRoot --json
    if ($LASTEXITCODE -ne 0) { throw "Could not register the Blackbox marketplace." }
}

if ($WhatIfPreference) { return }

$installed = (& codex plugin list --json | ConvertFrom-Json).installed
if (-not ($installed | Where-Object { $_.pluginId -eq "blackbox@blackbox" })) {
    & codex plugin add blackbox@blackbox --json
    if ($LASTEXITCODE -ne 0) { throw "Could not install Blackbox." }
}

Write-Host "Blackbox is installed. Fully restart ChatGPT, then open Plugins > Blackbox."
