@echo off
rem 演示自检：上台前 30 秒跑一次，看到 ALL GREEN 再开始讲。
rem 需要演示站已经在跑（先双击「一键演示」）。检后端模式加 --api：
rem   node scripts\demo-check.mjs --api
cd /d "%~dp0"
chcp 65001 >nul
node scripts\demo-check.mjs
echo.
pause
