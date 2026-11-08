# Installs SendMock on Windows (docs/wiki/install.md, Install script (Windows)).
#
#   irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex
#   & ([scriptblock]::Create((irm https://github.com/shibbirweb/sendmock/releases/download/beta/install.ps1))) -Channel beta
#
# Downloads the archive for this CPU from the GitHub release of the chosen channel, checks it
# against the release's SHA256SUMS, puts sendmock.exe in the install folder and adds that folder
# to the user's Path, so a new PowerShell window finds it.

param(
    [string] $Channel = $(if ($env:SENDMOCK_CHANNEL) { $env:SENDMOCK_CHANNEL } else { "stable" }),
    [string] $InstallDir = $(if ($env:SENDMOCK_INSTALL_DIR) { $env:SENDMOCK_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\sendmock" }),
    [switch] $NoModifyPath
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Throws rather than exits: run through `irm | iex`, exit would close the user's PowerShell window.
function Stop-Install([string] $Message) {
    throw "sendmock install: $Message"
}

function Get-DownloadUrl([string] $ReleaseChannel) {
    $releasesUrl = if ($env:SENDMOCK_RELEASES_URL) { $env:SENDMOCK_RELEASES_URL } else { "https://github.com/shibbirweb/sendmock/releases" }
    switch ($ReleaseChannel) {
        "stable" { return "$releasesUrl/latest/download" }
        "beta" { return "$releasesUrl/download/beta" }
        default { Stop-Install "unknown channel '$ReleaseChannel': use stable or beta" }
    }
}

function Get-TargetTriple {
    $cpu = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($cpu) {
        "AMD64" { return "x86_64-pc-windows-msvc" }
        "ARM64" { return "aarch64-pc-windows-msvc" }
        default { Stop-Install "no SendMock build for the $cpu CPU: builds exist for x64 and ARM64" }
    }
}

function Save-Download([string] $SourceUrl, [string] $DestinationPath) {
    try {
        if ($SourceUrl.StartsWith("file://")) {
            Copy-Item -LiteralPath ([Uri] $SourceUrl).LocalPath -Destination $DestinationPath
        }
        else {
            Invoke-WebRequest -Uri $SourceUrl -OutFile $DestinationPath -UseBasicParsing
        }
    }
    catch {
        Stop-Install "could not download ${SourceUrl}: $($_.Exception.Message)"
    }
}

function Assert-Checksum([string] $ArchivePath, [string] $ArchiveName, [string] $ChecksumsPath) {
    $expectedChecksum = $null
    foreach ($checksumLine in Get-Content -LiteralPath $ChecksumsPath) {
        $parts = $checksumLine -split "\s+", 2
        if ($parts.Count -eq 2 -and $parts[1].TrimStart("*") -eq $ArchiveName) {
            $expectedChecksum = $parts[0]
        }
    }
    if (-not $expectedChecksum) {
        Stop-Install "SHA256SUMS has no line for $ArchiveName"
    }
    $actualChecksum = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash
    if ($actualChecksum -ne $expectedChecksum) {
        Stop-Install "the checksum of $ArchiveName does not match SHA256SUMS; nothing was installed"
    }
}

function Add-ToUserPath([string] $Folder) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = if ($userPath) { $userPath -split ";" } else { @() }
    if ($pathEntries -contains $Folder) {
        return
    }
    if ($NoModifyPath) {
        Write-Host "Add $Folder to your Path to run sendmock."
        return
    }
    $newUserPath = (@($pathEntries | Where-Object { $_ }) + $Folder) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    $env:Path = "$env:Path;$Folder"
    Write-Host "Added $Folder to your Path; open a new PowerShell window to use it."
}

$downloadUrl = Get-DownloadUrl $Channel
$targetTriple = Get-TargetTriple
$archiveName = "sendmock-$targetTriple.zip"
$workDirectory = Join-Path ([IO.Path]::GetTempPath()) ("sendmock-install-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $workDirectory | Out-Null

try {
    Write-Host "Downloading SendMock ($Channel) for $targetTriple..."
    $archivePath = Join-Path $workDirectory $archiveName
    $checksumsPath = Join-Path $workDirectory "SHA256SUMS"
    Save-Download "$downloadUrl/$archiveName" $archivePath
    Save-Download "$downloadUrl/SHA256SUMS" $checksumsPath
    Assert-Checksum $archivePath $archiveName $checksumsPath

    $extractedDirectory = Join-Path $workDirectory "extracted"
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractedDirectory
    $extractedBinary = Join-Path $extractedDirectory "sendmock.exe"
    if (-not (Test-Path -LiteralPath $extractedBinary)) {
        Stop-Install "the archive holds no sendmock.exe"
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $installedBinary = Join-Path $InstallDir "sendmock.exe"
    Move-Item -LiteralPath $extractedBinary -Destination $installedBinary -Force
    Write-Host "Installed $(& $installedBinary --version) to $installedBinary"

    Add-ToUserPath $InstallDir
    Write-Host "Run: sendmock"
}
finally {
    Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
