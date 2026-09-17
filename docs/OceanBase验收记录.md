# OceanBase 管理（Oracle 模式）测试与验收记录

日期：2026-09-17。本轮把「OceanBase 管理」从 MySQL 兼容模式**整体改造为 Oracle 兼容模式**。

## 一、改造范围

| 层 | 文件 | 变化 |
| --- | --- | --- |
| 数据访问 | `src/oceanbase.ts` | 重写为 Oracle 方言：Oracle 数据字典；双引号标识符；`:pN` 绑定；ROWNUM 分页；主键/ROWID 定位；事务 + 锁行 + 原值比对（传输层见「一·六」：最终回到 mysql2） |
| 路由 | `src/oceanbase-routes.ts` | Oracle 错误号（ORA-xxxxx）与驱动错误码（DPY/NJS）翻译；连接阶段失败不再误报「结果未知」 |
| 前端 | `ui/oceanbase.js` | 模式（Schema）选择、服务名输入、端口默认 2883、主键/ROWID 提示、空串即 NULL 提示、日期格式占位、标识列/虚拟列/二进制列只读 |
| 依赖与构建 | `package.json`、`build.mjs`、`scripts/test.mjs` | 运行时依赖锁定为 **mysql2**（`oracledb` 仅保留给探针的 Oracle 协议对照实验） |
| 测试 | `tests/oceanbase.test.ts`、`tests/oceanbase-ui.test.mjs`、`tests/oceanbase.integration.test.ts` | 全部按 Oracle 语义重写；集成测试改为面向真实 Oracle 模式租户 |
| 文档 | `README.md`、`docs/OceanBase使用说明.md`、本文件 | 同步 Oracle 模式说明 |

## 一·五、连接参数一轮（2026-09-17 晚，按内网实机反馈修复）

现象：使用内网终端（网络策略已放通）从页面连接时报 **`请求中断，请刷新核实数据后再操作`**，
而同一台机器上用 OceanBase 客户端的「新建数据源」（类型 OceanBase Oracle）可以正常连上。

定位到的原因（对照两端截图）：

| 项 | 页面里填的 | 正确值 | 说明 |
| --- | --- | --- | --- |
| 服务名 | `OB_CLUSTER/obtenant_sit` | `obtenant_sit` | 服务名只能是租户名；集群名要进用户名（`#集群名`），不能进服务名 |
| 用户名 | `OB_USER` | `OB_USER@obtenant_sit#OB_CLUSTER` | ODP 靠用户名里的 `@租户#集群` 路由，只给用户名它认不出租户 |
| 使用 TLS | 已勾选 | 不勾 | ODP 2883 默认明文，勾选会走 TCPS 握手 |

代码侧的真实缺陷：**连接阶段没有超时**。驱动建连调用不在 15 秒操作超时的保护范围内，
驱动自身的 `transportConnectTimeout`（默认 20 秒）也不覆盖 TLS 握手阶段，于是请求一直挂到浏览器 28 秒 abort，
页面只能显示「请求中断」，看不出真实原因。

本轮修复：

1. **连接表单改成与 OceanBase 客户端一致的字段**：主机 IP/域名、端口、集群名（可选）、租户名、数据库用户名、数据库密码，
   外加「高级设置」里的服务名覆盖与 TLS。**拼接由服务端完成**（`OB_USER` + `obtenant_sit` + `OB_CLUSTER` → `OB_USER@obtenant_sit#OB_CLUSTER`，服务名 `obtenant_sit`），
   也兼容直接粘完整用户名 `user@租户#集群`。
2. **新增「智能解析」**：粘贴 `obclient -h 10.0.0.10 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'密码'`（或 `--host= --port= --user= --password=` 写法、
   `host:port` 连接串）自动回填各字段，与 OceanBase 客户端里的用法一致。
3. **连接阶段超时**：连接选项加 `transportConnectTimeout = 12s`，外层再包一层 12 秒 race 兜底（覆盖 TLS 握手与协议协商），
   **保证接口总在前端 28 秒之前给出明确错误**；迟到的连接会被主动关闭，避免连接泄漏。
4. **常见误操作直接点破**：勾了 TLS 却连明文端口 → 提示「TLS（TCPS）握手失败…请取消勾选」；
   租户名与用户名/集群名不一致、服务名带 `/`、用户名带 `@`/`#`、缺租户名 → 在本地就拦下并说明原因，不发请求。
5. **页面文案区分「请求超时」与「没有送达服务端」**，不再是笼统的「请求中断」。

补充（同日）：页面上仍报「连接数据库超时」后，进一步定位到**服务运行环境的网络限制**——本次开发机上的进程
**原始 TCP 出口被拦**（`1.1.1.1:443` 也超时，只有 HTTPS 走白名单能出去），因此从这台机器发起的任何
`10.0.0.10:2883` 连接都必然超时，与页面参数无关。为此增加**分层诊断**：

6. **连接前 5 秒 TCP 预检**（`node:net`，不经过驱动）：不通就明确报
   「网络层不通… 请确认『运行本服务的那台机器』（不是浏览器所在机器）能访问 主机:端口」，
   并附排查命令；通了才进入 Oracle 协议握手。
7. **协议层失败与网络层失败分开报**：TCP 通但握手超时 → 「TCP 已能连上，但对端没有完成 Oracle 协议握手」，
   提示检查服务名（＝租户名）、`用户@租户#集群` 写法、以及该入口是否支持 Oracle 模式租户。
8. 结论性提示写进文档：**必须在能访问目标数据库的机器上启动本服务**（本次实例跑在受限沙箱里，无法代连）。

补充（同日，协议层一轮）：内网实机重试后报错前进到 **「Oracle 协议握手超时：TCP 已能连上 10.0.0.10:2883，但对端没有完成 Oracle 协议握手」**，
说明网络层已通、问题收敛到 Oracle 协议层（服务名/入口/驱动兼容性）。为此新增：

9. **协议抓包探针 `tools/ob-probe.mjs` + `tools/tns-decode.mjs`**：本机起 TCP 代理，把驱动与数据库之间的字节
   按 TNS 包（8 字节头 + 负载）解析成 `CONNECT/ACCEPT/REFUSE/...`，并抽出 `SERVICE_NAME`、`HOST/PORT`、
   `ORA-/TNS-` 错误文本；据此可区分「服务端一个字节都没回」「回了 REFUSE（服务名/租户不认）」
   「回了 ACCEPT 但 TTC 协商失败（驱动兼容性）」。密码不进输出。
10. **厚模式(OCI) 开关**：设置 `ORACLE_CLIENT_LIB_DIR` 即调用 `initOracleClient()` 走 OCI；连接响应里带回
    `driver: thin|thick`，页面状态栏显示，便于确认当前跑的是哪种模式（thin 纯 JS 实现，个别入口兼容性不如 OCI）。
11. **握手超时错误信息**改为可执行的四步指引（核对服务名 → 换 2881/2883 → 跑探针 → 切厚模式对照）。

新增测试：`tests/tns-decode.test.mjs`（TNS 分包/半包、提示字段抽取、以及用假 ODP 端到端跑通探针并断言输出），
`npm test` 合计 **31 项通过**。

补充（同日，驱动事实核对）：拿到另一套**能正常连库的 Spring Boot 应用**的配置后确认了两件关键事实：

12. 该应用用的是 **OceanBase Connector/J**（`driver-class-name: com.oceanbase.jdbc.Driver`，
    `url: jdbc:oceanbase:oracle://10.0.0.10:2883/OB_USER`，`username: OB_USER@obtenant_sit#OB_CLUSTER`）——
    **不是 Oracle 官方驱动**，而且 URL 路径段是**用户名/模式（OB_USER）**而不是租户名。这解释了为什么
    「别人能连、我们连不上」：两边的客户端实现根本不是同一个。
13. 查 OceanBase 官方文档的驱动清单：Oracle 模式的官方驱动只有 **Java（Connector/J）、Python、C/C++，
    没有 Node.js 驱动**。因此 Node 侧只能用 node-oracledb（thin 或 OCI 厚模式）。
14. 据此把探针升级为 **`--variants` 模式**：一次把 8 种连接写法全试一遍并输出结果表
    （服务名=租户名 / 用户名 / 大写 / SYS、SID 写法、不带服务名、直连 2881），
    直接回答「是写法不对还是驱动不兼容」；同时让「高级设置 → 服务名」支持直接粘贴完整连接描述符。
15. 若 thin 与 OCI 都不行，则只能走桥接：Node 调本地小服务、由小服务用 OceanBase 官方驱动（Java/Python）连库。

`npm test` 现为 **33 项通过**（新增 variants 模式的端到端用例）。

## 一·六、架构纠正（2026-09-17，决定性一轮）

内网实机执行 `node tools/ob-probe.mjs --variants` 的结果：**8 种 Oracle 协议（TNS）写法，服务端全部「无响应」**
（客户端 CONNECT 已发出、TCP 已连通，但 ODP 一个字节都不回）。结合环境中另一套正常连库的应用配置
（`com.oceanbase.jdbc.Driver` = **OceanBase Connector/J**，MariaDB Connector/J 分支），结论明确：

> **OceanBase 的「Oracle 兼容模式」指的是租户的 SQL 方言，线协议仍是 MySQL 协议。**
> ODP 2883 不提供 Oracle 协议（TNS）服务，因此任何 Oracle 协议驱动（node-oracledb thin/OCI）都连不上。

据此把传输层改回 **mysql2（MySQL 协议）**，同时**保留**此前写好的整套 Oracle 方言层：

16. 传输：`mysql2/promise`，账号 `用户名@租户名#集群名`，`namedPlaceholders`（Oracle 方言 SQL 用 `:pN` 绑定）、
    `supportBigNumbers + bigNumberStrings`（NUMBER 保精度）、`dateStrings`（日期按字符串）、`multipleStatements: false`。
17. SQL 层不变：`ALL_USERS/ALL_TABLES/ALL_VIEWS/ALL_TAB_COLUMNS/ALL_CONSTRAINTS` 数据字典、双引号标识符、
    ROWNUM 分页、`TO_DATE/TO_TIMESTAMP`、主键/ROWID 定位、空串即 NULL。
18. 错误翻译扩成两套：Oracle `ORA-xxxxx`（经 MySQL 协议在 `sqlMessage` 里原样回传）+ MySQL `ER_*`/网络错误码。
19. 连接表单：「服务名」→「默认模式（可选）」（等价于 JDBC URL `host:port/` 后面那段）；README/使用说明同步改正。
20. 探针 `--variants` 增加 **MySQL 协议**一试，并在结论里直接指出「只有 MySQL 协议能连 → 应使用 MySQL 协议驱动」。

`npm test` 现为 **31 项通过**（`oracledb` 相关用例改写为 mysql2 口径；探针/HTTP/UI 用例保留）。

## 一·七、真实租户联调（2026-09-17，连接打通）

按 MySQL 协议改造后，用户在内网实机连接**成功**：

```
已连接 · 租户 obtenant_sit#OB_CLUSTER · OB_USER · OceanBase_3.2.3.3 (Build Aug 15 2023 10:19:42)
```

同时暴露两个问题并已修复：

21. **字段结构查询报 ORA-00904**：OceanBase 3.2 的 `ALL_TAB_COLUMNS` 没有 12c 才有的
    `IDENTITY_COLUMN` / `VIRTUAL_COLUMN`。因「行数据」依赖字段结构，表现是「能连、能选表，但点查询没反应」。
    → 字段结构查询改为**三档自动降级**（完整 → 去 12c 列 → 最保守），命中档位缓存复用；
    表列表、模式列表同样加了降级与兜底。
22. **模式（Schema）下拉为空**：`ALL_USERS` 无权限或无数据时不再直接返回空数组，
    依次回落到 `ALL_TABLES` 的 DISTINCT 属主、最后用当前账号兜底。
23. 新增 **🩺 自检**（`POST /api/oceanbase/verify`）：逐条跑账号/模式/版本/表列表/三档字段结构/主键/行查询
    并回报成功失败明细，便于按版本差异定位；错误提示现在会带上错误码（如 `（ORA-00904）`）。

`npm test` 现为 **33 项通过**（新增字典降级与模式兜底两组用例）。

## 一·八、真实数据可见后的一处 UI 缺陷（同日）

连接打通后用户反馈两个症状：**「模式（Schema）」下拉空白** + **点「查看字段结构」没反应**。
根因是同一个：`#ob-schema` 这个 id 被用了两次（既是模式下拉框，又是字段结构容器），
`querySelector` 只返回第一个元素——字段结构表格被写进了 `<select>` 内部（把下拉框塞成了 `<table>`），
真正的结构容器永远为空。

24. 拆分 id：下拉框保留 `#ob-schema`，结构容器改为 `#ob-structure-body`。
25. 字段结构从页面底部 `<details>` 改为**弹窗**（与编辑窗口一致，点了必定可见），
    并新增工具栏按钮「🧬 查看字段结构」。
26. 新增回归用例：断言模式下拉在加载数据后仍有选项且不含表格内容、字段结构弹窗能打开并列出字段——
    锁住这类「同名 id 互相覆盖」的问题。

`npm test` 现为 **34 项通过**。

## 一·九、多库连接与环境别名（2026-09-17）

实机确认「`OB_USER.SYS_BIZ_ORG` 43 条数据正常展示、按主键 ID 定位」之后，按需求新增多连接管理：

27. 新增 `src/connections.ts`：连接档案（名称 + **环境别名** + 地址/端口/集群/租户/账号/默认模式/TLS），
    持久化到 `$DSH_HOME/wangtie-os/connections.json`；**服务端不落盘密码**（保存接口只接收字段、丢弃密码）。
28. 新增路由动作 `POST /api/oceanbase/profiles`（`list` / `save` / `remove`），该动作不连数据库；
    同一「地址+账号」重复保存视为覆盖更新（id 归一化）。
29. 前端新增「连接档案」工具条：下拉切换 + 📥 载入 / 💾 保存为档案 / 🗑 删除；
    连接成功后状态栏显示「环境徽标 · 别名 · 租户 · 账号 · 版本」，环境名含「生产/prod」时徽标转红。
30. 免密可选：勾选「在本浏览器记住密码」时密码只写入本机 localStorage（按 地址/账号 归档），
    取消勾选重新保存即清除；档案接口始终不带密码。

新增测试：`connections` 的保存/覆盖/删除/校验与「密码不落盘」断言；前端多库保存 → 切换 → 连接 → 删除全流程
（含「档案接口不得携带密码」「状态栏显示环境别名」断言）。`npm test` 现为 **36 项通过**。

## 一·十、DDL 比较菜单（2026-09-17）

按需求新增独立菜单「DDL 比较」（位于「OceanBase 管理」下方），用于比较 **SIT ↔ UAT** 两套环境的表结构差异：

31. 新增 `config/ddl-environments.json`：环境的连接信息（主机/端口/集群/租户/账号/密码/比较模式/是否启用）
    放配置文件，页面不填也不显示密码；查找顺序 `DDL_ENV_CONFIG` → `config/ddl-environments.local.json`（Git 忽略）
    → `config/ddl-environments.json`（包内自带）→ `$DSH_HOME/wangtie-os/ddl-environments.json`。
32. 新增 `src/ddl-compare.ts`：读取两侧模式快照（对象/字段/主键/索引/注释/视图定义，共 5 条字典查询/侧），
    内存内逐对象比较，并**重建左右两侧 DDL 文本**（CREATE TABLE / CREATE OR REPLACE VIEW / COMMENT ON / CREATE INDEX）
    供对照；只读，不执行任何 DDL。
33. 新增路由动作 `POST /api/oceanbase/ddl-environments`（环境清单，**剥离密码**）与 `POST /api/oceanbase/ddl-compare`。
34. 新增 `ui/ddl-compare.js` 页面：环境卡片（含配置来源路径）→ 可选对象名过滤/含视图/含一致对象 → 比较 →
    概览统计 + 差异明细（`+` 新增 / `-` 缺失 / `~` 变更）+ 左右 DDL 对照 + 导出差异 CSV；菜单与工作台快捷入口同时登记。

联调中由自检脚本抓出并修复的缺陷：

35. **字典键未归一化**：字典查询返回的键是大写（`TABLE_NAME`/`COLUMN_NAME`…），按小写读取会全部得到 `undefined`，
    重建出的 DDL 会变成 `"undefined"`。已在 `rows()` 统一做小写键归一化，并加回归用例。
36. 主键自带索引不参与索引比较（避免两侧都报「索引差异」的噪音）。

测试：`npm test` 现为 **41 项通过**（新增差异计算、视图定义变化、配置装载与「清单不含密码」、字典键归一化回归、
以及 DDL 页面交互用例）。

37. **DDL 比较失败时报错不指明环境**（实机反馈 `ER_ACCESS_DENIED_ERROR` 但看不出是哪一侧）：
    两侧快照改为**独立执行**（失败不互相掩盖），失败时错误信息包含「哪套环境失败 + 原因 + 另一侧是否可读 +
    配置文件路径」，并把结构化明细（`details.left/right`）透给页面，标到对应环境卡片上；
    新增动作 `POST /api/oceanbase/ddl-test`（逐套环境测连接）与页面按钮「🔌 测试两个环境」。
    实测确认：SIT 侧参数与「OceanBase 管理」一致可连，失败来自 UAT 侧的账号（截图抄录的 `OB_USER_UAT`）。

## 二、本轮发现并修复的缺陷

改造过程中由测试与实机验证暴露、并已修复的问题：

1. **UPDATE 绑定名冲突（严重）**：`SET` 子句用 `:p1` 起名、`WHERE` 主键也用 `:p1`，后写入的键值会覆盖 SET 的值，
   导致「改 A 字段却把主键值写进 A」。改为键绑定统一 `:kN` 前缀，并加断言锁住 SQL 形状与绑定内容。
2. **数据字典键名大小写**：Oracle 把未加引号的列名/别名折叠成大写，原先按小写读取会得到 `undefined`，
   列名全部变成 `"undefined"`。字典查询统一做键名归一化（数据行仍保留真实列名）。
3. **筛选值未做类型校验**：日期/数字筛选值直接下发，报错只能来自数据库（ORA-01858 之类）。现在按列类型提前校验并给出格式提示。
4. **连接阶段失败被当成「写入结果未知」**：网络不可达时按旧的启发式会返回 503「结果尚未确认，勿重复提交」，
   误导用户以为可能已写入。现在区分「连接阶段失败（确定失败，可放心重试）」与「语句发出后断连（结果未知）」。
5. **前端连接表单重复提交崩溃**：请求进行中控件被禁用，`FormData` 取不到字段，`form.get('host').trim()` 抛
   `TypeError`。现在 `busy` 时直接忽略重复提交，并对取值做空值兜底；UI 测试新增「不允许出现未捕获异常」的断言。
6. 其他：Oracle 无布尔列类型（移除布尔绑定）、长文本 4000 字符上限提示、二进制/虚拟列拒绝写入、
   显式 `NULLS FIRST/LAST` 保证翻页稳定。

## 三、本轮已完成的自动化验证

- `npm run typecheck`：全项目类型检查通过（含 `tsconfig.oceanbase.json` 单独检查数据访问层）。
- `npm test`：**28 项通过，0 失败、0 未捕获异常**，含：
  - 单元测试 20 项：连接参数与租户服务名推导、标识符转义、类型展示、日期绑定表达式、筛选与排序 SQL、
    ROWNUM 分页与 ROWID 附加、插入（绑定/默认值/空串即 NULL/数字与日期校验/标识列与二进制列拒绝）、
    更新与删除（完整主键、原值比对、ROWID 定位）、并发冲突、事务提交回滚次数、错误翻译、
    路由来源与方法校验（405/403/413）；
  - 前端交互测试 4 项（jsdom）：连接 → 选模式/表 → 查询 → 筛选 → 新增 → 修改 → 冲突 → 删除 → 断开全流程，
    无主键堆表用 ROWID 编辑与删除，视图只读，CSV 转义与公式注入防护。
- 构建：`npm run build` 通过，`lib/index.js` 以 `mysql2/promise`（及探针用的 `oracledb`）为外部依赖。
- 实机 HTTP 冒烟（本机预览服务 `http://127.0.0.1:3081/wangtie-os/`，无真实租户，仅验证守门与错误路径）：
  - 页面与静态资源 200；`/api/health` 报 28 条路由、无挂载错误；
  - `mode: "mysql"` → 400 `仅支持 OceanBase Oracle 兼容模式租户…`；
  - 用户名无 `@` 且未填服务名 → 400 `请填写服务名…`；
  - 端口不通 → 400 `无法连接数据库：地址或端口不可达…`（`code: NJS-503`，`uncertain: false`）；
  - 主机名不可解析 → 400 `无法解析数据库主机名…`（`code: NJS-515`）；
  - 非 POST → 405，跨源 POST → 403。

## 四、尚未完成的验证（重要）

- **没有可用的 OceanBase Oracle 模式实例**：本机没有 Docker/WSL 与管理员权限，无法安装 OceanBase 本体，
  也没有客户环境的 Oracle 模式租户可连。因此：
  - `npm run test:integration` 已按 Oracle 模式重写（真实 HTTP + oracledb + 数据字典 + 事务/并发/ROWID/超时场景），
    但**本轮未在实际租户上执行**，不能视为已通过；
  - Oracle 协议握手、OBProxy 服务名（租户名）约定、`GENERATED ... IDENTITY` 与虚拟列、
    `SELECT ... FOR UPDATE` 锁等待、CLOB/BLOB 读取等行为**只在代码与假连接层面被验证**，
    需在真实租户上跑一遍集成测试后才能确认。
- 未覆盖：Oracle 模式的 TLS（TCPS 证书链）、超大 CLOB/BLOB、特殊类型（ROWID/UROWID/XMLType/INTERVAL）、
  分区表与 IOT、只读账号权限矩阵。

## 五、下一步建议

1. 准备一台可写的 Oracle 模式测试租户，执行 `OB_TEST_PROFILE=... npm run test:integration`；
   若 `IDENTITY` / 虚拟列 / `FOR UPDATE` 有版本差异，按该租户实际能力调整 DDL 与断言。
2. 确认客户环境的连接方式（OBProxy 2883 还是直连 2881、服务名是否等于租户名），必要时把默认值调整为客户约定。
3. 若需要把该模块同时装进 DSH Web（3080），记得 profile 的 `node_modules/wangtie-os` 也要能解析 `oracledb`。
