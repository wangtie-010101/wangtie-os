# 王铁 OS

构建在 **DeepSeek Harness (DSH) Web** 之上的全屏业务应用框架 —— 深色侧边栏工作台 + 业务模块：
**工作台 / OceanBase 管理（Oracle 兼容模式）/ DDL 比较 / 知识库（票据·会计二级）/ 数据字典**，
以及 📝 **记事本**（印象笔记风格）、🧰 **常用开发工具**、🎮 **休息一下**（内置小游戏）、⏰ **健康提醒**。

- **OceanBase 管理**：真实连接 OceanBase **Oracle 兼容模式**租户（MySQL 线协议 + Oracle 方言 SQL），
  浏览模式（Schema）/表/视图/字段，分页筛选、按主键或 ROWID 增删改、当前页 CSV 导出。详见 [OceanBase 使用说明](docs/OceanBase使用说明.md)。
- **DDL 比较**：比较两个环境（SIT / UAT）的表结构差异（字段/主键/索引/注释/视图定义），
  连接信息读配置文件（页面不回传密码），详见 [DDL 比较使用说明](docs/DDL比较使用说明.md)。
- 本地可执行 `npm run build`、`npm run preview` 后访问 `http://127.0.0.1:3081/wangtie-os/`。

> 已移除的模块：**SQL 查询（演示）**（连接档案 + Mock SQL 编辑器）及其后端
> `/api/db/test`、`/api/sql/*`。原先侧边栏里名为「数据查询」的那一项就是 OceanBase 页面，
> 现已恢复并统一改名为「**OceanBase 管理**」——应用里不再有叫「数据查询」的模块。

本仓库是一个**独立的 DSH bundle 插件**（与 dshmarket 同构），安装进 web profile 后无需改动 DSH 本体。

## 架构

```
wangtie-os/
├── package.json          # 插件清单（dsh.bundle.patch 声明，类似 dshmarket）
├── cordis.patch.yml      # profile 层补丁：插入插件条目
├── config/
│   ├── ddl-environments.json          # DDL 比较的环境连接信息（含密码，注意权限，已在 .gitignore）
│   └── ddl-environments.example.json  # 提交到仓库的占位模板（密码写成 YOUR_PASSWORD）
├── build.mjs             # esbuild 构建（服务端单文件 bundle）
├── src/                  # 服务端（TypeScript，esbuild → lib/index.js）
│   ├── index.ts          #   cordis 插件入口 apply(ctx, config)：获取 webServer 并挂载路由
│   ├── routes.ts         #   /wangtie-os/api/* 全部 HTTP API（Mock 数据）—— 19 条
│   ├── static.ts         #   /wangtie-os/ 与 /wangtie-os/ui/* 静态资源托管（带路径穿越防护）
│   ├── http.ts           #   sendJson / sameOrigin / readJsonBody 工具
│   ├── config.ts         #   配置存储 $DSH_HOME/wangtie-os/config.json
│   ├── dbprobe.ts        #   TCP 可达性预检（连接诊断第一层，连库前先探网络）
│   ├── oceanbase.ts      #   OceanBase Oracle 兼容模式数据访问层（mysql2 传输 + Oracle 方言 SQL）
│   ├── oceanbase-routes.ts # /api/oceanbase/* 全部动作 + Oracle/MySQL 错误码翻译 —— 11 条
│   ├── connections.ts    #   连接档案（多库 + 环境别名，密码不落盘）
│   ├── ddl-compare.ts    #   DDL 比较：读配置 → 抓两侧字典快照 → 差异计算 + DDL 重建
│   ├── werun.ts          #   微信运动（小程序通道）步数同步
│   └── data.ts           #   演示数据（环境/服务/表/字典/知识文档/Agent 报告）
└── ui/                   # 前端（原生 JS SPA，无构建依赖）
    ├── index.html        #   入口页（王铁 OS）
    ├── style.css         #   全局样式
    ├── main.js           #   页面逻辑：页面模块 + 路由 + API 调用
    ├── oceanbase.js      #   OceanBase 管理页（Oracle 模式：Schema/表/字段/增删改查）
    ├── ddl-compare.js    #   DDL 比较页（SIT ↔ UAT 结构差异 + 左右 DDL 对照）
    ├── knowledge-data.js #   票据 / 会计知识库演示文档（前端内置，本地检索）
    └── games/            #   休息一下内置游戏（独立单文件 HTML，iframe 全屏运行）
        ├── thunder-force.html      #   雷霆战机（纵版射击）
        ├── snake.html              #   贪吃蛇
        └── plants-vs-zombies.html  #   植物大战僵尸
```

**运行链路**：`dsh web` 启动 → profile 层栈加载 `wangtie-os` → `apply()` 挂载 **33 条 HTTP 路由**：
19 条 `on('/api/*')` + 3 条静态资源会写进 `registeredPaths`；另外 11 条 `/api/oceanbase/*` 由
`mountOceanBase()` 直接注册，**不出现在 `api/health` 的 `routes` 清单里**（该清单只列前 22 条）。
浏览器访问 `http://127.0.0.1:3080/wangtie-os/` 进入应用。

**OceanBase 的传输层是 mysql2（MySQL 协议）**：Oracle「兼容模式」指租户的 SQL 方言，线协议仍是 MySQL 协议
（OceanBase Connector/J 即 MariaDB Connector/J 分支，实测 ODP 2883 不回应 Oracle 协议 TNS），
因此连接方式与官方 JDBC 一致、SQL 全部使用 Oracle 方言。

## 作为 DSH 插件安装（宿主 3080）

本包本身就是一个 **DSH bundle 插件**（`dsh.bundle.patch` + `cordis.patch.yml` + `dsh.client` 客户端半边），
装进 web profile 后由宿主托管，访问 `http://127.0.0.1:3080/wangtie-os/`（不再需要 3081 的本地预览）。

```sh
# 1) 构建（产出 lib/index.js 与 client/client.js）
node build.mjs

# 2) 装进 web profile（DSH 官方插件流程）
cd <deepseek-harness 目录>
pnpm dsh plugin --profile web add file:<本项目绝对路径>

# 3) 重启 dsh web —— 宿主半边只在进程启动时 import 一次，改代码后必须重启
#    （ui/ 静态文件是每次请求读盘，改前端刷新浏览器即可；侧边栏按钮由 client-hmr 热更新）

# 4) 打开
#    http://127.0.0.1:3080/wangtie-os/
#    http://127.0.0.1:3080/wangtie-os/api/health   （routes 应列出 22 条，debug.mountState 为空）
```

要点：

- **宿主进程必须能解析 `mysql2`**（本包 `dependencies` 已声明；profile 的 node_modules 里通常已有）；
- **DDL 比较的配置文件**放在 `$DSH_HOME/wangtie-os/ddl-environments.json`（推荐，不用进 node_modules）
  或 `<项目>/config/ddl-environments.json`；页面顶部会显示实际生效的路径；
- 侧边栏入口按钮打开**同源** `/wangtie-os/`；
- 只用预览服务（`npm run preview`，默认 3081）时功能与宿主版完全一致，两者可并存，代码同源。

## DDL 比较的数据库地址从哪来

**地址不在页面上填，只在配置文件里**（页面只显示环境名与配置文件路径，不回传密码）。
服务端按下面的顺序找**第一个存在的文件**（`src/ddl-compare.ts` 的 `configCandidates()`）：

| 优先级 | 路径 | 说明 |
| --- | --- | --- |
| 1 | `$DDL_ENV_CONFIG` | 环境变量指定的文件；必须在启动 `dsh web` 的那个进程环境里设置 |
| 2 | `$DSH_HOME/wangtie-os/ddl-environments.json` | **默认生效路径**（本机为 `/Users/wangtie/.dsh/wangtie-os/ddl-environments.json`）：装进 DSH 宿主后项目目录在 node_modules 里，改这里最顺手 |
| 3 | `<项目>/config/ddl-environments.local.json` | 项目内本机覆盖（建议加进 .gitignore） |
| 4 | `<项目>/config/ddl-environments.json` | 包内自带默认值（`<项目>` = 实际加载的那个包目录，宿主下是 `~/.dsh/profiles/web/node_modules/wangtie-os`） |

文件形状（下面是占位示例；真实地址与密码只写在上面那个配置文件里，**不进仓库**——
`config/ddl-environments.json` 已在 `.gitignore` 中，仓库里只有 `config/ddl-environments.example.json` 模板）：

```jsonc
{
  "environments": [
    { "key": "SIT", "name": "示例环境-sit", "host": "10.0.0.10", "port": 2883,
      "cluster": "OB_CLUSTER", "tenant": "obtenant_sit", "user": "OB_USER",
      "password": "YOUR_PASSWORD", "schema": "", "enabled": true },
    { "key": "UAT", "name": "示例环境-uat", "host": "10.0.0.10", "port": 2883,
      "cluster": "OB_CLUSTER", "tenant": "obtenant_uat", "user": "OB_USER_UAT",
      "password": "YOUR_PASSWORD", "schema": "", "enabled": true }
  ]
}
```

- `host` / `port` 就是**数据库地址**（ODP 2883，直连 observer 用 2881）；账号会被拼成 `用户@租户#集群`；
- `schema` 留空＝取用户名；
- 至少要有 2 个 `enabled` 的环境才能比较；
- **改完不用重启**：`environmentsForDisplay()` / `runComparison()` 每次请求都重新读盘；
- 页面顶部「比较环境」卡片右侧显示的就是当前生效的完整路径，肉眼即可确认改的是哪一份。

## 安装（开发方式）

```sh
# 在 wangtie-os 目录构建（首次需 npm install：含 esbuild 与运行时依赖 mysql2）
cd wangtie-os
npm install       # 安装依赖（mysql2 是「OceanBase 管理」的数据库驱动）
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
| 工作台 | `PAGES.dashboard` | `GET /api/app-info` | 首页入口（快捷卡片）+ 我的功能 / 系统概览 |
| OceanBase 管理 | `PAGES.oceanbase` / `ui/oceanbase.js` | `POST /api/oceanbase/{connect,verify,profiles,tables,rows,insert,update,delete}` | **Oracle 兼容模式**租户真实连接（mysql2 + Oracle 方言）：模式（Schema）/表/视图/字段浏览、分页排序筛选、按主键或 ROWID 增删改查、当前页 CSV 导出；写前事务内锁行并校验原值，冲突 409、超时/断连标记结果未确认；连接档案可存多套（别名 + 环境，密码不落盘） |
| DDL 比较 | `PAGES.ddlcompare` / `ui/ddl-compare.js` | `POST /api/oceanbase/{ddl-environments,ddl-test,ddl-compare}` | 读配置文件里的两套环境 → 抓两侧 Oracle 字典快照 → 对象（表/视图）、字段增删与类型/可空/默认值/注释、主键、索引、表注释差异 + 左右 DDL 对照；页面可「测试两个环境」；只读比较，不下发任何 DDL |
| 知识库 | `PAGES.knowledge` | `GET /api/knowledge/search?q=`、`GET /api/knowledge/docs` | 二级知识库：**票据知识库**与**会计知识库**（内置 14 篇）；各自支持检索问答、粘贴/文件批量投喂，支持 .txt/.md/.json/**.docx（Word 自动提取正文）**（IndexedDB 持久化，`ui/knowledge-data.js`） |
| 数据字典 | `PAGES.dictionary` | `GET /api/dictionary/entries`、`POST /api/dictionary/import` | 检索/分类/一键导入 |
| 记事本 | `PAGES.notes` | —（纯前端，IndexedDB 持久化） | 印象笔记风格三栏笔记：笔记本分组/标签/置顶/Markdown 编辑与预览/搜索/自动保存/回收站/导出 .md 与 .json 备份恢复 |
| 常用开发工具 | `PAGES.devtools` | —（纯前端，无 API） | JSON、Base64、URL 编解码、时间戳、文本统计、大小写转换（大写/小写/词首/句首/反转/变量风格）、哈希（SHA-1/256/384/512、CRC32）、进制转换（BigInt）、正则测试、颜色转换（HEX/RGB/HSL）、UUID 生成、压缩工具（打包压缩/分段压缩/解压） |
| 休息一下 | `PAGES.entertainment` | —（纯前端，无 API） | 内置小游戏启动器：雷霆战机、贪吃蛇、植物大战僵尸全屏运行（游戏放 `ui/games/`，新增只需登记 `GAMES`） |
| 健康提醒 | `PAGES.health` | `POST /api/werun/sync`、`GET /api/health/werun/latest` | 到点提醒喝水 / 运动 / 休息 + 微信运动步数同步（小程序通道） |

其余 `/api/*`：`health`、`environments`、`services`、`config`、`agent/*`、`metadata/*`。
其中 `/api/metadata/*`（tables / table / compare / versions / alter-sql）目前没有前端页面调用，属遗留 Mock 接口。

## 后续扩展指南

1. **接入真实数据源**：把 `src/data.ts` 的 Mock 数据替换为真实查询（数据库、文档库），或直接在 `routes.ts` 各 handler 中调用内部服务；接口形状不需要改动前端。
2. **新增模块页**：`ui/main.js` 里加一个 `PAGES.xxx` 函数并在 `shell()` 的 nav 数组中登记；服务端在 `routes.ts` 增加 `on('/api/xxx', ...)`（像 OceanBase 这种「只接受同源 JSON POST」的动作组，可参照 `src/oceanbase-routes.ts`）。
3. **客户端插件化（可选）**：若希望「王铁 OS」作为 DSH 客户端插件挂进壳内导航（而非独立 URL），需实现 `./client` 导出（`window.__ModuleLoader__.load` 模块格式，参考 dshmarket）并在 package.json 补回 `dsh.client` 声明。

## 故障排查

- **接口 404 / health 里 `debug.mountState.apiError` 非空**：路由在挂载期就抛错了，`mountState.apiDetail`
  里带完整堆栈。注意宿主半边只在 `dsh web` 启动时 import 一次，改完代码必须重启才生效。
- **调用宿主的可调用服务（如 logger）**：不能写成 `const log = host.logger?.info` 再调用——脱壳会丢 `this`，
  报 `TypeError: this is not a function`；必须包一层箭头函数保住 receiver（见 `src/routes.ts`）。
- **DDL 比较连不上库**：先用页面上的「🔌 测试两个环境」，它会分别报告两侧失败原因；
  命令行可用 `node tools/ob-probe.mjs --variants` 一次性核对连接写法与协议，
  `tools/tns-decode.mjs` 用于解析 TNS 报文（其 Oracle 协议分支需要临时 `npm i oracledb`）。

## 安全说明

- 演示环境：Mock 数据、密码不落盘（连接档案只存别名/环境/地址）；
- 静态资源托管带路径穿越防护（`static.ts`）；
- 变更类接口（PUT/POST）在生产环境应加 `sameOrigin` 校验与权限控制；
- **OceanBase 管理 / DDL 比较** `/api/oceanbase/*` 只接受同源 JSON POST：写操作使用参数化绑定 + 双引号标识符转义，
  且必须有完整主键或 ROWID 才会下发 UPDATE/DELETE；错误响应只回错误号与中文原因，不回显 SQL、账号或原始行数据；
  连接密码仅存于浏览器页面内存（OceanBase 管理）或服务端配置文件（DDL 比较），不回写 localStorage / IndexedDB。

## 测试

```sh
npm test                     # 单元测试 + jsdom 前端交互测试 + TNS 报文探针测试（不接触真实数据库）
npm run typecheck            # 全项目类型检查
npm run typecheck:oceanbase  # 只检查 Oracle 数据访问层
npm run test:integration     # 需要一台真实 OceanBase Oracle 模式租户，见 docs/OceanBase使用说明.md
```
