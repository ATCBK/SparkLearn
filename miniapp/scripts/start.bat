@echo off
chcp 65001 >nul

echo ===================================
echo   SparkLearn 小程序启动脚本
echo ===================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到 npm，请先安装 npm
    pause
    exit /b 1
)

echo Node.js 版本:
node -v
echo npm 版本:
npm -v
echo.

REM 进入项目目录
cd /d "%~dp0\.."

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
    echo 依赖安装完成
    echo.
)

REM 检查图标文件
if not exist "src\assets\icons\home.png" (
    echo 警告: 未找到图标文件
    echo 请运行 node scripts/download-icons.js 下载图标
    echo 或手动下载图标到 src\assets\icons\ 目录
    echo.
)

echo 启动开发服务器...
echo 请使用微信开发者工具打开 dist 目录
echo.

REM 启动开发服务器
call npm run dev:weapp

pause
