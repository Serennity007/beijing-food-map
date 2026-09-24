@echo off
rem 一键演示（静态模式）：构建 + 起本地服务 + 打开浏览器。数据存在浏览器 localStorage，不需要后端。
rem 关掉这个窗口就停服务。要换端口：把下面 --port 改成别的数字。
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
node scripts\serve-demo.mjs
echo.
pause
