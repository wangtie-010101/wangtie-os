# 数据查询菜单（OceanBase Oracle 兼容模式）

「OceanBase 管理」用于真实连接 **OceanBase Oracle 兼容模式租户**，浏览模式（Schema）、表与视图、字段结构，
并对表数据做查询、新增、修改、删除和当前页 CSV 导出。

> 本模块**只支持 Oracle 模式租户**。MySQL 模式租户请使用「数据查询」里的通用连接工具；
> 服务端收到 `mode: "mysql"` 会直接拒绝（`仅支持 OceanBase Oracle 兼容模式租户`）。

## 关键事实：Oracle「兼容模式」指的是 SQL 方言，线协议是 MySQL 协议

一开始按「Oracle 模式 = Oracle 协议」实现（node-oracledb），结果在真实环境里始终握不上手。
用抓包探针在本环境实测：**TCP 能连上 ODP 2883，但对 8 种写法的 Oracle 协议（TNS）连接，服务端一个字节都不回**——
说明该入口根本不讲 Oracle 协议。而环境中另一套能正常连库的应用用的是
`com.oceanbase.jdbc.Driver`（**OceanBase Connector/J**），它本身就是 **MariaDB Connector/J 的分支**，
走的是 **MySQL 线协议**，Oracle 只是 SQL 方言层。

因此本模块的架构是：

| 层 | 取什么 |
| --- | --- |
| 传输 | **MySQL 协议（mysql2）**，账号写成 `用户名@租户名#集群名`，端口 2883（ODP）/ 2881（直连 observer） |
| SQL | **Oracle 方言**：`ALL_*` 数据字典、双引号标识符、`ROWNUM` 分页、`TO_DATE/TO_TIMESTAMP`、`ROWID` 定位 |
| 语义 | 空串即 NULL、NUMBER 按字符串读取保精度、无 BOOLEAN 列类型 |

也就是说：**连接方式跟 OceanBase 官方 JDBC 一样，SQL 仍然是 Oracle 的写法。**

## 启动

```sh
cd wangtie-os
npm install        # 运行时依赖为 mysql2
npm run build
npm run preview    # 默认 http://127.0.0.1:3081/wangtie-os/
```

预览服务只监听 `127.0.0.1`；数据库接口使用真实驱动，不含演示数据。

安装到 DSH Web（可选）：构建后按 README 的 `dsh plugin --profile web add file:...` 安装并重启宿主。
**注意**：宿主 profile 里的 `node_modules/wangtie-os` 必须能解析 `mysql2`（运行时依赖，不会被打进 bundle）。

## 连接参数

字段与 OceanBase 客户端「新建数据源」保持一致，**不要手工拼 `user@租户#集群`**，页面会把它们拼好：

| 字段 | 说明 |
| --- | --- |
| 主机 IP/域名 | 数据库 IP 或域名 |
| 端口 | 默认 **2883**（OBProxy / ODP）。直连 observer 才用 2881 |
| 集群名（可选） | 如 `OB_CLUSTER`；拼成用户名里的 `#集群名` |
| 租户名 | 如 `obtenant_sit`。用于拼出 `用户名@租户名#集群名`（必填） |
| 数据库用户名 | 只填用户名本身，如 `OB_USER`（若粘了完整 `OB_USER@obtenant_sit#OB_CLUSTER` 也会自动拆开） |
| 数据库密码 | 仅保留在当前页面内存，断开或刷新即清除 |
| 高级设置 → 默认模式 | 可选，等价于 JDBC 连接串里 `host:port/` 后面那一段（通常就是用户名）；留空则用账号同名模式 |
| 高级设置 → 使用 TLS/SSL | **默认不要勾**。ODP 的 2883 默认明文，勾了会做 TLS 握手，通常直接失败 |

服务端最终使用的账号是 `用户名@租户名#集群名`（例如 `OB_USER@obtenant_sit#OB_CLUSTER`），连接地址 `主机:2883`，走 MySQL 协议。

**智能解析（可选）**：可以把 OceanBase 客户端 / obclient 里的连接信息整行粘进来，例如

```
obclient -h 10.0.0.10 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'密码'
```

点「智能解析」会自动把主机、端口、用户名、租户名、集群名、密码填进上面的字段（也支持 `--host= --port= --user= --password=` 这种写法）。

连接是真实的协议认证（不是端口探测），错误提示对应到具体原因：

- 账号/租户/密码错误 → `认证失败：用户名、租户或密码不正确`
- 端口不通 / 网络策略拦截 → `无法连接数据库：地址或端口不可达…`
- 地址不可达且一直没响应 → `连接数据库超时（已等待 12 秒）：请检查主机、端口、租户名与网络策略`
- 主机名解析不了 → `无法解析数据库主机名，请检查连接地址`
- 勾了 TLS 但端口是明文 → `TLS（TCPS）握手失败：该端口很可能没有启用 TLS…请取消勾选`
- 租户名与用户名里的租户/集群写得不一样 → 直接提示「不一致」，不会带着错参数去连

## 常见连接失败排查

连接失败会先在 **5 秒 TCP 预检**里判「网络层」，再走 MySQL 协议握手，两层原因完全不同：

1. **`网络层不通：连接超时（5000ms）… 请确认「运行本服务的那台机器」（不是浏览器所在机器）能访问 主机:端口`**
   → 跑服务的那台机器连不上数据库，跟页面参数无关。常见原因：
   - 服务跑在受限环境（容器/沙箱/跳板机），出网只放通 HTTP(S)、原始 TCP 被拦；
   - 服务在 A 机器、数据库在内网 B 网段，没有 VPN/路由/防火墙放通；
   - 端口写错（ODP 2883 / 直连 observer 2881）。
   排查命令（在**跑服务的那台机器**上执行）：
   ```sh
   node -e "const net=require('net');const s=net.connect({host:'10.0.0.10',port:2883},()=>{console.log('TCP 可达');s.end()});s.setTimeout(5000,()=>{console.log('TCP 超时');s.destroy()});s.on('error',e=>console.log('TCP 失败',e.code))"
   ```
2. **`认证失败：账号、租户或密码不正确`** → 账号必须是 `用户名@租户名#集群名`（页面已按「用户名 + 租户名 + 集群名」自动拼好）。
3. **`连接数据库超时：TCP 已能连上 … 但没有完成 MySQL 协议握手`** → 端口可能不是 ODP/observer 的数据库端口，
   或该地址前面有负载均衡/防火墙只放通了 TCP 却不转发。用探针核对：
   ```sh
   node tools/ob-probe.mjs --variants --host 10.0.0.10 --port 2883         --user OB_USER --tenant obtenant_sit --cluster OB_CLUSTER --password '密码'
   ```
   探针会依次试 8 种 Oracle 协议（TNS）写法，**最后再试一次 MySQL 协议**并给出结论。
   本环境实测结果：TNS 全部无响应、**MySQL 协议可连** —— 这也正是本模块改回 MySQL 协议的原因。
4. **勾了「使用 TLS/SSL」连不上** → ODP 默认明文，取消勾选再试。
5. **`默认模式` 填错** → 该字段等价于 JDBC 连接串 `host:port/` 后面那一段（通常就是用户名），一般留空即可。

> 说明：OceanBase Oracle 模式的**官方驱动只有 Java（Connector/J）、Python、C/C++，没有 Node.js 驱动**；
> Node 侧只能用 MySQL 协议驱动（mysql2），这也与官方 Connector/J 的底层协议一致。

## 不同版本的字典差异（已自动适配）

Oracle 兼容字典的列在不同版本并不一致，例如 **OceanBase 3.2 的 `ALL_TAB_COLUMNS` 没有 12c 才引入的
`IDENTITY_COLUMN` / `VIRTUAL_COLUMN`**，直接查会报 `ORA-00904`，而「行数据」必须先读到字段结构，
于是表现为「连接成功、能选表，但点查询没反应」。

模块对字段结构查询做了**三档自动降级**（完整 → 去掉 12c 列 → 最保守），命中哪一档会被缓存；
模式列表与表列表也有降级与兜底（`ALL_USERS` 取不到就退回 `ALL_TABLES` 的属主，再不行用当前账号），
保证「模式」下拉不会空着。

工具栏的 **🩺 自检** 按钮会逐条跑一遍字典与查询链路并列出成功/失败明细，
排查「这个版本的库到底缺了什么」时直接点它，把明细贴给开发即可。

## 多套连接与环境别名（多库切换）

页面顶部有「连接档案」工具条，用来管理多套数据库连接：

| 操作 | 说明 |
| --- | --- |
| 💾 保存为档案 | 把当前填写的连接「另存为」一条档案；同一地址+账号重复保存会覆盖更新，不会重复堆积 |
| 📥 载入 / 下拉切换 | 在下拉里选一条档案即回填连接信息，再点「连接数据库」即可切换过去 |
| 🗑 删除 | 删除选中的档案（同时清掉本浏览器里为它记住的密码） |

每条档案包含：**档案名称**（如「票据库 · 测试」）、**环境别名**（测试 / 准生产 / 生产，可自定义）、
主机、端口、集群名、租户名、用户名、默认模式、TLS。连接成功后状态栏会显示
「环境徽标 · 别名 · 租户 · 账号 · 版本」，避免在生产库上误操作（环境名含「生产/prod」时徽标变红）。

**存储与密码**：

- 档案由服务端保存在 `$DSH_HOME/wangtie-os/connections.json`，**只存地址与账号，不存密码**；
- 需要免输密码时勾选「在本浏览器记住密码」——密码只写入**本机浏览器的 localStorage**，
  取消勾选并重新保存即会清除；换浏览器/换机器需要重新输入；
- 保存档案时页面**不会把密码发给档案接口**。

## 操作方式

1. 填写连接参数并点「连接数据库」，成功后出现「模式（Schema）」与「数据表」两个下拉。
   **系统模式（SYS/SYSTEM/LBACSYS 等）默认不选中**，避免误操作。
2. 选择模式与表：可查看字段结构（类型、是否可空、默认值、主键/标识列/虚拟列/二进制）与表数据。
3. 筛选与排序：单字段条件（包含 / 等于 / 不等于 / 大于 / 大于等于 / 小于 / 小于等于 / 为 NULL / 不为 NULL）、
   升序降序、每页 20/50/100/200 条。日期筛选按 `YYYY-MM-DD` 或 `YYYY-MM-DD HH24:MI:SS` 填写，格式错会直接提示。
4. 「新增记录」：每个字段可选 **填写值 / NULL / 使用默认值**；标识列（IDENTITY）与虚拟列固定使用默认值。
5. 「编辑」：主键（或 ROWID）只读，只提交改动过的字段；保存时服务端在事务内锁行并逐列比对原值，
   记录已被他人修改则返回冲突，需要刷新后重试。
6. 「删除」：先展示定位条件（主键或 ROWID）再确认；一次只删一行。
7. 「导出当前页 CSV」：只导出当前页已显示的数据（UTF-8 BOM，防公式注入）。

## Oracle 语义与定位策略（与 MySQL 模式的不同之处）

- **一级对象叫模式（Schema）**，不是数据库；对象类型只有普通表与视图。
- **行定位**：有非二进制主键时用主键；**没有主键的堆表用 ROWID**（服务端在查询里附加 `wt_rowid` 回传）；
  视图没有 ROWID，只能查询。
- **空字符串即 NULL**：Oracle 里 `''` 与 `NULL` 等价，空串按 NULL 提交；NOT NULL 字段填空会直接报错。
- **日期/时间显式转换**：服务端按输入自动选择 `YYYY-MM-DD` / `YYYY-MM-DD HH24:MI:SS` / 带 `.FF` 的格式，
  不依赖会话的 `NLS_DATE_FORMAT`。
- **数字精度**：NUMBER 一律按字符串读取与回填，`NUMBER(30,12)`、19 位以上整数都不丢精度。
- **排序稳定性**：显式声明 `NULLS LAST`（升序）/ `NULLS FIRST`（降序），并追加主键作为翻页兜底。
- **二进制与大文本**：BLOB/RAW 以十六进制展示（超过 4 KB 截断并标注），不可编辑；CLOB 可按文本编辑。
- **系统模式与视图只读**：服务端返回可操作能力，前端据此禁用按钮。

## 范围与边界

- 只做**表数据 CRUD**：不含建库、建表、删表、改字段结构，也不是任意 SQL 控制台。
- 每次请求独立建立连接（无连接池），结束主动释放；单次操作超时 15 秒，前端请求 28 秒。
- 写入超时或中途断连返回「结果尚未确认」，前端关闭编辑框并要求重新查询核对，避免重复提交；
  而**连接阶段就失败**的情况明确报「确定失败」，不会误导用户重复提交。
- 不新增独立的用户登录体系：沿用 DSH/预览服务自身的访问控制，应通过 HTTPS 或仅本机访问。

## 测试

```sh
npm test          # 单元测试 + jsdom 前端交互测试（不需要数据库）
npm run typecheck # 全项目类型检查
npm run test:integration   # 需要一台真实的 OceanBase Oracle 模式租户
```

集成测试需要一个可写的 Oracle 模式租户，用配置文件指向它（**不要指向生产库**）：

```json
{ "mode": "oracle", "host": "10.0.0.10", "port": 2883,
  "cluster": "OB_CLUSTER", "tenant": "obtenant_sit", "user": "OB_USER", "password": "***" }
```
> `user` 也可以直接写成完整用户名 `OB_USER@obtenant_sit#OB_CLUSTER`（则 `tenant` / `cluster` 可省略）。

```sh
OB_TEST_PROFILE=.local-db/profile.json npm run test:integration
# 可选：OB_TEST_SCHEMA 指定建对象的模式（默认取用户名 @ 之前的部分并大写）
```

集成测试只在该账号自己的模式里创建 `WT_OB_*` 前缀的临时表/视图并在结束时删除，不创建或删除用户，也不改动任何既有对象。

## 官方参考

- OceanBase 连接 Oracle 模式租户：https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000002013254
- node-oracledb（thin 模式）：https://node-oracledb.readthedocs.io/
