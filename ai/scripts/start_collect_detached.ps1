# Start garment collect outside the agent Job Object via Scheduled Task.
param(
    [string] $IdsFile = "batches\tpo_day1_outer_all.txt",
    [string] $TaskName = "GordiGarmentCollectDay1"
)

$ErrorActionPreference = "Stop"
$AiRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $AiRoot ".venv\Scripts\python.exe"
$Overnight = Join-Path $AiRoot "garment_dataset-v2\reports\overnight"
New-Item -ItemType Directory -Force -Path $Overnight | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Log = Join-Path $Overnight "collect-$Stamp.log"
$Lock = Join-Path $Overnight "collect.lock"
$Wrapper = Join-Path $Overnight "_schtask_collect_$Stamp.cmd"

# Kill leftover collectors if any (single-worker policy)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'garment_collector collect') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if (Test-Path $Lock) { Remove-Item $Lock -Force }

$IdsArg = $IdsFile
if (-not [System.IO.Path]::IsPathRooted($IdsArg)) {
    $IdsArg = $IdsFile  # relative to AiRoot in the cmd
}

$cmd = @"
@echo off
cd /d "$AiRoot"
echo %DATE% %TIME% schtask start task=$TaskName> "$Lock"
"$Python" -m garment_collector collect --ids-file $IdsArg --dataset-root garment_dataset-v2 --skip-existing --product-delay 3.0 --image-delay 1.0 >> "$Log" 2>&1
echo EXIT=%ERRORLEVEL% finished %DATE% %TIME%>> "$Log"
if exist "$Lock" del "$Lock"
"@
Set-Content -Path $Wrapper -Value $cmd -Encoding ASCII

# Remove previous task if present (ignore missing)
cmd /c "schtasks /Delete /TN $TaskName /F >nul 2>&1"

# Run once as current user
$tr = "cmd /c `"$Wrapper`""
$create = cmd /c "schtasks /Create /TN $TaskName /TR `"$tr`" /SC ONCE /ST 00:00 /RL LIMITED /F"
Write-Output "CREATE: $create"
$run = cmd /c "schtasks /Run /TN $TaskName"
Write-Output "RUN: $run"

Start-Sleep -Seconds 10
$running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'garment_collector collect') }

Write-Output "LOG=$Log"
Write-Output "LOCK=$Lock"
Write-Output "WRAPPER=$Wrapper"
if ($running) {
    Write-Output "STARTED pids=$(($running | ForEach-Object { $_.ProcessId }) -join ',')"
    exit 0
}
Write-Output "WARN process not visible yet; check log"
exit 0
