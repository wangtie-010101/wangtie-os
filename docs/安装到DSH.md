# 安装到 DSH（离线可用）

王铁 OS 本身就是一个 **DSH bundle 插件**：装进某个 profile 后，`dsh web` 启动就会加载它，
访问 `http://127.0.0.1:3080/wangtie-os/` 即是王铁 OS —— **走 DSH 自己的端口（3080），不需要再开 3081 的预览服务**。

## 一条命令搞定

```sh
# 解压交付包，进入 wangtie-os 目录（包内已带 lib/ 构建产物与 node_modules，无需 npm install / npm run build）
node scripts/install-to-dsh.mjs
```

这一条命令会：**装包 → 登记 profile → 自动重启正在跑的 dsh web**（宿主半边只在进程启动时 import 一次，
不重启就不会加载插件），最后打印访问地址：

```sh
http://127.0.0.1:3080/wangtie-os/                  ← 王铁 OS
http://127.0.0.1:3080/wangtie-os/api/health        ← routes 应含 22 条，debug.mountState 应为空
```

重启的方式（脚本按顺序尝试，都不行才让你手动重启）：
1. profile 里装了 **dshmarket** → 走它的自重启接口 `POST /dsh-market/api/v1/restart`（最稳）；
2. 否则自己找监听端口的 dsh 进程，读出它的**完整命令行与工作目录**，起一个 detached 助手
   等端口释放后用同一命令拉起新进程，再给老进程发 SIGTERM（macOS/Linux 用 `lsof`/`ps`，
   Windows 用 `netstat`/`wmic`/`taskkill`）；
3. 都不可用 → 打印手动步骤：Ctrl-C 停掉 `dsh web`，再执行 `dsh web`。

只想安装、自己重启（例如不想让脚本碰进程）：加 `--no-restart`。
只想重启、不安装：`node scripts/install-to-dsh.mjs --restart-only`。

## 脚本做了什么（就这三件）

| 步骤 | 内容 | 为什么必需 |
| --- | --- | --- |
| 1 | 把本包复制到 `<DSH_HOME>/profiles/<profile>/node_modules/wangtie-os` | DSH 解析 bundle 名时先在 dsh 安装处找、再从 profile 目录找（`packages/boot/app-boot/src/profile.ts` 的 `packageDirFromAnchor`），包在这一层才可见 |
| 2 | 在 `<profile>/package.json` 的 `dsh.profile.bundles` 末尾追加 `"wangtie-os"` | bundle 层列表决定启动时应用哪些补丁；本包自带的 `cordis.patch.yml` 会被自动应用，插件行即由此插入 |
| 3 | 写入 `dependencies["wangtie-os"] = "file:<本包绝对路径>"` | 与官方 `pnpm dsh plugin add` 的结果一致；避免以后在 profile 里跑 `pnpm install` 时把这个目录当多余项清掉 |

脚本会备份 `<profile>/package.json` 为 `package.json.bak-<时间戳>`，可重复执行（幂等），
不需要 pnpm、不需要访问 npm 源、不需要重新构建。

## 常用参数

```sh
node scripts/install-to-dsh.mjs --dry-run               # 只打印将要做什么，不改文件
node scripts/install-to-dsh.mjs --profile web            # 指定 profile（缺省 web）
node scripts/install-to-dsh.mjs --dsh-home /path/.dsh    # 指定 DSH_HOME（缺省 $DSH_HOME 或 ~/.dsh）
node scripts/install-to-dsh.mjs --source /path/wangtie-os # 指定安装源（缺省＝本包所在目录）
node scripts/install-to-dsh.mjs --port 3080              # dsh web 端口（自动重启时用它找进程）
node scripts/install-to-dsh.mjs --no-restart             # 只安装，不重启
node scripts/install-to-dsh.mjs --restart-only           # 只重启，不安装
node scripts/install-to-dsh.mjs --uninstall              # 卸载：移除登记、依赖条目与目录（同样会自动重启）
node scripts/install-to-dsh.mjs --help
node scripts/install-to-dsh.mjs --help
```

> 提示：`dependencies` 里记的是 `file:<安装源绝对路径>`，所以**安装源目录别删、别挪**（默认就是解压出来的那份）。
> 如果解压目录是临时的，先把整包挪到固定位置再执行脚本；脚本遇到 `/tmp`、`/var/folders`、`下载/Downloads`
> 这类路径会给出提醒。

## 联网机器上的另一种装法

如果那台机器能访问 npm 源、也装了 pnpm，用官方命令等价（它会写同样的两处清单）：

```sh
cd <deepseek-harness 目录>
pnpm dsh plugin --profile web add file:<本包绝对路径>
```

## 排错

| 现象 | 原因与处理 |
| --- | --- |
| 重启后访问 `/wangtie-os/` 是 404 | 插件没被加载。先看 `api/health` 的 `debug.mountState`（非空里边有堆栈），再确认 `<profile>/package.json` 的 `dsh.profile.bundles` 里有 `wangtie-os`、且 `<profile>/node_modules/wangtie-os/lib/index.js` 存在 |
| `✗ 找不到 profile：... 下没有 cordis.yml` | `--profile` 写错，或该 DSH_HOME 还没初始化；先跑一次 `dsh web` 让它生成 profile |
| 起了服务但 OceanBase 管理/DDL 比较连不上库 | 插件只负责页面；连库由**跑 DSH 的那台机器**发起。内网地址要在那台机器上可达，DDL 比较读 `$DSH_HOME/wangtie-os/ddl-environments.json` |
| 想看日志确认插件行是否挂上 | 启动 `dsh web` 的终端里应有 `王铁 OS: mounted 30 routes under /wangtie-os` |
| 忘了装在哪 | 脚本每次运行都会打印 profile 路径与安装目标；也可 `ls ~/.dsh/profiles/*/node_modules/wangtie-os` |

## 与 3081 预览的关系

`npm run preview`（默认 3081）只是**不装 DSH 时的离线预览/开发自测**入口，功能与宿主版完全一致，
代码同源，两者可并存。已经装成 DSH 插件后，日常就用 3080 的 `/wangtie-os/`，不必再开 3081。
