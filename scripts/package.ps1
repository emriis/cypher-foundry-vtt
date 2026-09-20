[CmdletBinding()]
param(
  [string]$OutputDirectory = "dist"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repositoryRoot "system.json"
$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($manifest.version)) {
  throw "system.json must define a version."
}

$expectedDownloadPath = "/releases/download/$($manifest.version)/system.zip"
if ($manifest.download -notlike "*$expectedDownloadPath") {
  throw "system.json download must end with '$expectedDownloadPath'."
}

$outputPath = Join-Path $repositoryRoot $OutputDirectory
$stagingPath = Join-Path ([System.IO.Path]::GetTempPath()) "cypher-package-$([guid]::NewGuid())"
$zipPath = Join-Path $outputPath "system.zip"
$releaseManifestPath = Join-Path $outputPath "system.json"
$includedPaths = @("system.json", "cypher.mjs", "module", "templates", "css", "lang", "packs", "LICENSE.txt", "README.md")

try {
  New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
  Remove-Item -Force -ErrorAction SilentlyContinue $zipPath, $releaseManifestPath
  New-Item -ItemType Directory -Force -Path $stagingPath | Out-Null

  foreach ($relativePath in $includedPaths) {
    $sourcePath = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Required release path is missing: $relativePath"
    }

    $destinationPath = Join-Path $stagingPath $relativePath
    if ((Get-Item -LiteralPath $sourcePath).PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
      Get-ChildItem -LiteralPath $sourcePath -Recurse -Force |
        Where-Object { -not $_.PSIsContainer -and $_.Name -notin @("LOCK") -and $_.Name -notlike "LOG*" -and $_.Name -notlike "*.log" } |
        ForEach-Object {
          $relativeFilePath = $_.FullName.Substring($sourcePath.Length).TrimStart('\', '/')
          $targetPath = Join-Path $destinationPath $relativeFilePath
          New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null
          Copy-Item -LiteralPath $_.FullName -Destination $targetPath
        }
    } else {
      Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }
  }

  Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $zipPath -CompressionLevel Optimal
  Copy-Item -LiteralPath $manifestPath -Destination $releaseManifestPath

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    if ($archive.Entries.FullName -notcontains "system.json") {
      throw "The package archive must contain system.json at its root."
    }
  } finally {
    $archive.Dispose()
  }

  Write-Host "Created $zipPath and $releaseManifestPath for Cypher v$($manifest.version)."
} finally {
  Remove-Item -LiteralPath $stagingPath -Recurse -Force -ErrorAction SilentlyContinue
}