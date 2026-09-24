@echo off
rem 一键演示（后端模式）：顺带拉起演示后端并代理 /api，写 work\demo-*.sqlite 独立库，不碰默认演示库。
rem 需要 Node 22.5 以上（后端用内置 node:sqlite），建议 24。
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo [缺东西] 没找到 node。装一个 Node 22.5 以上（建议 24）再双击这里。
  echo.
  pause
  exit /b 1
)
if exist node_modules goto run
echo [首次运行] 装依赖，可能要一两分钟…
call npm install
:run
node scripts\serve-demo.mjs --api
echo.
pause
