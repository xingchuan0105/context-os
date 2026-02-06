# Docker 服务启动成功！

## ✅ 服务状态

### ONEAPI（API 网关）
- **状态**：✅ 运行中
- **访问地址**：http://localhost:3000
- **默认账号**：
  - 用户名：`admin`
  - 密码：`admin123`
- **API 状态**：✅ 正常（已验证）
- **版本**：v0.6.11-preview.7

### Qdrant（向量数据库）
- **状态**：✅ 运行中
- **访问地址**：
  - HTTP API: http://localhost:6333
  - Dashboard: http://localhost:6333/dashboard
  - gRPC: http://localhost:6334
- **已加载数据**：
  - 集合：`user_test-e2e-user_vectors`
- **版本**：1.16.3

---

## 🚀 下一步操作

### 1. 配置 ONEAPI

**访问管理后台**：http://localhost:3000

**步骤**：
1. 使用 `admin/admin123` 登录
2. 修改密码（首次登录强制要求）
3. 创建令牌：左侧菜单 → **令牌** → **新建令牌**
4. 复制生成的 Token（格式：`sk-xxxxxxxxxxxxx`）
5. 更新项目 `.env` 文件：
   ```bash
   ONEAPI_API_KEY=sk-你复制的token
   ```

### 2. 配置 Embedding 渠道

**目标**：在 ONEAPI 中配置 BAAI/bge-m3 Embedding 模型

**选项 A：使用 SiliconFlow（推荐）**

1. 注册 SiliconFlow：https://cloud.siliconflow.cn/
2. 获取 API Key
3. 在 ONEAPI 中添加渠道：
   - 左侧菜单 → **渠道** → **新建渠道**
   - 配置：
     - 渠道类型：`OpenAI`
     - 名称：`SiliconFlow - BGE-M3`
     - Base URL：`https://api.siliconflow.cn/v1`
     - 密钥：你的 SiliconFlow API Key
   - 点击提交

**��项 B：使用 Dashscope**

1. 注册 Dashscope：https://dashscope.aliyun.com/
2. 获取 API Key
3. 在 ONEAPI 中添加渠道：
   - 渠道类型：`OpenAI`
   - 名称：`Dashscope - BGE-M3`
   - Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 密钥：你的 Dashscope API Key
   - 模型重定向：`text-embedding-v3`

### 3. 配置 K-Type 渠道

**目标**：配置 Qwen Flash 用于 K-Type 认知分析

1. 在 ONEAPI 中再次点击 **新建渠道**
2. 配置：
   - 渠道类型：`OpenAI`
   - 名称：`Dashscope - Qwen Flash`
   - Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 密钥：你的 Dashscope API Key
3. 点击提交

### 4. 验证配置

运行测试：

```bash
# 召回测试（需要已配置 Embedding 渠道）
npm run test:retrieval

# 文档上传测试（需要已配置 K-Type 和 Embedding 渠道）
npm run test:upload
```

---

## 📊 当前架构

```
Context-OS 应用 (localhost:3010)
    ↓
ONEAPI 网关 (localhost:3000)
    ↓
├── SiliconFlow (BAAI/bge-m3 Embedding)
└── Dashscope (Qwen Flash)
```

---

## 🔧 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f oneapi
docker-compose logs -f qdrant

# 重启服务
docker-compose restart

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 停止并删除容器
docker-compose down
```

---

## 📁 数据持久化

```
./data/oneapi/      # ONEAPI SQLite 数据库
./qdrant_storage/   # Qdrant 向量数据
```

⚠️ 注意：使用 `docker-compose down -v` 会删除所有数据！

---

## 🎉 快速检查清单

- [x] Docker 服务已启动
- [x] ONEAPI 可访问：http://localhost:3000
- [x] Qdrant 可访问：http://localhost:6333
- [ ] 已创建 ONEAPI 令牌
- [ ] 已更新 .env 文件的 ONEAPI_API_KEY
- [ ] 已配置 BAAI/bge-m3 渠道
- [ ] 已配置 Qwen Flash 渠道
- [ ] 测试通过：`npm run test:retrieval`

---

## 📚 相关文档

- [Docker 快速启动指南](./DOCKER_QUICKSTART.md)
- [ONEAPI Embedding 配置详细指南](./docs/ONEAPI_EMBEDDING_SETUP.md)
- [环境变量配置](./.env.example)
- [Docker Compose 配置](./docker-compose.yml)

---

## 💡 提示

1. **首次配置**：建议先使用 SiliconFlow（有免费额度）
2. **测试验证**：配置渠道后，点击渠道列表中的"测试"按钮确认可用
3. **模型名称**：确保模型名称与代码中一致（区分大小写）：
   - Embedding: `BAAI/bge-m3`
   - K-Type: `qwen-flash`
4. **端口冲突**：如果端口被占用，修改 `docker-compose.yml` 中的端口映射

---

现在请访问 **http://localhost:3000** 开始配置 ONEAPI！
