@echo off
rem Run the assistant evaluation (eval\run_eval.mjs). The app reads OPENROUTER_API_KEY
rem from .env itself; nothing from .env is printed. Arguments pass through, e.g.
rem   eval.bat --limit 3 --runs 1      smoke test, about $0.01
rem   eval.bat                         all questions, 3 runs each
rem   eval.bat --group pricing         one group
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies are missing. Run "npm install" first.
  exit /b 2
)
node eval\run_eval.mjs %*
exit /b %errorlevel%
