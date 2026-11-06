# Release test case 9 on Windows (docs/plan/09-distribution.md, Binary tests on every platform):
# install.ps1 installs the stable and, with -Channel beta, the beta from release folders holding
# the tested archive, and a new shell's Path (the machine and user Path) finds sendmock (DS-01.5).
#
#   pwsh scripts/release-tests/install-script.ps1 <archive> <version> <channel>

param(
    [Parameter(Mandatory)] [string] $ArchivePath,
    [Parameter(Mandatory)] [string] $ExpectedVersion,
    [Parameter(Mandatory)] [string] $ExpectedChannel
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$installScript = Join-Path $repositoryRoot "scripts/install/install.ps1"
$workDirectory = Join-Path ([IO.Path]::GetTempPath()) ("sendmock-release-test-" + [Guid]::NewGuid())
$archive = Get-Item -LiteralPath $ArchivePath

foreach ($releaseFolder in @("latest/download", "download/beta")) {
    $folderPath = Join-Path $workDirectory "releases/$releaseFolder"
    New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    Copy-Item -LiteralPath $archive.FullName -Destination $folderPath
    Copy-Item -LiteralPath "$($archive.FullName).sha256" -Destination (Join-Path $folderPath "SHA256SUMS")
}
$env:SENDMOCK_RELEASES_URL = ([Uri] (Join-Path $workDirectory "releases")).AbsoluteUri

$installCases = @(
    @{ Name = "stable, default folder"; Arguments = @{}; InstallDir = Join-Path $env:LOCALAPPDATA "Programs\sendmock" },
    @{ Name = "beta, -InstallDir"; Arguments = @{ Channel = "beta"; InstallDir = (Join-Path $workDirectory "beta-tools") }; InstallDir = Join-Path $workDirectory "beta-tools" }
)

foreach ($installCase in $installCases) {
    $installArguments = $installCase.Arguments
    & $installScript @installArguments

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (($userPath -split ";") -contains $installCase.InstallDir)) {
        throw "FAIL: install.ps1 ($($installCase.Name)) did not add $($installCase.InstallDir) to the user Path"
    }
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $newShellPath = "$machinePath;$userPath"
    $versionJson = pwsh -NoProfile -Command "`$env:Path = '$newShellPath'; Remove-Item Env:SENDMOCK_RELEASES_URL; sendmock version --json"
    Write-Host $versionJson
    $reportedVersion = $versionJson | ConvertFrom-Json
    if ($reportedVersion.version -ne $ExpectedVersion -or $reportedVersion.channel -ne $ExpectedChannel) {
        throw "FAIL: a new shell after install.ps1 ($($installCase.Name)) does not run sendmock $ExpectedVersion ($ExpectedChannel)"
    }
    Write-Host "PASS: install.ps1 ($($installCase.Name)) leaves sendmock on the Path of a new shell"
    Remove-Item -LiteralPath (Join-Path $installCase.InstallDir "sendmock.exe") -Force
}

Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
