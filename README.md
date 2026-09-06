# 王铁 OS

构建在 **DeepSeek Harness (DSH) Web** 之上的全屏业务应用框架 —— 参考「数币 OS」的架构与形态：
深色侧边栏工作台 + 业务模块（**工作台 / 数据查询 / 知识库（票据·会计二级）/ 王铁 Agent / 数据字典 / 元数据管理**）与 📝 **记事本**（印象笔记风格）、🧰 **常用开发工具**、🎮 **休息一下**（内置小游戏）。

本仓库是一个**独立的 DSH bundle 插件**（与 dshmarket 同构），安装进 web profile 后无需改动 DSH 本体。

## 架构

```
wangtie-os/
├── package.json          # 插件清单（dsh.bundle.patch 声明，类似 dshmarket）
├── cordis.patch.yml      # profile 层补丁：插入插件条目
├── build.mjs             # esbuild 构建（服务端单文件 bundle）
├── src/                  # 服务端（TypeScript，esbuild → lib/index.js）
│   ├── index.ts          #   cordis 插件入口 apply(ctx, config)：获取 webServer 并挂载路由
│   ├── routes.ts         #   /wangtie-os/api/* 全部 HTTP API（Mock 数据）
│   ├── static.ts         #   /wangtie-os/ 与 /wangtie-os/ui/* 静态资源托管（带路径穿越防护）
│   ├── http.ts           #   sendJson / sameOrigin / readJsonBody 工具
│   ├── config.ts         #   配置存储 $DSH_HOME/wangtie-os/config.json
│   ├── dbprobe.ts         #   数据库连接探测：TCP 可达性（/api/db/test）
│   └── data.ts           #   演示数据（环境/服务/表/字典/知识文档/Agent 报告）
└── ui/                   # 前端（原生 JS SPA，无构建依赖）
    ├── index.html        #   入口页（王铁 OS）
    ├── style.css         #   全局样式
    ├── main.js           #   页面逻辑：9 个页面模块 + 路由 + API 调用
    ├── knowledge-data.js #   票据知识库演示文档（前端内置，本地检索）
    └── games/            #   休息一下内置游戏（独立单文件 HTML，iframe 全屏运行）
        └── thunder-force.html  #   雷霆战机（纵版射击小游戏）
```

**运行链路**：`dsh web` 启动 → profile 层栈加载 `wangtie-os` → `apply()` 挂载 24 条 HTTP 路由 → 浏览器访问 `http://127.0.0.1:3080/wangtie-os/` 进入应用。

## 安装（开发方式）

```sh
# 在 wangtie-os 目录构建（首次需 npm i esbuild）
cd wangtie-os
npm install       # 安装 esbuild 等开发依赖
node build.mjs    # 产出 lib/index.js（ui/ 无需构建）

# 安装进 web profile（DSH 官方插件流程）
cd /Users/wangtie/Desktop/DeepSeek/deepseek-harness
pnpm dsh plugin --profile web add file:/Users/wangtie/Desktop/DeepSeek/deepseek-harness-workspace/wangtie-os

# 重启 DSH Web 后：
#   http://127.0.0.1:3080/wangtie-os/   （王铁 OS 全屏应用）
#   http://127.0.0.1:3080/wangtie-os/api/health
```

> 注：web profile 的 `pnpm-workspace.yaml` 中 `autoInstallPeers: false`，
> 插件的 peer 依赖（@deepseek-ai/cordis）由宿主提供，无需安装。

## 模块与 API 一览

| 模块 | 前端文件段落 | API | 说明 |
| --- | --- | --- | --- |
| 工作台 | `PAGES.dashboard` | `GET /api/app-info` | 首页入口 + 我的功能/系统概览 |
| 数据查询 | `PAGES.query` | `POST /api/db/test`、`POST /api/sql/query`、`GET /api/sql/tables` | 自定义数据库连接（类型/地址/端口/用户名/密码，本机保存）+ 真实 TCP 连通性测试（成功/失败）+ SQL 执行（Mock）与 CSV 导出 |
| 知识库 | `PAGES.knowledge` | `GET /api/knowledge/search?q=`、`GET /api/knowledge/docs` | 二级知识库：**票据知识库**（内置 10 篇）与**会计知识库**（内置 4 篇）；各自支持检索问答、粘贴/文件批量投喂，支持 .txt/.md/.json/**.docx（Word 自动提取正文）**（IndexedDB 持久化，`ui/knowledge-data.js`） |
| 王铁 Agent | `PAGES.agent` | `POST /api/agent/log-search`、`GET /api/agent/reports?id=` | 日志检索步骤 + 异常链摘要 + 历史报告 |
| 数据字典 | `PAGES.dictionary` | `GET /api/dictionary/entries`、`POST /api/dictionary/import` | 检索/分类/一键导入 |
| 元数据管理 | `PAGES.metadata` | `GET /api/metadata/tables`、`table`、`compare`、`versions`、`POST alter-sql` | 表清单/表结构/环境比对/版本历史/结构变更 SQL |
| 记事本 | `PAGES.notes` | —（纯前端，IndexedDB 持久化） | 印象笔记风格三栏笔记：笔记本分组/标签/置顶/Markdown 编辑与预览/搜索/自动保存/回收站/导出 .md 与 .json 备份恢复 |
| 常用开发工具 | `PAGES.devtools` | —（纯前端，无 API） | JSON、Base64、URL 编解码、时间戳、文本统计、哈希（SHA-1/256/384/512、CRC32）、进制转换（BigInt）、正则测试、颜色转换（HEX/RGB/HSL）、UUID 生成 |
| 休息一下 | `PAGES.entertainment` | —（纯前端，无 API） | 内置小游戏启动器：雷霆战机、贪吃蛇全屏运行（游戏放 `ui/games/`，新增只需登记 `GAMES`） |

## 后续扩展指南

1. **接入真实数据源**：把 `src/data.ts` 的 Mock 数据替换为真实查询（数据库、文档库），或直接在 `routes.ts` 各 handler 中调用内部服务；接口形状不需要改动前端。
2. **新增模块页**：`ui/main.js` 里加一个 `PAGES.xxx` 函数并在 `shell()` 的 nav 数组中登记；服务端在 `routes.ts` 增加 `on('/api/xxx', ...)`。
3. **客户端插件化（可选）**：若希望「王铁 OS」作为 DSH 客户端插件挂进壳内导航（而非独立 URL），需实现 `./client` 导出（`window.__ModuleLoader__.load` 模块格式，参考 dshmarket）并在 package.json 补回 `dsh.client` 声明。

## 安全说明

- 演示环境：Mock 数据、密码字段不落盘（`ui` 页明确提示）；
- 静态资源托管带路径穿越防护（`static.ts`）；
- 变更类接口（PUT/POST）在生产环境应加 `sameOrigin` 校验与权限控制。
