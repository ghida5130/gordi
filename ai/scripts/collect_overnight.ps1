# Overnight Musinsa garment collection (policy v1.1 / collector 2.1+).
# Run from anywhere; script cd's to ai/.
# Requires: .venv with requirements-garment-tools.txt installed.
#
# Example:
#   .\scripts\collect_overnight.ps1 -IdsFile batches\overnight_all.txt
#   .\scripts\collect_overnight.ps1 -IdsFile batches\male_top.txt -DryRun

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $IdsFile,

    [string] $DatasetRoot = "garment_dataset-v2",

    [switch] $DryRun,

    [switch] $NoSkipExisting,

    [double] $ProductDelay = 3.0,

    [double] $ImageDelay = 1.0
)

$ErrorActionPreference = "Stop"

$AiRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $AiRoot "garment_collector"))) {
    Write-Error "Expected garment_collector under $AiRoot"
}

Set-Location $AiRoot

$Python = Join-Path $AiRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Error "Missing $Python — create venv and install requirements-garment-tools.txt"
}

$IdsPath = if ([System.IO.Path]::IsPathRooted($IdsFile)) {
    $IdsFile
} else {
    Join-Path $AiRoot $IdsFile
}
if (-not (Test-Path $IdsPath)) {
    Write-Error "IDs file not found: $IdsPath"
}

$DatasetPath = if ([System.IO.Path]::IsPathRooted($DatasetRoot)) {
    $DatasetRoot
} else {
    Join-Path $AiRoot $DatasetRoot
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $DatasetPath "reports\overnight"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$LogPath = Join-Path $ReportDir "collect-$Stamp.log"
$ReportArchive = Join-Path $ReportDir "collection-run-$Stamp.json"

$Args = @(
    "-m", "garment_collector", "collect",
    "--ids-file", $IdsPath,
    "--dataset-root", $DatasetPath,
    "--product-delay", "$ProductDelay",
    "--image-delay", "$ImageDelay"
)
if (-not $NoSkipExisting) {
    $Args += "--skip-existing"
}
if ($DryRun) {
    $Args += "--dry-run"
}

Write-Host "=== overnight collect $Stamp ==="
Write-Host "cwd:      $AiRoot"
Write-Host "python:   $Python"
Write-Host "ids:      $IdsPath"
Write-Host "dataset:  $DatasetPath"
Write-Host "log:      $LogPath"
Write-Host "args:     $($Args -join ' ')"
Write-Host "================================"

$start = Get-Date
# Tee to log; capture exit code from python
& $Python @Args 2>&1 | Tee-Object -FilePath $LogPath
$exitCode = $LASTEXITCODE
$elapsed = (Get-Date) - $start

$RunReport = Join-Path $DatasetPath "reports\collection-run.json"
if (Test-Path $RunReport) {
    Copy-Item -Force $RunReport $ReportArchive
    Write-Host "Archived run report -> $ReportArchive"
}

$SummaryLine = "finished exit=$exitCode elapsed_sec=$([int]$elapsed.TotalSeconds) log=$LogPath"
Write-Host $SummaryLine
Add-Content -Path $LogPath -Value $SummaryLine

if ($exitCode -eq 3) {
    Write-Warning "Collection STOPPED (403/429/503 or block page). Do not retry immediately."
}

exit $exitCode
