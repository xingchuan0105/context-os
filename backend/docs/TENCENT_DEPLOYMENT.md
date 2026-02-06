# Context-OS 腾讯云部署指南

本指南将帮助您在腾讯云轻量应用服务器或 CVM 上部署 Context-OS。

## 目录

1. [准备阶段](#准备阶段)
2. [服务器配置](#服务器配置)
3. [应用部署](#应用部署)
4. [SSL 证书配置](#ssl-证书配置)
5. [服务管理](#服务管理)
6. [监控与维护](#监控与维护)
7. [故障排查](#故障排查)

---

## 准备阶段

### Cloudflare Origin Certificate

```bash
sudo mkdir -p /etc/nginx/ssl
sudo tee /etc/nginx/ssl/your-domain.com.pem > /dev/null <<'EOF'
... your certificate ...
EOF
sudo tee /etc/nginx/ssl/your-domain.com.key > /dev/null <<'EOF'
... your private key ...
EOF
sudo chmod 600 /etc/nginx/ssl/your-domain.com.key
```

Certbot 会自动更新 Nginx 配置，添加 SSL 证书。

### 手动配置 SSL（如果有证书）

```bash
# 创建 SSL 目录
sudo mkdir -p /etc/nginx/ssl

# 上传证书文件
# your-domain.com.crt
# your-domain.com.key

# 设置权限
sudo chmod 600 /etc/nginx/ssl/your-domain.com.key
sudo chmod 644 /etc/nginx/ssl/your-domain.com.crt

# 更新 Nginx 配置中的证书路径
sudo nano /etc/nginx/conf.d/context-os.conf
```

---

## 服务管理

### 使用 PM2

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs context-os

# 重启应用
pm2 restart context-os

# 停止应用
pm2 stop context-os

# 删除应用
pm2 delete context-os

# 监控
pm2 monit
```

### 使用 Systemd

```bash
# 查看状态
sudo systemctl status context-os

# 查看日志
sudo journalctl -u context-os -f

# 重启应用
sudo systemctl restart context-os

# 停止应用
sudo systemctl stop context-os

# 启动应用
sudo systemctl start context-os
```

### Qdrant 管理

```bash
# 查看状态
sudo systemctl status qdrant

# 查看日志
sudo journalctl -u qdrant -f

# 重启服务
sudo systemctl restart qdrant
```

---

## 监控与维护

### 1. 日志查看

```bash
# 应用日志
pm2 logs context-os

# Nginx 访问日志
sudo tail -f /var/log/nginx/context-os-access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/context-os-error.log
```

### 2. 性能监控

```bash
# 系统资源
htop

# 磁盘使用
df -h

# 内存使用
free -h

# 端口监听
sudo netstat -tlnp | grep -E '3000|6333'
```

### 3. 数据备份

```bash
# 备份脚本
cat > /var/www/context-os/scripts/backup.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
cp /data/context-os.db $BACKUP_DIR/context-os_$DATE.db

# 备份 Qdrant 数据
tar -czf $BACKUP_DIR/qdrant_$DATE.tar.gz /data/qdrant

# 保留最近 7 天的备份
find $BACKUP_DIR -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/context-os/scripts/backup.sh

# 添加到 crontab（每天凌晨 2 点备份）
crontab -e
# 添加: 0 2 * * * /var/www/context-os/scripts/backup.sh
```

### 4. 日志轮转

```bash
# 配置 logrotate
sudo cat > /etc/logrotate.d/context-os <<EOF
/var/log/context-os/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
EOF
```

---

## 故障排查

### 应用无法启动

```bash
# 1. 检查端口占用
sudo netstat -tlnp | grep 3000

# 2. 检查环境变量
cat .env.production

# 3. 手动启动测试
npm run start

# 4. 查看详细日志
pm2 logs --lines 100 context-os
```

### 数据库连接失败

```bash
# 检查数据库文件
ls -lh /data/context-os.db

# 检查权限
sudo chmod 664 /data/context-os.db
sudo chown www-data:www-data /data/context-os.db
```

### Qdrant 连接失败

```bash
# 检查 Qdrant 状态
sudo systemctl status qdrant

# 测试 Qdrant API
curl http://localhost:6333/collections

# 查看 Qdrant 日志
sudo journalctl -u qdrant -n 100
```

### Nginx 502 错误

```bash
# 检查应用是否运行
pm2 status

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 内存不足

```bash
# 检查内存使用
free -h

# 添加 swap（如果内存不足）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **定期更新**
   ```bash
   # 定期更新系统
   sudo apt update && sudo apt upgrade -y
   ```

3. **更改默认端口**
   - 修改 SSH 端口（非 22）
   - 使用密钥认证

4. **备份策略**
   - 定期备份数据库
   - 备份配置文件
   - 异地备份

---

## 常用命令速查

```bash
# 应用管理
pm2 start|stop|restart|delete context-os
pm2 logs|monit|status

# 系统服务
sudo systemctl start|stop|restart|status context-os
sudo systemctl start|stop|restart|status qdrant
sudo systemctl reload nginx

# 日志查看
pm2 logs context-os
sudo journalctl -u context-os -f
sudo tail -f /var/log/nginx/context-os-error.log

# 监控
htop
df -h
free -h
sudo netstat -tlnp
```

---

## 获取帮助

如遇到问题，请：

1. 查看日志文件
2. 检查服务状态
3. 参考故障排查章节
4. 提交 Issue 到项目仓库

**部署完成后，访问您的域名即可使用 Context-OS！**
