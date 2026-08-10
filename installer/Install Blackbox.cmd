@echo off
title Blackbox Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Blackbox.ps1"
echo.
pause
