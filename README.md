# 产品数据管理系统 (code-pdm)

这是一个轻量级、安全、美观的产品数据管理微服务，主要包含**设备类型管理**与**设备ID档案管理**两个模块，作为子系统通过模块联邦（Module Federation）嵌入到 `code-bench` 开发者综合工作台中。

---

## 🛠️ 技术栈与工程结构

*   **后端**：Go 1.25.0 + Gin + GORM + PostgreSQL
*   **前端**：React 18 + Vite 5 + TypeScript + Ant Design 5
*   **架构模式**：自适应独立运行模式 & 微前端联邦嵌入模式

```
code-pdm/
  ├── config/            # 配置模块
  ├── models/            # 数据库实体与 GORM 迁移
  ├── handlers/          # API 控制层
  │     ├── auth.go      # SSO 单点登录 & JWT 中间件
  │     ├── device_type.go
  │     ├── device.go
  │     └── export.go    # Excel 数据双 Sheet 导出控制层
  ├── utils/             # 后台 4 位全局唯一随机后缀生成算法
  ├── frontend/          # React 远程发布前端工程
  ├── Makefile           # 自动化构建指令集
  └── README.md
```

---

## 🚀 快速开始

### 1. 本地配置
复制配置文件模板：
```bash
cp config.yaml.example config.yaml
```

### 2. 一键编译与运行
使用 Makefile 命令一键编译前端资源并将其内嵌到 Go 二进制中：
```bash
# 全套打包构建
make build

# 启动内嵌整合包服务 (默认端口 :8085)
make run
```

### 3. 开发模式调试
*   **后端开发服务**：
    ```bash
    go run main.go -config config.yaml
    ```
*   **前端开发服务**：
    ```bash
    cd frontend
    npm install
    npm run dev  # 默认监听 5177 端口，API 自动反向代理到 8085 后端
    ```

---

## 🧪 单元测试

我们在后台实现了高并发写操作下的后缀碰撞重试与数据库死锁消除。你可以通过以下命令验证并发安全性与全局唯一性：
```bash
go test -v ./models
```

---

## 📊 数据导出

本系统内置了设备数据一键导出至 Excel (`.xlsx`) 的功能（基于 `excelize/v2`）：
*   **双 Sheet 结构**：导出的 Excel 文件包含“设备型号”和“设备ID”两个独立的工作表，便于归档与二次分析。
*   **自适应列宽**：根据单元格内容自动调整列宽，对中文字符引入加权算法计算物理宽度，防止内容挤压或换行。
*   **精美排版**：表头自动加粗并填充灰色背景，行高与字体大小经过精心调优，直接满足企业级报表呈现需求。
*   **安全认证**：数据导出 API 同样挂载在 JWT 鉴权中间件下，与 `code-bench` 网关共享认证状态，防范未授权的数据泄露风险。

可以通过前端界面直接点击“导出 Excel”按钮，或者在已认证的会话中直接请求以下 API：
```http
GET /api/export/excel
```

---

## 🔗 集成到 Code-Bench 网关

在 `code-bench` 的 `config.yaml` 配置文件下，在 `gateways` 列表里将 `pdm` 指向当前服务的端口：
```yaml
gateways:
  shield: "http://127.0.0.1:8080"
  proto: "http://127.0.0.1:8081"
  pipeline: "http://127.0.0.1:8082"
  pdm: "http://127.0.0.1:8085"       # 新增 pdm 路由反向代理，指向 8085 端口
```

主门户 `code-bench` 的前端会通过 `@originjs/vite-plugin-federation` 自动加载 `/pdm/assets/remoteEntry.js` 入口，并在 `/pdm/*` 路由下无缝嵌套呈现设备管理核心页面，同时共享 JWT 签名，达成 SSO 单点登录及管理员与普通用户的权限识别。
