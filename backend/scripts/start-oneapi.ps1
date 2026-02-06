# OneAPI 快速启动脚本 (Windows PowerShell)
#
# 使用方法:
#   1. 确保 Docker 已安装并运行
#   2. 在 PowerShell 中运行: .\scripts\start-oneapi.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Context OS - OneAPI 快速部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否运行
Write-Host "检查 Docker 状态..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "✓ Docker 运行正常" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 创建数据目录
Write-Host ""
Write-Host "创建数据目录..." -ForegroundColor Yellow
$dataDir = "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    New-Item -ItemType Directory -Path "$dataDir/oneapi" | Out-Null
    New-Item -ItemType Directory -Path "$dataDir/redis" | Out-Null
    Write-Host "✓ 数据目录创建成功" -ForegroundColor Green
} else {
    Write-Host "✓ 数据目录已存在" -ForegroundColor Green
}

# 启动服务
Write-Host ""
Write-Host "启动 OneAPI 和 Redis 服务..." -ForegroundColor Yellow
docker-compose -f docker-compose.oneapi.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  部署完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "OneAPI 管理界面: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "默认用户名: root" -ForegroundColor White
    Write-Host "默认密码: 123456" -ForegroundColor White
    Write-Host ""
    Write-Host "Redis: localhost:6379" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "查看日志: docker-compose -f docker-compose.oneapi.yml logs -f" -ForegroundColor Gray
    Write-Host "停止服务: docker-compose -f docker-compose.oneapi.yml down" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ 部署失败，请检查错误信息" -ForegroundColor Red
    exit 1
}
