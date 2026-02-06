# Context OS 环境变量模板

## 📋 直接复制到Coolify的环境变量

### 必须配置（COS存储）

```bash
DATABASE_URL=/app/data/context-os.db
JWT_SECRET=<运行 openssl rand -base64 32 生成>

TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=lhcos-036f3-1347371920
TENCENT_COS_REGION=ap-guangzhou
STORAGE_TYPE=cos
```

### ONEAPI配置

```bash
ONEAPI_BASE_URL=http://host.docker.internal:3001
ONEAPI_KEY=<在ONEAPI界面中创建Token>
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=http://host.docker.internal:3001
EMBEDDING_MODEL=BAAI/bge-m3
```

### Redis配置

```bash
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379
```

### Qdrant配置

```bash
QDRANT_URL=http://10.5.4.5:6333
```

---

## 🚀 完整环境变量列表（一次性复制）

```bash
DATABASE_URL=/app/data/context-os.db
JWT_SECRET=<运行 openssl rand -base64 32 生成>
TENCENT_COS_SECRET_ID=<你的SecretId>
TENCENT_COS_SECRET_KEY=<你的SecretKey>
TENCENT_COS_BUCKET=lhcos-036f3-1347371920
TENCENT_COS_REGION=ap-guangzhou
STORAGE_TYPE=cos
ONEAPI_BASE_URL=http://host.docker.internal:3001
ONEAPI_KEY=<在ONEAPI界面中创建Token>
EMBEDDING_API_KEY=<同ONEAPI_KEY>
EMBEDDING_BASE_URL=http://host.docker.internal:3001
EMBEDDING_MODEL=BAAI/bge-m3
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_URL=redis://host.docker.internal:6379
QDRANT_URL=http://10.5.4.5:6333
```

---

## ⚙️ 在Coolify中配置步骤

### 1. 生成JWT密钥

```bash
# 在本地或服务器上运行
openssl rand -base64 32
```

复制生成的字符串到 `JWT_SECRET`。

### 2. 获取ONEAPI Token

1. 访问 ONEAPI: `http://10.5.4.6:3001`
2. 登录（xc / xc880105）
3. 进入"令牌"页面
4. 点击"新建令牌"
5. 复制Token（sk-xxxx）到 `ONEAPI_KEY` 和 `EMBEDDING_API_KEY`

### 3. 获取COS密钥

1. 登录腾讯云控制台
2. 进入"访问管理" → "访问密钥" → "API密钥管理"
3. 点击"新建密钥"
4. 复制 SecretId 和 SecretKey

### 4. 在Coolify中添加环境变量

1. 进入 Context OS 项目
2. 点击 "Environment Variables"
3. 逐个添加上述环境变量
4. 点击 "Save"
5. 点击 "Deploy" 重新部署

---

## ✅ 配置验证

### 部署后检查日志

在 Coolify 的 Logs 标签页应该看到：

```
✅ Database initialized successfully
✅ COS configured successfully
Bucket: lhcos-036f3-1347371920
Region: ap-guangzhou
```

### 上传测试

1. 访问应用
2. 上传一个PDF
3. 在腾讯云COS控制台查看文件列表
4. 应该看到文件在 `lhcos-036f3-1347371920/<user_id>/<kb_id>/` 下

### 本地验证

```bash
# SSH登录服务器A
ssh root@10.5.4.6

# 检查本地是否有PDF文件
find /data -name "*.pdf" 2>/dev/null

# 应该返回空或只找到数据库文件
```

---

## 🎯 关键配置说明

### COS存储配置（最重要！）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `TENCENT_COS_SECRET_ID` | 你的SecretId | COS访问ID |
| `TENCENT_COS_SECRET_KEY` | 你的SecretKey | COS密钥 |
| `TENCENT_COS_BUCKET` | `lhcos-036f3-1347371920` | 存储桶名称 |
| `TENCENT_COS_REGION` | `ap-guangzhou` | 地域 |
| `STORAGE_TYPE` | `cos` | **强制使用COS** |

### 内网通信配置

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ONEAPI_BASE_URL` | `http://host.docker.internal:3001` | 同服务器容器 |
| `REDIS_HOST` | `host.docker.internal` | 同服务器容器 |
| `QDRANT_URL` | `http://10.5.4.5:6333` | 服务器B内网IP |

---

## 📊 配置完成后架构

```
服务器A (10.5.4.6)
├── Coolify
│   ├── ONEAPI容器
│   ├── Redis容器
│   └── Context OS容器
│       └── Next.js应用
│           └── 上传文件 → 腾讯云COS ✅
│
└── 本地存储
    └── /data/context-os/
        └── context-os.db (只有数据库文件)

服务器B (10.5.4.5)
└── Qdrant容器
    └── /data/qdrant/ (向量数据)

腾讯云COS
└── lhcos-036f3-1347371920
    └── <user_id>/<kb_id>/<timestamp>_<filename>
        └── 所有PDF文件都在这里 ✅
```

---

## ❗ 常见错误

### 错误1: 文件上传到本地

**症状**: 本地服务器有PDF文件

**原因**: 环境变量 `STORAGE_TYPE` 设置错误或缺失

**解决**:
```bash
# 确保 STORAGE_TYPE=cos
# 不要设置 STORAGE_TYPE=local
```

### 错误2: COS签名错误

**症状**: 上传失败，日志显示 "SignatureDoesNotMatch"

**原因**: COS密钥错误

**解决**:
1. 检查 SecretId 和 SecretKey 是否正确
2. 在Coolify中更新环境变量
3. 重新部署

### 错误3: CORS错误

**症状**: 浏览器控制台显示跨域错误

**原因**: COS未配置CORS规则

**解决**:
1. 在腾讯云COS控制台配置CORS规则
2. 添加你的域名到允许列表

---

## 🎉 配置完成

配置完成后：

- ✅ 所有PDF文件存储在腾讯云COS
- ✅ 服务器本地只存储数据库
- ✅ 文件上传流程：浏览器 → 内存 → COS
- ✅ 服务器硬盘占用最小化
- ✅ 可以无限扩展存储空间

---

**参考文档**:
- `COS_SETUP.md` - COS详细配置指南
- `COOLIFY_COMPLETE.md` - 完整部署清单
