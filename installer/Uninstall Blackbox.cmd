@echo off
title Blackbox Uninstaller
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-Blackbox.ps1"
echo.
pause
