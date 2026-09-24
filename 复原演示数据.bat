@echo off
rem 复原演示数据：把默认演示库恢复成种子基线（整库覆盖）。
rem 只影响 apps\api\data\demo.sqlite；演示模式用的 work\demo-*.sqlite 不在这里管。
rem 注意：这是覆盖式操作，确认没有别的任务在那个库里留状态再按。
cd /d "%~dp0"
chcp 65001 >nul
echo 这一步会用合成种子整库覆盖默认演示库。
echo 静态模式（浏览器 localStorage）请改在浏览器里清站点数据，或访问 /me 用页面上的重置入口。
echo.
pause
call npm run seed:test
echo.
pause
