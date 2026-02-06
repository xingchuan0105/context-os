# ONEAPI Embedding 模型配置指南

## 问题说明

当前错误：`503 当前分组 default 下对于模型 BAAI/bge-m3 无可用渠道`

**原因**：代码已成功修复为统一走 ONEAPI，但 ONEAPI 中还未配置 Embedding 模型渠道。

---

## 解决方案：在 ONEAPI 中配置 BAAI/bge-m3 渠道

### 步骤 1: 访问 ONEAPI 管理后台

打开浏览器访问：`http://localhost:3000`

**默认登录信息**：
- 用户名：`admin`
- 密码：`admin123`

⚠️ **重要**：首次登录后请立即修改密码！

---

### 步骤 2: 创建令牌（Token）

1. 点击左侧菜单 **"令牌"**
2. 点击 **"新建令牌"**
3. 填写信息：
   - **名称**：`Context-OS Development`
   - **额度**：`500000`（或根据需求调整）
   - **过期时间**：留空（永不过期）
4. 点击 **"提交"**
5. **复制生成的 Token**，格式类似：`sk-xxxxxxxxxxxxx`
6. 更新项目的 `.env` 文件：
   ```bash
   ONEAPI_API_KEY=sk-你复制的token
   ```

---

### 步骤 3: 配置 BAAI/bge-m3 渠道

1. 点击左侧菜单 **"渠道"**
2. 点击 **"新建渠道"**
3. 填写配置：

#### 选项 A: 使用 SiliconFlow（推荐）

| 配置项 | 值 |
|--------|-----|
| **渠道名称** | `SiliconFlow - BGE-M3` |
| **渠道类型** | `SiliconFlow` |
| **Base URL** | `https://api.siliconflow.cn/v1` |
| **密钥** | 你的 SiliconFlow API Key |
| **模型映射** | `BAAI/bge-m3` |
| **模型重定向** | 不勾选 |

**获取 SiliconFlow API Key**：
1. 访问：https://cloud.siliconflow.cn/
2. 注册/登录账号
3. 进入 **"API密钥"** 页面
4. 创建新密钥

---

#### 选项 B: 使用 Dashscope

| 配置项 | 值 |
|--------|-----|
| **渠道名称** | `Dashscope - BGE-M3` |
| **渠道类型** | `Dashscope` |
| **Base URL** | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **密钥** | 你的 Dashscope API Key |
| **模型映射** | `text-embedding-v3` |
| **模型重定向** | 不勾选 |

**注意**：Dashscope 的 Embedding 模型名称是 `text-embedding-v3`，需要在 ONEAPI 中做映射。

---

#### 选项 C: 使用其他 OpenAI Compatible 服务

如果你的 Embedding 服务支持 OpenAI API 格式：

| 配置项 | 值 |
|--------|-----|
| **渠道名称** | `自定义 - BGE-M3` |
| **渠道类型** | `OpenAI` |
| **Base URL** | 你的服务地址 |
| **密钥** | 你的 API Key |
| **模型映射** | `BAAI/bge-m3`（或你的模型名称） |
| **模型重定向** | 根据需要勾选 |

---

### 步骤 4: 配置 K-Type 模型渠道

同样需要配置 `qwen-flash` 模型（用于 K-Type 认知分析）：

| 配置项 | 值 |
|--------|-----|
| **渠道名称** | `Dashscope - Qwen Flash` |
| **渠道类型** | `Dashscope` |
| **Base URL** | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **密钥** | 你的 Dashscope API Key |
| **模型映射** | `qwen-flash` |
| **模型重定向** | 不勾选 |

---

### 步骤 5: 测试配置

配置完成后，点击渠道列表中的 **"测试"** 按钮，确认渠道可用。

---

### 步骤 6: 验证修复

运行召回测试：

```bash
npm run test:retrieval
```

如果配置正确，应该看到：
```
✅ 找到已处理的文档
ℹ️  Qdrant Collection: user_test-user-1768291337020_vectors
ℹ️  测试查询: Java, 设计模式, 面向对象编程, 数据库

查询: "Java"
ℹ️  查询向量维度: 1024
ℹ️  找到 3 个相关片段
✅ 向量检索功能正常
```

---

## 快速配置脚本

如果你有 SiliconFlow API Key，可以使用以下脚本快速配置：

```bash
# 在 ONEAPI 容器中执行
docker exec -it context-os-oneapi /bin/bash

# 使用 curl API 创建渠道（需要先获取 Token）
curl -X POST http://localhost:3000/api/channel \
  -H "Authorization: Bearer YOUR_ONEAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SiliconFlow - BGE-M3",
    "type": 1,
    "key": "YOUR_SILICONFLOW_API_KEY",
    "base_url": "https://api.siliconflow.cn/v1",
    "models": "BAAI/bge-m3",
    "status": 1
  }'
```

---

## 常见问题

### Q1: 为什么不直接用 SiliconFlow？

**A**: 统一使用 ONEAPI 的优势：
- ✅ 统一管理所有 API 调用
- ✅ 集中配置和监控
- ✅ 灵活切换模型和渠道
- ✅ 统一计费和限额控制
- ✅ 故障转移和负载均衡

### Q2: 如何获取免费的 Embedding API？

推荐选项：
1. **SiliconFlow**：https://cloud.siliconflow.cn/（新用户有免费额度）
2. **Dashscope**：https://dashscope.aliyun.com/（阿里云，有免费额度）
3. **本地部署**：使用 Ollama 或 LocalAI 运行本地模型

### Q3: 配置后仍然报错 503？

检查清单：
1. ✅ ONEAPI 服务是否运行：`docker ps | grep oneapi`
2. ✅ Token 是否正确配置：`.env` 中的 `ONEAPI_API_KEY`
3. ✅ 渠道是否启用：渠道状态为 **"启用"**
4. ✅ 模型名称是否正确：`BAAI/bge-m3`（区分大小写）
5. ✅ API Key 是否有效：测试渠道连接

---

## 下一步

配置完成后，可以继续：
1. 运行文档上传测试：`npm run test:upload`
2. 运行召回测试：`npm run test:retrieval`
3. 测试聊天功能（使用已上传的文档）

---

## 相关文档

- [ONEAPI 完整配置指南](./ONEAPI_CHANNELS_CONFIG.md)
- [Docker Compose 部署](../docker-compose.yml)
- [环境变量配置](../.env.example)
