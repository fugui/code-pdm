# 产品数据管理系统 (code-pdm) 📦

`code-pdm` 是 CodeBench 微前端集成工作台下的**产品数据管理 (PDM)** 子系统。主要负责企业研发过程中的**设备类型管理**与**设备 ID 档案管理**，作为微前端 Remote 模块通过模块联邦（Module Federation）动态嵌入到 `code-bench` 宿主中运行，同时支持作为独立服务部署。

---

## 🛠️ 技术栈与工程结构

*   **后端**：Go 1.25+ Gin + GORM v2 + PostgreSQL (接入 `code-common/backend`)
*   **前端**：React 18 + Vite 5 + TypeScript + Ant Design 5 (接入 `@code/common`)
*   **架构模式**：自适应独立运行模式 & Vite 模块联邦微前端嵌入模式

```text
code-pdm/
├── config/            # 配置解析 (支持 prefer_simple_protocol)
├── models/            # 数据库实体与 GORM 迁移 (引用 code-common 模型)
├── handlers/          # API 控制层
│   ├── auth.go        # SSO 单点登录 & JWT 中间件
│   ├── device_type.go # 设备型号增删改查
│   ├── device.go      # 设备 ID 生成与档案管理
│   └── export.go      # Excel 双 Sheet 导出控制器
├── utils/             # 高并发 4 位全局唯一随机后缀生成算法
├── frontend/          # React 前端工程 (样式严格限定于 .pdm-app 作用域)
├── Makefile           # 自动化构建与测试脚本
└── README.md
```

---

## 🌟 核心功能与特性

### 1. 设备型号与档案管理
*   **设备型号管理**：支持设备型号的编码、名称、描述及状态管理。
*   **设备 ID 档案与唯一后缀算法**：内置高并发安全的 4 位全局唯一随机后缀生成算法与数据库死锁碰撞重试机制，确保设备物理 ID 全局不重复。

### 2. 企业级 Excel 双 Sheet 数据导出
*   **双 Sheet 结构**：导出的 Excel 文件包含“设备型号”与“设备ID”两个独立 Sheet，便于数据离线归档与二次分析。
*   **自适应中文列宽**：根据单元格文本内容引入中文字符加权算法动态计算物理宽度，排版精美防折行。
*   **JWT 鉴权防护**：导出接口挂载统一 JWT 鉴权中间件，与 `code-bench` 网关共享安全状态。

### 3. 微前端菜单与样式隔离
*   **ModuleMenuConfig 菜单规范**：菜单配置遵循全平台微前端菜单规范，支持分组配置与 SVG 图标渲染。
*   **CSS 作用域隔离**：前端所有 CSS 样式限定在 `.pdm-app` 容器内，接入 Portal CSS 变量继承全局主题，杜绝全局样式污染。

### 4. 基于 Roles 的细粒度权限控制 (RBAC)
*   全面收敛至基于 `Roles` 数组的角色权限体系，彻底停用历史 `is_admin` 物理列与逻辑判断：
    *   `super_admin`：超级管理员，具备全系统所有数据的管理权限。
    *   `pdm_admin`：PDM 子系统管理员，具备设备型号与设备 ID 的增删改操作权限。
    *   普通用户：具备只读查看与数据导出权限。

---

## ⚙️ 系统配置 (config.yaml)

```yaml
server:
  port: ":8085"
  gin_log: false

# ── 数据库配置 (共享 PostgreSQL) ──
database:
  host: "127.0.0.1"
  port: 5432
  user: "postgres"
  password: "YOUR_POSTGRES_PASSWORD"
  dbname: "code_shield"
  sslmode: "disable"
  prefer_simple_protocol: true   # 启用简单协议，防止预编译语句缓存异常

# ── 认证配置 (接入 code-common) ──
auth:
  jwt_secret: "YOUR_SHARED_JWT_SECRET_KEY"
```

---

## 🚀 快速开始

### 1. 一键全系统构建
```bash
# 安装前端依赖、打包静态资源，并编译 Go 后端二进制
make build
```

### 2. 运行服务
```bash
# 启动 PDM 独立服务（默认监听 :8085 端口）
make run
```

### 3. 开发模式调试
*   **后端开发**：
    ```bash
    go run main.go -config config.yaml
    ```
*   **前端开发**：
    ```bash
    cd frontend
    npm install
    npm run dev  # 监听 5177 端口，API 自动代理至 8085 后端
    ```

### 4. 运行单元测试
```bash
# 验证高并发后缀生成安全性与唯一性
go test -v ./models
```

---

## 🔗 集成到 Code-Bench 网关

在 `code-bench` 的 `config.yaml` 中配置微服务反向代理：
```yaml
gateways:
  shield: "http://127.0.0.1:8080"
  pipeline: "http://127.0.0.1:8082"
  proto: "http://127.0.0.1:8083"
  pdm: "http://127.0.0.1:8085"       # PDM 微服务代理端点
```

主门户 `code-bench` 前端会通过模块联邦自动加载 `/pdm/assets/remoteEntry.js`，在 `/pdm/*` 路由下无缝嵌套呈现设备管理核心页面并共享 JWT 登录会话。

---

## 🏷️ 版本历史

### v0.3.0 (2026-08-14)
*   **全量接入 `code-common`**：
    - 后端下沉 `User`、`DatabaseConfig` 模型至 `code-common/backend`，统一鉴权与响应格式。
    - 前端使用 `@code/common` 的 `createApiClient`、`useTheme` 与通用常量。
*   **微前端菜单规范重构**：重构菜单配置为 `ModuleMenuConfig` 规范，组织分组数据并为菜单项配置 SVG 图标。
*   **权限体系全面收敛至 Roles**：彻底清理 `is_admin` 物理列与逻辑判断，全量收敛至基于 `Roles` 数组字段的 RBAC 权限体系（`super_admin`, `pdm_admin`）。

### v0.2.0 (2026-07-31)
*   **PostgreSQL PreferSimpleProtocol 支持**：开启简单协议防止预编译语句缓存异常导致的数据库操作异常。
*   **微前端样式作用域隔离**：前端全量 CSS 限定在 `.pdm-app` 容器，接入 Portal CSS 变量继承全局主题。
*   **`/api/me` 接口增强**：`GetMe` 接口返回 `roles` 数组字段，供前端动态控制操作权限。

### v0.1.0 (2026-06-08)
*   **初始化新建微服务**：建立 code-pdm 产品数据管理核心功能，包括设备型号管理、设备 ID 档案管理、Excel 双 Sheet 导出、并发安全后缀生成算法等。
*   **微前端集成**：基于 Vite Module Federation 实现微前端远程入口，嵌入 `code-bench` 宿主。
