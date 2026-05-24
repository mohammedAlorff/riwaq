@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
set "LOCAL_PHP=%ROOT%..\.tools\php\php.exe"
set "LOCAL_PHP_EXT=%ROOT%..\.tools\php\ext"

if exist "%LOCAL_PHP%" (
  set "PHP_EXE=%LOCAL_PHP%"
  set "PHP_ARGS=-d extension_dir=%LOCAL_PHP_EXT% -d extension=mbstring -d extension=fileinfo -d extension=openssl -d extension=pdo_mysql"
) else (
  set "PHP_EXE=php"
  set "PHP_ARGS="
)

echo ============================================
echo   Riwaq - Dev Server
echo ============================================
echo.
echo Starting PHP built-in server on port 8000...
echo PHP: %PHP_EXE%
echo.
echo Open in browser:
echo   - Students:   http://localhost:8000/%%D8%%B1%%D9%%88%%D8%%A7%%D9%%82.html
echo   - Presidents: http://localhost:8000/presidents/
echo   - Admin:      http://localhost:8000/admin/
echo.
echo Press Ctrl+C to stop the server.
echo ============================================
echo.

REM Open browser after 2 seconds
start "" /B cmd /C "timeout /t 2 /nobreak >nul && start http://localhost:8000/%%D8%%B1%%D9%%88%%D8%%A7%%D9%%82.html"

REM Start PHP built-in server
"%PHP_EXE%" %PHP_ARGS% -S 0.0.0.0:8000

pause
