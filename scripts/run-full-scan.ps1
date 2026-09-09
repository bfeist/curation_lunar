param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]*$')]
    [string]$RunName,
    [switch]$Resume,
    [switch]$PrepareApp,
    [ValidateRange(0, 60)]
    [double]$Delay = 0.25
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoRoot
$runRoot = Join-Path $repoRoot "data/runs/$RunName"
$monitorRoot = Join-Path $repoRoot 'data/scan-logs'
New-Item -ItemType Directory -Force -Path $monitorRoot | Out-Null
$statusPath = Join-Path $monitorRoot "$RunName.status.json"
$startedAt = (Get-Date).ToUniversalTime().ToString('o')

function Write-ScanStatus([string]$stage, $details) {
    @{
        run = $RunName
        pid = $PID
        started_at = $startedAt
        updated_at = (Get-Date).ToUniversalTime().ToString('o')
        stage = $stage
        details = $details
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statusPath -Encoding UTF8
}

try {
    Write-ScanStatus 'acquiring' $null
    if ($Resume) {
        & uv run --project python --locked lunar-ingest resume $runRoot --max-requests 0 --retry-failed --delay $Delay
    } else {
        & uv run --project python --locked lunar-ingest start --mode full --run $RunName --max-requests 0 --delay $Delay
    }
    if ($LASTEXITCODE -ne 0) { throw "Acquisition command exited with code $LASTEXITCODE" }
    # A zero CLI exit can mean a protective pause. Preserve that distinction.
    $progress = Get-Content -LiteralPath (Join-Path $runRoot 'progress.json') -Raw | ConvertFrom-Json
    Write-ScanStatus 'validating' $progress
    & uv run --project python --locked lunar-ingest validate $runRoot
    $validationExit = $LASTEXITCODE
    if ($validationExit -notin @(0, 1)) { throw "Validation command exited with code $validationExit" }
    Write-ScanStatus 'exporting' $progress
    & uv run --project python --locked lunar-ingest export $runRoot
    if ($LASTEXITCODE -ne 0) { throw "Export command exited with code $LASTEXITCODE" }
    if ($PrepareApp -and $progress.status -eq 'acquisition_finished_needs_review' -and $validationExit -eq 0) {
        Write-ScanStatus 'preparing_app' $progress
        $exportPath = Join-Path $runRoot 'exports/lunar.sqlite'
        & npm run data:prepare -- $exportPath "Full acquisition candidate - $RunName (review required)"
        if ($LASTEXITCODE -ne 0) { throw "App data preparation exited with code $LASTEXITCODE" }
        $runningContainer = & docker compose -f dockercompose.yml ps --status running --quiet web
        if ($LASTEXITCODE -eq 0 -and $runningContainer) {
            Write-ScanStatus 'restarting_app' $progress
            & docker compose -f dockercompose.yml restart web
            if ($LASTEXITCODE -ne 0) { throw "App container restart exited with code $LASTEXITCODE" }
            & docker compose -f dockercompose.yml up --detach --wait
            if ($LASTEXITCODE -ne 0) { throw "App container did not become healthy" }
        }
    }
    $finalStage = if ($progress.status -eq 'acquisition_finished_needs_review' -and $validationExit -eq 0) {
        'acquisition_finished_needs_review'
    } else {
        'needs_attention'
    }
    Write-ScanStatus $finalStage @{ progress = $progress; validation_exit = $validationExit }
} catch {
    Write-ScanStatus 'failed' @{ error = $_.Exception.Message }
    throw
}
