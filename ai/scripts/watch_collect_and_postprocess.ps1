# Watch TPO collect; auto-restart if it dies with remaining IDs;
# when remaining is low enough, run validate → review-images → summarize.
# Final stdout line: DONE ... or FAILED ...
param(
    [string] $IdsFileRel = "batches\tpo_day1_outer_all.txt",
    [string] $TaskName = "GordiGarmentCollectDay1",
    [string] $SessionTag = "day1"
)
$ErrorActionPreference = "Continue"
$AiRoot = Split-Path -Parent $PSScriptRoot
Set-Location $AiRoot

$DatasetRoot = Join-Path $AiRoot "garment_dataset-v2"
$Overnight = Join-Path $DatasetRoot "reports\overnight"
$Lock = Join-Path $Overnight "collect.lock"
$Python = Join-Path $AiRoot ".venv\Scripts\python.exe"
$IdsFile = if ([System.IO.Path]::IsPathRooted($IdsFileRel)) { $IdsFileRel } else { Join-Path $AiRoot $IdsFileRel }
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$WatchLog = Join-Path $Overnight "watch-postprocess-$SessionTag-$Stamp.log"
$MaxRestarts = 8
$RemainingDoneThreshold = 20  # treat as done when fewer than this left (exclusions/fails)

function Log([string]$msg) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $WatchLog -Value $line -Encoding utf8
}

function CollectPids {
    @(Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and ($_.CommandLine -match 'garment_collector collect') } |
        ForEach-Object { $_.ProcessId })
}

function RemainingCount {
    $env:GORDI_IDS_FILE = $IdsFile
    $env:GORDI_DATASET_ROOT = $DatasetRoot
    $out = & $Python -c @"
from pathlib import Path
import os
ids_path = Path(os.environ['GORDI_IDS_FILE'])
root = Path(os.environ['GORDI_DATASET_ROOT']) / 'normalized' / 'musinsa'
ids = [
    line.split()[0]
    for line in ids_path.read_text(encoding='utf-8').splitlines()
    if line.strip() and not line.startswith('#')
]
left = sum(1 for i in ids if not (root / f'{i}.json').exists())
print(left)
"@ 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log "RemainingCount failed: $out"
        return -1
    }
    $text = ($out | Out-String).Trim()
    try { return [int]$text } catch {
        Log "RemainingCount parse failed: $text"
        return -1
    }
}

function Load-DotEnv([string]$path) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path -Encoding utf8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $i = $line.IndexOf("=")
        if ($i -lt 1) { return }
        $k = $line.Substring(0, $i).Trim()
        $v = $line.Substring($i + 1).Trim()
        if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
            $v = $v.Substring(1, $v.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
}

function Start-Collect {
    param([int]$restartNo)
    # Detach via Scheduled Task so agent/monitor kill does not take collect down.
    $starter = Join-Path $PSScriptRoot "start_collect_detached.ps1"
    Log "starting detached collect restart=$restartNo ids=$IdsFileRel task=$TaskName"
    $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $starter `
        -IdsFile $IdsFileRel -TaskName $TaskName 2>&1
    Log ($out | Out-String)
    Start-Sleep -Seconds 12
    $pids = CollectPids
    Log "after start pids=$($pids -join ',')"
    return $out
}

New-Item -ItemType Directory -Force -Path $Overnight | Out-Null
Log "watch start remaining=$(RemainingCount)"

$restarts = 0
$pids = CollectPids
if (-not $pids -or $pids.Count -eq 0) {
    $left0 = RemainingCount
    if ($left0 -gt $RemainingDoneThreshold) {
        Start-Collect -restartNo $restarts | Out-Null
        $restarts++
    }
} else {
    Log "existing collect pids=$($pids -join ',')"
}

while ($true) {
    Start-Sleep -Seconds 90
    $pids = CollectPids
    $left = RemainingCount
    $n = @(Get-ChildItem (Join-Path $DatasetRoot "normalized\musinsa\*.json") -ErrorAction SilentlyContinue).Count
    $lockExists = Test-Path $Lock
    Log "tick left=$left normalized=$n lock=$lockExists pids=$($pids -join ',')"

    if ($pids -and $pids.Count -gt 0) {
        continue
    }

    # no collector process
    if ($left -le $RemainingDoneThreshold) {
        Log "collect complete enough left=$left"
        break
    }

    if ($restarts -ge $MaxRestarts) {
        Log "max restarts reached left=$left"
        Write-Output "FAILED max_restarts left=$left log=$WatchLog"
        exit 1
    }

    Log "collect died with left=$left — restarting ($restarts)"
    Start-Collect -restartNo $restarts | Out-Null
    $restarts++
}

# --- postprocess ---
Log "postprocess begin"
$failed = $false
$run = Join-Path $DatasetRoot "reports\collection-run.json"
if (Test-Path $run) {
    Copy-Item -Force $run (Join-Path $Overnight "collection-run-post-$Stamp.json")
}

Log "validate"
& $Python -m garment_collector validate --dataset-root $DatasetRoot --write *>> $WatchLog 2>&1
if ($LASTEXITCODE -ne 0) { Log "validate exit=$LASTEXITCODE"; $failed = $true }

Load-DotEnv (Join-Path $AiRoot ".env")
if (-not $env:OPENROUTER_API_KEY -and -not $env:RECOMMENDATION_VLM_API_KEY) {
    Log "SKIP review-images: missing API key"
    $failed = $true
} else {
    Log "review-images"
    & $Python -m garment_collector review-images --dataset-root $DatasetRoot --reasoning-effort low *>> $WatchLog 2>&1
    if ($LASTEXITCODE -ne 0) { Log "review-images exit=$LASTEXITCODE"; $failed = $true }
}

Log "summarize"
& $Python scripts\summarize_dataset_cells.py --dataset-root $DatasetRoot *>> $WatchLog 2>&1

$n2 = @(Get-ChildItem (Join-Path $DatasetRoot "normalized\musinsa\*.json") -ErrorAction SilentlyContinue).Count
$left2 = RemainingCount
$summaryPath = Join-Path $Overnight "session-$SessionTag-postprocess-summary-$Stamp.txt"
@(
    "stamp=$Stamp"
    "session=$SessionTag"
    "ids_file=$IdsFile"
    "normalized=$n2"
    "batch_remaining=$left2"
    "restarts=$restarts"
    "watch_log=$WatchLog"
    "failed=$failed"
) | Set-Content $summaryPath -Encoding utf8
Log "done summary=$summaryPath"

if ($failed) {
    Write-Output "FAILED session=$SessionTag log=$WatchLog remaining=$left2 normalized=$n2"
    exit 1
}
Write-Output "DONE session=$SessionTag log=$WatchLog remaining=$left2 normalized=$n2"
exit 0
