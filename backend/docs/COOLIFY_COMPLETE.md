# Coolify部署Context OS - 完整配置清单

## 📦 已配置信息

- ✅ 服务器A内网IP：`10.5.4.6`
- ✅ 服务器B内网IP：`10.5.4.5`
- ✅ Coolify管理员：`xingchuan / Xingchuan0105!`
- ✅ ONEAPI账号：`xc / xc880105`

---

## 🔧 剩余配置步骤

### 第6步：获取COS密钥并配置（必须！）- 15分钟

#### 6.1 获取COS访问密钥

1. 登录腾讯云控制台
2. 点击右上角头像 → "访问管理" → "访问密钥" → "API密钥管理"
3. 点击"新建密钥"
4. **立即复制并保存** SecretId 和 SecretKey

```
记录你的密钥：
SecretId: AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SecretKey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 6.2 配置COS存储桶

1. 进入"对象存储COS"
2. 找到存储桶：`lhcos-036f3-1347371920`
3. 点击"配置管理" → "权限管理"
4. 确认设置为：**私有读写**

#### 6.3 配置CORS规则

点击"安全管理" → "CORS规则" → "添加规则"

```json
{
  "来源": ["https://yourdomain.com", "http://localhost:3000"],
  "操作": ["GET", "POST", "PUT", "DELETE", "HEAD"],
  "允许的Header": ["*"],
  "暴露的Header": ["ETag"],
  "超时": 3600
}
```

---

### 第7步：在Coolify中配置Context OS环境变量（完整版）

#### 7.1 创建Context OS项目

1. 访问 Coolify: `http://10.5.4.6:8000`
2. 登录（xingchuan / Xingchuan0105!）
3. "New Project" → "Git Repository"
4. 输入你的Git仓库地址并部署

#### 7.2 配置环境变量

在Coolify项目的 "Environment Variables" 中添加以下**所有**变量：

```bash
# ==================== 数据库 ====================
DATABASE_URL=/app/data/context-os.db

# ==================== JWT认证 ====================
JWT_SECRET=<运行 openssl rand -base64 32 生成>

# ==================== 腾讯云COS（必须配置！）====================
TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=lhcos-036f3-1347371920
TENCENT_COS_REGION=ap-guangzhou

# ==================== 文件存储配置 ====================
# 强制使用COS，不使用本地存储
STORAGE_TYPE=cos

# ==================== ONEAPI（已配置）====================
ONEAPI_BASE_URL=http://host.docker.internal:3001
ONEAPI_KEY=<在ONEAPI中创建Token>
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=http://host.docker.internal:3001
EMBEDDING_MODEL=BAAI/bge-m3

# ==================== Redis（已配置）====================
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379

# ==================== Qdrant（服务器B）====================
QDRANT_URL=http://10.5.4.5:6333
```

#### 7.3 配置数据卷（重要！）

**只配置这一个数据卷**：

```bash
Container: /app/data
Host: /data/context-os
```

**❌ 不要配置 /app/uploads！**
文件会直接上传到COS，不需要本地存储目录！

---

### 第8步：部署和验证 - 20分钟

#### 8.1 部署Context OS

1. 在Coolify中点击 "Deploy"
2. 等待构建完成（5-10分钟）
3. 查看 "Logs" 标签页，确认无错误

应该看到类似的日志：
```
✅ Database initialized successfully
✅ COS configured successfully
Bucket: lhcos-036f3-1347371920
```

#### 8.2 测试文件上传到COS

1. 访问应用（根据你的部署方式）
2. 注册/登录账号
3. 创建知识库
4. 上传一个测试PDF

#### 8.3 验证文件在COS中

在腾讯云COS控制台：
1. 进入存储桶 `lhcos-036f3-1347371920`
2. 点击"文件列表"
3. 应该看到上传的文件

**COS文件路径**：
```
lhcos-036f3-1347371920/
└── <user_id>/
    └── <kb_id>/
        └── <timestamp>_<filename>
```

#### 8.4 确认本地没有文件

SSH登录服务器A：
```bash
ssh root@10.5.4.6

# 检查是否有文件在本地
ls -la /data/context-os/

# 应该只看到 context-os.db，没有 uploads 目录
# 或者有 uploads 目录但是是空的
```

---

## ✅ 配置完成检查清单

### COS配置
- [ ] 已获取SecretId和SecretKey
- [ ] 存储桶权限为"私有读写"
- [ ] CORS规则已配置
- [ ] 验证上传测试成功

### Coolify环境变量
- [ ] `TENCENT_COS_SECRET_ID` 已设置
- [ ] `TENCENT_COS_SECRET_KEY` 已设置
- [ ] `TENCENT_COS_BUCKET=lhcos-036f3-1347371920`
- [ ] `TENCENT_COS_REGION=ap-guangzhou`
- [ ] `STORAGE_TYPE=cos`

### Coolify数据卷
- [ ] 只配置了 `/app/data` → `/data/context-os`
- [ ] **未配置** `/app/uploads` 数据卷

### 验证测试
- [ ] 上传PDF成功
- [ ] 在COS控制台看到文件
- [ ] 本地服务器没有PDF文件
- [ ] 文件可以正常访问和下载

---

## 🔧 关键配置信息汇总

```bash
# ==================== 服务器信息 ====================
服务器A内网IP: 10.5.4.6
服务器B内网IP: 10.5.4.5

# ==================== Coolify ====================
Coolify URL: http://10.5.4.6:8000
管理员账号: xingchuan
管理员密码: Xingchuan0105!

# ==================== ONEAPI ====================
ONEAPI URL: http://10.5.4.6:3001
ONEAPI 账号: xc
ONEAPI 密码: xc880105
Token: <在ONEAPI界面中创建>

# ==================== Redis ====================
Redis Host: host.docker.internal
Redis Port: 6379

# ==================== Qdrant ====================
Qdrant URL: http://10.5.4.5:6333

# ==================== COS存储桶 ====================
存储桶名称: lhcos-036f3-1347371920
地域: ap-guangzhou
SecretId: <你的SecretId>
SecretKey: <你的SecretKey>
```

---

## 🎯 文件上传流程说明

### 完整流程

```
用户浏览器
    ↓ 选择PDF文件
    ↓
Next.js API (/api/documents)
    ↓ 接收文件到内存（Buffer）
    ↓
腾讯云COS SDK
    ↓ 直接上传到COS
    ↓
返回COS访问URL
    ↓
SQLite数据库（只保存元数据）
    ├─ 文件名
    ├─ COS路径
    ├─ 文件大小
    └─ 上传时间
```

### 关键点

1. ✅ 文件**不保存**到服务器本地硬盘
2. ✅ 文件直接从浏览器内存上传到COS
3. ✅ 服务器本地只存储数据库文件（SQLite）
4. ✅ 服务器硬盘占用最小化

---

## ⚠️ 重要提醒

### ❌ 错误配置

```bash
# 不要这样配置！
环境变量: STORAGE_TYPE=local
数据卷: /app/uploads → /data/uploads
```

这会导致文件保存到本地硬盘！

### ✅ 正确配置

```bash
# 必须这样配置！
环境变量:
  - STORAGE_TYPE=cos
  - TENCENT_COS_BUCKET=lhcos-036f3-1347371920
  - TENCENT_COS_SECRET_ID=<你的SecretId>
  - TENCENT_COS_SECRET_KEY=<你的SecretKey>

数据卷: 只配置 /app/data
```

---

## 🆘 故障排查

### 问题: 上传时提示"COS未配置"

**检查**:
1. 在Coolify中查看环境变量
2. 确认4个COS相关变量都已设置
3. 点击"Deploy"重新部署

### 问题: 文件上传失败

**检查日志**:
```bash
# 在Coolify中查看日志
错误: "SignatureDoesNotMatch"
原因: COS密钥错误
解决: 重新生成密钥并更新环境变量
```

### 问题: 文件在本地找到了

**检查**:
```bash
# SSH登录服务器
ls -la /data/context-os/uploads/

# 如果有文件，说明配置错误
# 检查环境变量 STORAGE_TYPE=cos
```

---

## 📞 获取帮助

- **COS配置详情**: `docs/COS_SETUP.md`
- **完整部署指南**: `docs/TENCENT_COOLIFY_SETUP.md`
- **腾讯云COS文档**: https://cloud.tencent.com/document/product/436

---

**下一步**: 配置COS密钥后，在Coolify中更新环境变量并重新部署
