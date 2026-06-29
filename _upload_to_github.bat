@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title DON Hair Studio - Upload na GitHub

echo ==========================================
echo   DON Hair Studio - Upload na GitHub
echo ==========================================
echo.

set "DEFAULT_PROJECT=%USERPROFILE%\Desktop\DON"

set /p PROJECT_PATH=Unesi putanju projekta [ENTER za %DEFAULT_PROJECT%]: 
if "%PROJECT_PATH%"=="" set "PROJECT_PATH=%DEFAULT_PROJECT%"

if not exist "%PROJECT_PATH%" (
  echo.
  echo GRESKA: Folder ne postoji:
  echo %PROJECT_PATH%
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT_PATH%"

git --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo GRESKA: Git nije instaliran ili nije dodat u PATH.
  echo Instaliraj Git for Windows pa pokreni opet.
  echo.
  pause
  exit /b 1
)

echo.
echo Proveravam .gitignore...

if not exist ".gitignore" (
  echo Kreiram .gitignore...
  > .gitignore echo node_modules/
  >> .gitignore echo backend/node_modules/
  >> .gitignore echo.
  >> .gitignore echo .env
  >> .gitignore echo backend/.env
  >> .gitignore echo.
  >> .gitignore echo *.log
  >> .gitignore echo .vscode/
  >> .gitignore echo .DS_Store
  >> .gitignore echo Thumbs.db
)

echo.
echo Inicijalizujem Git ako vec nije...
if not exist ".git" (
  git init
)

git branch -M main

echo.
git remote get-url origin >nul 2>&1

if errorlevel 1 (
  set /p REPO_URL=Unesi GitHub repo URL, npr. https://github.com/username/don-hair-studio.git: 

  if "!REPO_URL!"=="" (
    echo.
    echo GRESKA: Moras uneti GitHub repo URL.
    echo.
    pause
    exit /b 1
  )

  git remote add origin "!REPO_URL!"
) else (
  echo Remote origin vec postoji:
  git remote get-url origin
  echo.
  set /p CHANGE_REMOTE=Da li zelis da promenis remote? [d/N]: 

  if /I "!CHANGE_REMOTE!"=="d" (
    set /p REPO_URL=Unesi novi GitHub repo URL: 

    if "!REPO_URL!"=="" (
      echo.
      echo GRESKA: Nisi uneo novi GitHub repo URL.
      echo.
      pause
      exit /b 1
    )

    git remote set-url origin "!REPO_URL!"
  )
)

echo.
echo Dodajem izmene...
git add .

echo.
set /p COMMIT_MSG=Unesi commit poruku [ENTER za "Update projekta"]: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Update projekta"

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo.
  echo Nema novih izmena za commit ili je commit vec napravljen.
)

echo.
echo Saljem na GitHub...
git push -u origin main

if errorlevel 1 (
  echo.
  echo GRESKA: Push nije uspeo.
  echo Proveri da li repo postoji i da li si prijavljen na GitHub.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   Gotovo. Proveri repo na GitHub-u.
echo ==========================================
echo.
pause
