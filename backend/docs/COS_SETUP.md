# Context OS COS存储配置指南

**存储桶**: `lhcos-036f3-1347371920`

**重要**: PDF文件必须存储在COS中，不能存储在服务器本地硬盘！

---

## 🎯 目标

- ✅ 所有PDF文件上传到腾讯云COS
- ✅ 服务器本地只存储元数据（SQLite）
- ✅ 支持大文件上传
- ✅ 自动处理CORS配置

---

## 📋 第一步：获取COS访问密钥

### 1.1 访问密钥管理

1. 登录腾讯云控制台
2. 点击右上角头像 → "访问管理"
3. 进入"访问密钥" → "API密钥管理"
4. 点击"新建密钥"

### 1.2 记录密钥信息

```
SecretId: AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SecretKey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**: 密钥只在创建时显示一次，立即复制保存！

---

## 🔧 第二步：配置COS存储桶

### 2.1 检查存储桶配置

1. 进入"对象存储COS"
2. 找到存储桶: `lhcos-036f3-1347371920`
3. 点击"配置管理"

### 2.2 配置权限

**基础配置**:
- 权限: **私有读写**
- 不要设置为公共读！

### 2.3 配置CORS规则

点击"安全管理" → "CORS规则" → "添加规则"

**规则配置**:
```json
{
  "Origin": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

如果有多个域名，都添加到Origin中。

### 2.3 配置静态网站（可选）

如果需要通过CDN加速，可以配置静态网站：
1. 进入"域名与传输管理"
2. 添加CDN加速域名

---

## 🚀 第三步：在Coolify中配置Context OS环境变量

### 3.1 创建Context OS项目

在Coolify中：
1. "New Project" → "Git Repository"
2. 输入你的仓库地址
3. 配置环境变量

### 3.2 配置环境变量

在Coolify项目的 "Environment Variables" 中添加：

```bash
# ==================== 数据库 ====================
DATABASE_URL=/app/data/context-os.db

# ==================== JWT认证 ====================
JWT_SECRET=<使用 openssl rand -base64 32 生成>

# ==================== 腾讯云COS（必须配置！）====================
TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=lhcos-036f3-1347371920
TENCENT_COS_REGION=ap-guangzhou

# ==================== 文件存储配置 ====================
# 强制使用COS存储
STORAGE_TYPE=cos
COS_BUCKET=lhcos-036f3-1347371920
COS_REGION=ap-guangzhou

# ==================== ONEAPI（已配置）====================
ONEAPI_BASE_URL=http://host.docker.internal:3001
ONEAPI_KEY=<在ONEAPI界面中创建的Token>
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=http://host.docker.internal:3001

# ==================== Redis（已配置）====================
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379

# ==================== Qdrant（服务器B）====================
QDRANT_URL=http://10.5.4.5:6333
```

### 3.3 配置数据卷

**重要**: 只配置必要的数据卷，不要配置文件上传目录！

```bash
# 数据库文件（必需）
Container: /app/data
Host: /data/context-os

# ❌ 不要配置 uploads 目录！
# 文件会直接上传到COS，不需要本地存储
```

---

## 📝 第四步：验证COS配置

### 4.1 测试COS连接

在Coolify中，部署Context OS后，查看日志：

```bash
# 应该看到类似的日志
✅ COS configured successfully
Bucket: lhcos-036f3-1347371920
Region: ap-guangzhou
```

### 4.2 测试文件上传

1. 访问应用：`https://yourdomain.com`
2. 登录并创建知识库
3. 上传一个测试PDF
4. 检查是否成功

### 4.3 验证文件在COS中

在腾讯云COS控制台：
1. 进入存储桶 `lhcos-036f3-1347371920`
2. 点击"文件列表"
3. 应该看到上传的文件：

```
lhcos-036f3-1347371920/
├── <user_id>/
│   └── <kb_id>/
│       └── 1735651200000_test.pdf
```

---

## 🔍 第五步：排查问题

### 问题1: 文件上传失败

**检查COS密钥**:
```bash
# 在Coolify的终端中执行
docker logs <context-os-container>

# 查找错误信息
# 如果看到 "SignatureDoesNotMatch"，说明密钥错误
```

**解决方法**:
1. 重新生成密钥
2. 在Coolify中更新环境变量
3. 重启容器

### 问题2: CORS错误

**错误信息**:
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**解决方法**:
1. 检查COS的CORS配置
2. 确保域名已添加到允许列表
3. 清除浏览器缓存重试

### 问题3: 文件存储在本地

**检查**:
```bash
# SSH登录服务器
ssh root@<服务器A公网IP>

# 检查是否有文件在本地
ls -lh /data/context-os/uploads/

# 如果有文件，说明配置错误
```

**解决方法**:
1. 检查环境变量 `STORAGE_TYPE=cos`
2. 检查COS密钥是否正确
3. 重启应用

---

## ✅ 配置完成检查清单

### COS配置
- [ ] 已获取SecretId和SecretKey
- [ ] 存储桶权限设置为"私有读写"
- [ ] CORS规则已配置
- [ ] 验证上传测试成功

### 应用配置
- [ ] 环境变量 `TENCENT_COS_SECRET_ID` 已设置
- [ ] 环境变量 `TENCENT_COS_SECRET_KEY` 已设置
- [ ] 环境变量 `TENCENT_COS_BUCKET=lhcos-036f3-1347371920`
- [ ] 环境变量 `STORAGE_TYPE=cos`
- [ ] 数据卷只配置 `/app/data`，**未配置** `/app/uploads`

### 验证测试
- [ ] 上传测试PDF成功
- [ ] 在COS控制台看到文件
- [ ] 本地服务器没有文件副本
- [ ] 文件可以正常访问

---

## 💡 最佳实践

### 1. 安全配置

**不要在代码中硬编码密钥**:
- ✅ 使用环境变量
- ❌ 不要在Git中提交密钥

**定期轮换密钥**:
- 每3-6个月更换一次
- 在Coolify中更新环境变量

### 2. 成本优化

**生命周期规则**:
在COS控制台配置：
- 180天未访问 → 转为低频存储
- 365天未访问 → 归档存储

**节省约50%存储成本**

### 3. 监控告警

在腾讯云"云监控"中配置：
- 存储用量告警（>40GB）
- 请求次数告警
- 异常流量告警

---

## 🎯 代码说明

### 文件上传流程

```typescript
// lib/storage/cos.ts
// 当用户上传PDF时：

1. 浏览器发送文件到 /api/documents
2. 服务器接收文件流（不保存到本地）
3. 直接调用 COS.putObject() 上传到COS
4. 返回COS的访问URL
5. 在SQLite中保存元数据（文件名、COS路径等）
```

### 关键代码

**上传文件**:
```typescript
const result = await uploadFileToCOS(
  user.id,
  kbId,
  file.name,
  buffer  // 直接使用Buffer，不保存到本地
);
```

**数据库记录**:
```typescript
// 只保存元数据和COS路径
await createDocument(
  kbId,
  userId,
  fileName,
  result.path,  // COS路径: userId/kbId/timestamp_filename
  mimeType,
  fileSize
);
```

---

## 📊 存储路径说明

### COS存储结构

```
lhcos-036f3-1347371920/
├── <user_id>/
│   ├── <kb_id>/
│   │   ├── 1735651200000_document1.pdf
│   │   ├── 1735651201000_document2.pdf
│   │   └── 1735651202000_presentation.pptx
│   └── <another_kb_id>/
│       └── ...
└── <another_user_id>/
    └── ...
```

### 文件命名规则

```
{timestamp}_{original_filename}

例如: 1735651200000_用户手册.pdf
```

---

## 🔗 相关文档

- 腾讯云COS文档: https://cloud.tencent.com/document/product/436
- COS SDK文档: https://github.com/tencentyun/cos-nodejs-sdk-v5
- Coolify环境变量: https://coolify.io/docs/knowledge-base/environment-variables

---

**最后更新**: 2025-01-12
**维护者**: Context OS Team
