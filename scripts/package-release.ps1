[CmdletBinding()]
param(
    [string]$NodeArchivePath,
    [string]$InnoCompilerPath,
    [string]$InnoSignToolName
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageInfo = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$packageInfo.version
$numericVersionParts = @($version.Split('-')[0].Split('.'))
while ($numericVersionParts.Count -lt 4) { $numericVersionParts += "0" }
$numericVersion = ($numericVersionParts | Select-Object -First 4) -join "."
$releaseRoot = Join-Path $repoRoot "release"
$stageRoot = Join-Path $releaseRoot "BetterCodex-$version-setup"
$setupPath = Join-Path $releaseRoot "bettercodex-$version-windows-x64-setup.exe"
$cacheRoot = Join-Path $repoRoot ".bettercodex-cache"
$nodeVersion = "24.13.1"
$nodeArchiveName = "node-v$nodeVersion-win-x64.zip"
$expectedNodeArchiveHash = "fba577c4bb87df04d54dd87bbdaa5a2272f1f99a2acbf9152e1a91b8b5f0b279"

function Assert-ChildPath([string]$path, [string]$parent) {
    $fullPath = [IO.Path]::GetFullPath($path)
    $fullParent = [IO.Path]::GetFullPath($parent).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($fullParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside $parent."
    }
}

function Get-Sha256([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Resolve-InnoCompiler([string]$requestedPath) {
    if ($requestedPath) { return (Resolve-Path -LiteralPath $requestedPath).Path }
    $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($candidate in @(
        (Join-Path $cacheRoot "inno-7\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 7\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 7\ISCC.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
    )) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    throw "Inno Setup was not found. Install it or pass -InnoCompilerPath to build the release installer."
}

Assert-ChildPath $stageRoot $repoRoot
Assert-ChildPath $setupPath $repoRoot
Assert-ChildPath $cacheRoot $repoRoot

$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $repoRoot "scripts\build.mjs") --release
if ($LASTEXITCODE -ne 0) { throw "BetterCodex release build failed." }

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
if (Test-Path -LiteralPath $setupPath) { Remove-Item -LiteralPath $setupPath -Force }
New-Item -ItemType Directory -Path (Join-Path $stageRoot "runtime") -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot "dist\*") -Destination (Join-Path $stageRoot "runtime") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "installer\Install-Actions.ps1") -Destination $stageRoot

New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
if (-not $NodeArchivePath) {
    $NodeArchivePath = Join-Path $cacheRoot $nodeArchiveName
    if (-not (Test-Path -LiteralPath $NodeArchivePath)) {
        Write-Host "Downloading the pinned Node.js $nodeVersion runtime..."
        Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v$nodeVersion/$nodeArchiveName" -OutFile $NodeArchivePath
    }
}
$NodeArchivePath = (Resolve-Path -LiteralPath $NodeArchivePath).Path
$actualHash = Get-Sha256 $NodeArchivePath
if ($actualHash -ne $expectedNodeArchiveHash) {
    throw "Node.js archive checksum mismatch. Expected $expectedNodeArchiveHash but received $actualHash."
}

$nodeExtractRoot = Join-Path $cacheRoot "node-$nodeVersion"
Assert-ChildPath $nodeExtractRoot $repoRoot
if (Test-Path -LiteralPath $nodeExtractRoot) { Remove-Item -LiteralPath $nodeExtractRoot -Recurse -Force }
Expand-Archive -LiteralPath $NodeArchivePath -DestinationPath $nodeExtractRoot -Force
$nodeDistribution = Join-Path $nodeExtractRoot "node-v$nodeVersion-win-x64"
$bundledNodeRoot = Join-Path $stageRoot "node"
New-Item -ItemType Directory -Path $bundledNodeRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $nodeDistribution "node.exe") -Destination (Join-Path $bundledNodeRoot "node.exe")
Copy-Item -LiteralPath (Join-Path $nodeDistribution "LICENSE") -Destination (Join-Path $bundledNodeRoot "LICENSE")

$compiler = Resolve-InnoCompiler $InnoCompilerPath
$arguments = @(
    "/DAppVersion=$version",
    "/DAppNumericVersion=$numericVersion",
    "/DStageRoot=$stageRoot",
    "/DOutputDir=$releaseRoot"
)
if ($InnoSignToolName) { $arguments += "/DSignToolName=$InnoSignToolName" }
$arguments += (Join-Path $repoRoot "installer\BetterCodex.iss")
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw "BetterCodex setup compilation failed." }
if (-not (Test-Path -LiteralPath $setupPath)) { throw "The expected setup executable was not created at $setupPath." }

$setup = Get-Item -LiteralPath $setupPath
$setupHash = Get-Sha256 $setupPath
$checksumPath = "$setupPath.sha256"
Set-Content -LiteralPath $checksumPath -Encoding ASCII -Value "$setupHash *$($setup.Name)"
Write-Host "Packaged $($setup.FullName)"
Write-Host "Size: $($setup.Length) bytes"
Write-Host "SHA256: $setupHash"
Write-Host "Checksum: $checksumPath"
