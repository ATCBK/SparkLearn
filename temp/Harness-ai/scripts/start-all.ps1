param()

$harnessRoot = 'D:\Project_building\SparkLearn\Harness-ai'
$backendScript = Join-Path $harnessRoot 'scripts\start-backend.ps1'
$frontendScript = Join-Path $harnessRoot 'scripts\start-frontend.ps1'

Write-Host '[Harness] Launching backend and frontend in separate windows...' -ForegroundColor Green
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$backendScript`""
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$frontendScript`""

Write-Host '[Harness] Done. Check:' -ForegroundColor Green
Write-Host '  Frontend: http://localhost:3000'
Write-Host '  Backend : http://127.0.0.1:8000/health'
Write-Host '  Swagger : http://127.0.0.1:8000/docs'
