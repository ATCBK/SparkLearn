param()

 = 'D:\Project_building\SparkLearn'
 = Join-Path  'backend'

Write-Host '[Harness] Starting backend...' -ForegroundColor Cyan
Set-Location 
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
