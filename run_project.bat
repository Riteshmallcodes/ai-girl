@echo off
echo Starting AI Virtual Girl Assistant...

echo Starting Python Backend API...
cd "d:\ai girl\python-api"
start cmd /k "pip install -r requirements.txt && python main.py"

echo Starting Frontend Dev Server...
cd "d:\ai girl\frontend"
start cmd /k "npm install && npm run dev"

echo Both services are starting up! Check the new command prompt windows.
pause
