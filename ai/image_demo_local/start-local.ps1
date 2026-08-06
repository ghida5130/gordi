param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $demoRoot 'backend'
$frontendRoot = Join-Path $demoRoot 'frontend'
$envFile = Join-Path $demoRoot '.env'
$envExample = Join-Path $demoRoot '.env.example'
$backendPython = Join-Path $backendRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-Host 'Created .env from .env.example'
}

if ($Install) {
    if (-not (Test-Path -LiteralPath $backendPython)) {
        python -m venv (Join-Path $backendRoot '.venv')
    }
    & $backendPython -m pip install -r (Join-Path $backendRoot 'requirements.txt')

    Push-Location $frontendRoot
    try {
        npm ci
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $backendPython)) {
    throw 'Python dependencies are missing. Run .\start-local.ps1 -Install first.'
}

if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'node_modules'))) {
    throw 'Frontend dependencies are missing. Run .\start-local.ps1 -Install first.'
}

$backendProcess = Start-Process `
    -FilePath $backendPython `
    -ArgumentList 'run.py' `
    -WorkingDirectory $backendRoot `
    -PassThru `
    -NoNewWindow

try {
    Write-Host 'Local demo: http://127.0.0.1:5174'
    Write-Host 'Local API:  http://127.0.0.1:8100/docs'
    Push-Location $frontendRoot
    try {
        npm run dev
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend exited with code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if (-not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id
    }
}
