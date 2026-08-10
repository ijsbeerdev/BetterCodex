[CmdletBinding()]
param(
    [string]$NodeArchivePath
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageInfo = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$version = $packageInfo.version
$releaseRoot = Join-Path $repoRoot "release"
$stageRoot = Join-Path $releaseRoot "BetterCodex-$version"
$zipPath = Join-Path $releaseRoot "bettercodex-$version-windows-x64.zip"
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

Assert-ChildPath $stageRoot $repoRoot
Assert-ChildPath $zipPath $repoRoot
Assert-ChildPath $cacheRoot $repoRoot

$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $repoRoot "scripts\build.mjs") --release
if ($LASTEXITCODE -ne 0) { throw "BetterCodex release build failed." }

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stageRoot "runtime") -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot "dist\*") -Destination (Join-Path $stageRoot "runtime") -Recurse -Force
Copy-Item -Path (Join-Path $repoRoot "installer\*") -Destination $stageRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination (Join-Path $stageRoot "README.md")

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

Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
$zip = Get-Item -LiteralPath $zipPath
$zipHash = Get-Sha256 $zipPath
Write-Host "Packaged $($zip.FullName)"
Write-Host "Size: $($zip.Length) bytes"
Write-Host "SHA256: $zipHash"
