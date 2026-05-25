param()

function Test-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  return $null -ne $cmd
}

Write-Host '[Harness] Checking prerequisites...' -ForegroundColor Cyan

$pythonOk = Test-Command 'python'
$nodeOk = Test-Command 'node'
$npmOk = Test-Command 'npm'

if ($pythonOk) {
  Write-Host '  [OK] python found' -ForegroundColor Green
  python --version
} else {
  Write-Host '  [ERR] python not found in PATH' -ForegroundColor Red
}

if ($nodeOk) {
  Write-Host '  [OK] node found' -ForegroundColor Green
  node --version
} else {
  Write-Host '  [ERR] node not found in PATH' -ForegroundColor Red
}

if ($npmOk) {
  Write-Host '  [OK] npm found' -ForegroundColor Green
  npm --version
} else {
  Write-Host '  [ERR] npm not found in PATH' -ForegroundColor Red
}

$envPath = 'D:\Project_building\SparkLearn\.env'
if (Test-Path $envPath) {
  Write-Host "  [OK] .env exists: $envPath" -ForegroundColor Green
} else {
  Write-Host "  [WARN] .env missing: $envPath" -ForegroundColor Yellow
}

if (-not ($pythonOk -and $nodeOk -and $npmOk)) {
  Write-Host '[Harness] Missing prerequisites. Fix above errors before running start-all.' -ForegroundColor Red
  exit 1
}

Write-Host '[Harness] Prerequisites check passed.' -ForegroundColor Green
