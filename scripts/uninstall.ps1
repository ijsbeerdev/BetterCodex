[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI was not found on PATH."
}

$installed = (& codex plugin list --json | ConvertFrom-Json).installed
foreach ($plugin in ($installed | Where-Object { $_.marketplaceName -eq "blackbox" })) {
    if ($PSCmdlet.ShouldProcess($plugin.pluginId, "Remove Blackbox plugin")) {
        & codex plugin remove $plugin.pluginId --json
        if ($LASTEXITCODE -ne 0) { throw "Could not remove $($plugin.pluginId)." }
    }
}

$marketplaces = (& codex plugin marketplace list --json | ConvertFrom-Json).marketplaces
if (($marketplaces | Where-Object { $_.name -eq "blackbox" }) -and $PSCmdlet.ShouldProcess("blackbox", "Remove Blackbox marketplace")) {
    & codex plugin marketplace remove blackbox --json
    if ($LASTEXITCODE -ne 0) { throw "Could not remove the Blackbox marketplace." }
}

Write-Host "Blackbox uninstall complete. Repository files were preserved."
