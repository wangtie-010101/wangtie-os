/**
 * 王铁 OS — 演示数据（全部为静态 Mock）。
 * 框架阶段：让每个模块有可交互的真实数据流；接入真实环境时把各
 * 查询函数替换成真实的数据库/文档服务调用即可（见 routes.ts 各处 TODO）。
 */

export interface Column {
  readonly name: string
  readonly cn: string
  readonly type: string
  readonly pk?: boolean
  readonly comment?: string
  readonly enums?: readonly string[]
}

export interface TableMeta {
  readonly name: string
  readonly cn: string
  readonly domain: string
  readonly columns: readonly Column[]
}

export const ENVIRONMENTS = ['DEV', 'SIT', 'UAT1', 'UAT2'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/** 服务运行时模板：真实接入时从环境配置服务读取（可带密码，仅存内存）。 */
export interface ServiceTemplate {
  readonly name: string
  readonly cn: string
  readonly instances: readonly string[]
  readonly runtime: Record<string, {
    readonly workspace: string
    readonly workload: string
    readonly container: string
    readonly logPath: string
    readonly dbHost: string
    readonly dbPort: number
    readonly dbName: string
    readonly dbUser: string
    readonly schema: string
  }>
}

export const SERVICES: readonly ServiceTemplate[] = [
  {
    name: 'scb-online',
    cn: '票据联机服务（scb）',
    instances: ['scb-online', 'scb-batch'],
    runtime: {
      DEV: { workspace: 'scb-online', workload: 'dev', container: 'scb-online', logPath: '/home/rapp/log/scb-online/dev', dbHost: '10.23.144.199', dbPort: 1521, dbName: 'WIC_DEV', dbUser: 'wic_dev', schema: 'WIC_DEV' },
      SIT: { workspace: 'scb-online', workload: 'sit', container: 'wic-sit', logPath: '/home/rapp/log/scb-online/sit', dbHost: '10.23.144.212', dbPort: 1521, dbName: 'WIC_SIT', dbUser: 'wic_sit', schema: 'WIC_SIT' },
    },
  },
]

/* ------------------------------------------------------------------ *
 * 元数据：表清单 / 表结构 / 版本历史 / 环境差异
 * ------------------------------------------------------------------ */

const c = (name: string, cn: string, type: string, extra?: Partial<Column>): Column => ({ name, cn, type, ...extra })

export const TABLES: readonly TableMeta[] = [
  {
    name: 'WLC_PERS_WLT_INFO',
    cn: '零售钱包信息表',
    domain: '零售',
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('WIC_ID', '钱包ID', 'VARCHAR2(32)'),
      c('WIC_NAME', '钱包名称', 'VARCHAR2(32)'),
      c('WIC_UNI_NO', '钱包手机号码', 'VARCHAR2(16)'),
      c('WIC_TTL', '钱包级别', 'VARCHAR2(4)', { enums: ['W001 一类钱包', 'W002 二类钱包', 'W003 三类钱包', 'W004 四类钱包'] }),
      c('WIC_TTS', '钱包状态', 'VARCHAR2(2)', { enums: ['01 正常', '02 冻结', '03 注销'] }),
      c('WIC_TYPE', '钱包类别', 'VARCHAR2(2)'),
      c('WIC_OPEN_TM', '钱包开户时间', 'VARCHAR2(14)'),
      c('WIC_CND_TP', '钱包开立方式', 'VARCHAR2(4)'),
      c('WIC_OPER_DT', '钱包开户日期', 'VARCHAR2(8)'),
      c('OPEN_WLT_INQ_NO', '开户钱包流水号', 'VARCHAR2(64)'),
      c('WIC_EXP_END_TM', '钱包过期时间', 'VARCHAR2(14)'),
      c('WIC_ACC_ST', '钱包账户状态', 'VARCHAR2(2)'),
    ],
  },
  {
    name: 'WLC_PERS_WLT_INFO_EXT',
    cn: '零售钱包信息扩展表',
    domain: '零售',
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('WIC_ID', '钱包ID', 'VARCHAR2(32)'),
      c('WIC_CALL_BGN_FLAG', '允许手机号变更标志', 'CHAR(1)'),
      c('WIC_MOBILE_FLAG', '小额免密开通标志', 'CHAR(1)'),
      c('BAL_TRADE_ACT_OPEN_CLOSE_FLAG', '手机号变更功能开关标志', 'CHAR(1)'),
      c('BAL_BLOW_CNT', '小额免密按次校验数', 'NUMBER(4)'),
      c('BAL_BLOW_RND', '小额免密随机数', 'NUMBER(4)'),
    ],
  },
  {
    name: 'WIC_CORP_WLT_AC_BAL',
    cn: '企划钱包账户余额表',
    domain: '企划',
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('WIC_CORP_WLT_ID', '企划钱包ID', 'VARCHAR2(32)'),
      c('WIC_CORP_WLT_AC_COUNTER', '企划钱包账户序号', 'VARCHAR2(8)'),
      c('WIC_CORP_WLT_ACCC', '账户币种', 'VARCHAR2(3)', { enums: ['CNY 人民币'] }),
      c('BAL_AVAILABLE_AMT', '可用余额', 'NUMBER(22,2)'),
      c('BAL_FROZEN_AMT', '冻结金额', 'NUMBER(22,2)'),
      c('BAL_DIRECTION', '余额方向', 'VARCHAR2(2)'),
      c('BAL_UPDATE_TM', '余额更新时间', 'VARCHAR2(14)'),
    ],
  },
  {
    name: 'WLC_PERS_WLT_OPERATE_RECORD',
    cn: '零售钱包操作记录表',
    domain: '零售',
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('WIC_ID', '钱包ID', 'VARCHAR2(32)'),
      c('WIC_MOOS_TYPE', '操作类型', 'VARCHAR2(30)'),
      c('WIC_MOOS_REC_NO', '操作记录序号', 'VARCHAR2(30)'),
      c('WIC_MOOS_CN', '操作序号区间', 'VARCHAR2(30)'),
      c('WIC_MOOS_ST', '操作状态', 'VARCHAR2(30)'),
      c('FAIL_REASON', '失败原因', 'VARCHAR2(500)'),
      c('WIC_MOOS_CONTENT', '操作内容', 'VARCHAR2(1000)'),
      c('LOCAL_REF', '本地引用', 'VARCHAR2(30)'),
    ],
  },
  {
    name: 'WLC_FROZEN_APPRO_DETAIL',
    cn: '冻结审批明细表',
    domain: '合规',
    /** 注意：DEV/SIT 存在差异字段（用于「表结构比对」演示）。 */
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('WLC_WLT_ID', '钱包ID', 'VARCHAR2(32)'),
      c('ACQUIS_CHAN_CD', '发起渠道编码', 'VARCHAR2(8)'),
      c('APPRO_PROC_STS', '审批处理状态', 'VARCHAR2(2)'),
      c('BIZ_TYPE', '业务类型', 'VARCHAR2(8)'),
      c('APPRO_APPLY_TM', '审批申请时间', 'VARCHAR2(14)'),
      c('APPRO_OPR_ID', '审批操作员', 'VARCHAR2(32)'),
      c('APPRO_RESULT', '审批结果', 'VARCHAR2(2)'),
    ],
  },
  {
    name: 'DPC_OCP_BASE_CUSTINFO',
    cn: '客户基本信息表',
    domain: '客户',
    columns: [
      c('ID', '主键', 'VARCHAR2(32)', { pk: true }),
      c('CUST_ID', '客户ID', 'VARCHAR2(32)'),
      c('CUST_NM', '客户名称', 'VARCHAR2(128)'),
      c('CUST_TYPE', '客户类型', 'VARCHAR2(2)', { enums: ['01 个人', '02 企业'] }),
      c('CUST_ID_NO', '证件号码', 'VARCHAR2(32)'),
      c('CUST_MOBILE', '手机号码', 'VARCHAR2(16)'),
      c('CUST_ADDR', '客户地址', 'VARCHAR2(256)'),
    ],
  },
]

/** 版本历史：模拟「元数据版本管理」（每次结构变更生成一条）。 */
export interface VersionChange {
  readonly table: string
  readonly kind: '新增字段' | '类型变更'
  readonly field: string
  readonly from?: string
  readonly to?: string
}
export interface VersionRecord {
  readonly version: string
  readonly env: Environment
  readonly time: string
  readonly tables: number
  readonly fields: number
  readonly changed: readonly VersionChange[]
}

export const VERSIONS: readonly VersionRecord[] = [
  { version: 'v42', env: 'SIT', time: '2026/09/05 18:20:11', tables: 194, fields: 3571, changed: [{ table: 'SCB_BILL_REG_INFO', kind: '新增字段', field: 'ACPT_DT', to: 'VARCHAR2(8)' }] },
  { version: 'v41', env: 'UAT2', time: '2026/09/04 10:05:30', tables: 194, fields: 3570, changed: [{ table: 'SCB_BILL_DISC_INFO', kind: '修改注释', field: 'DISC_RATE', to: 'NUMBER(10,6)' }] },

  { version: 'v39', env: 'DEV', time: '2026/08/28 17:24:33', tables: 194, fields: 3569, changed: [{ table: 'WIC_CORP_WLT_AC_BAL', kind: '新增字段', field: 'BAL_DIRECTION', to: 'VARCHAR2(2)' }] },
  { version: 'v38', env: 'DEV', time: '2026/08/28 16:14:15', tables: 194, fields: 3568, changed: [
    { table: 'WLC_PERS_WLT_OPERATE_RECORD', kind: '新增字段', field: 'FAIL_REASON', to: 'VARCHAR2(500)' },
  ] },
  { version: 'v37', env: 'DEV', time: '2026/08/28 15:20:44', tables: 194, fields: 3567, changed: [
    { table: 'WLC_PERS_WLT_OPERATE_RECORD', kind: '类型变更', field: 'WIC_MOOS_TYPE', from: 'VARCHAR2(20)', to: 'VARCHAR2(30)' },
  ] },
  { version: 'v36', env: 'DEV', time: '2026/08/28 11:41:10', tables: 193, fields: 3546, changed: [
    { table: 'WLC_CORP_WLT_OPERATE_RECORD', kind: '新增字段', field: 'WLC_CORP_WLT_OPERATE_RECORD', to: 'VARCHAR2(30)' },
  ] },
]

/* ------------------------------------------------------------------ *
 * 数据字典
 * ------------------------------------------------------------------ */

export interface DictEntry {
  readonly id: number
  readonly cn: string
  readonly en: string
  readonly code: string
  readonly value: string
  readonly category: string
  readonly source: string
  readonly version: string
}

let dictSeq = 0
const d = (cn: string, en: string, code: string, value: string, category: string, source = '企业级服务', version = 'V0180918022'): DictEntry => ({ id: ++dictSeq, cn, en, code, value, category, source, version })

export const DICTIONARY: readonly DictEntry[] = [
  d('钱包级别', 'WIC_TTL', 'W001', '一类钱包', '钱包属性'),
  d('钱包级别', 'WIC_TTL', 'W002', '二类钱包', '钱包属性'),
  d('钱包级别', 'WIC_TTL', 'W003', '三类钱包', '钱包属性'),
  d('转账状态', 'SetRemittanceStatusCode', 'SWS01', '正常', '状态'),
  d('转账状态', 'SetRemittanceStatusCode', 'SWS02', '冻结', '状态'),
  d('转账状态', 'SetRemittanceStatusCode', 'SWS03', '注销', '状态'),
  d('交易指令码', 'DCSP_101', '101', '统一下单', '交易码'),
  d('交易指令码', 'DCSP_301', '301', '统一收单支付', '交易码'),
  d('交易指令码', 'DCSP_302', '302', '支付处理通知', '交易码'),
  d('交易指令码', 'DCSP_303', '303', '交易结果确认', '交易码'),
  d('客户类型', 'CUST_TYPE', '01', '个人客户', '状态'),
  d('客户类型', 'CUST_TYPE', '02', '企业客户', '状态'),
  d('钱包账户状态', 'WIC_ACC_ST', '01', '正常', '状态'),
  d('钱包账户状态', 'WIC_ACC_ST', '02', '冻结', '状态'),
  d('钱包账户状态', 'WIC_ACC_ST', '03', '注销', '状态'),
  d('币种', 'WIC_CUR', 'CNY', '人民币', '基础数据'),
]

/* ------------------------------------------------------------------ *
 * 票据知识库（RAG 演示文档）
 * ------------------------------------------------------------------ */

export interface DocTable {
  readonly caption: string
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}
export interface KnowledgeDoc {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly summary: string
  readonly paragraphs: readonly string[]
  readonly tables?: readonly DocTable[]
}

export const KNOWLEDGE_DOCS: readonly KnowledgeDoc[] = [
  {
    id: 'b001',
    title: '商业汇票到期托收（提示付款）流程',
    category: '业务规则',
    summary: '持票人在票据到期后应于提示付款期内通过票据系统发起提示付款，承兑人应在 3 日内应答；被拒付后可依法行使追索权。',
    paragraphs: [
      '提示付款：电子商业汇票到期后，持票人应在票据到期日起 10 日内通过电票系统（ECDS）向承兑人/付款人发起提示付款；逾期提示付款的，按《票据法》及监管规定处理。',
      '应答时限：承兑人（银行承兑汇票为承兑银行）应在收到提示付款请求后 3 日内作出应答；同意付款的，资金实时清算至持票人账户。',
      '拒付与追索：承兑人拒绝付款或无正当理由拖延的，持票人可取得拒付证明后，在法定期限内向出票人、背书人、保证人行使追索权（按背书顺序追索）。',
      '银行承兑汇票到期由承兑银行无条件付款（出票人账户余额不足时银行垫款并转为逾期贷款）；商业承兑汇票以承兑企业的商业信用为付款保证。',
    ],
    tables: [
      {
        caption: '到期托收时限判定表',
        headers: ['场景', '时限', '处理动作'],
        rows: [
          ['到期日起提示付款', '到期日起 10 日内', '通过 ECDS 发起提示付款'],
          ['逾期提示付款', '超过 10 日', '说明逾期原因后仍可提示，逾期风险自担'],
          ['承兑人拒付', '取得拒付证明后', '10 日内行使追索权'],
          ['银行承兑汇票到期', '到期日', '承兑银行无条件付款'],
        ],
      },
    ],
  },
  {
    id: 'b002',
    title: '电子商业汇票贴现业务要点',
    category: '业务规则',
    summary: '贴现指持票人将未到期票据背书转让给银行以获取资金；须具备真实贸易背景并提交合同与发票，利率与期限由双方商定。',
    paragraphs: [
      '贴现定义：贴现是持票人在票据到期前为获得资金，将票据权利背书转让给银行或贴现机构的融资行为；银行扣除贴现利息后将剩余款项支付给持票人。',
      '准入要求：申请贴现须具有真实贸易背景，并提供交易合同、增值税发票等证明文件；不得为不具有真实交易关系的票据办理贴现。',
      '期限与利率：贴现期限自贴现日起至票据到期日止（最长不超过 6 个月）；贴现利率参照市场利率与承兑人信用协商确定。',
      '后续流转：贴现后的票据由贴现行持有，可继续办理转贴现、再贴现，或持有至到期托收，形成票据二级市场。',
    ],
    tables: [
      {
        caption: '不得办理贴现的情形',
        headers: ['情形', '说明'],
        rows: [
          ['票据要素不全', '缺少出票人签章、金额、日期等必须记载事项'],
          ['背书不连续', '背书链断裂或背书人签章与记载不符'],
          ['贸易背景不真实', '无法提供真实交易合同或发票'],
          ['票据被冻结', '已挂失止付、公示催告或司法冻结'],
          ['到期日超限', '剩余期限超过监管规定的最长贴现期限'],
        ],
      },
    ],
  },
  {
    id: 'b003',
    title: '票据状态与生命周期对照表',
    category: '业务规则',
    summary: '电子商业汇票自出票登记、承兑、背书流转到到期结清的主要状态与可执行操作说明。',
    paragraphs: [
      '出票：出票人通过票据系统登记票据要素并交付收款人；收款人可签收、背书转让或退票。',
      '承兑与背书：银行或企业承兑后票据信用增强；持票人可通过背书将票据权利转让给他人，背书应当连续。',
      '到期处理：票据到期进入提示付款、结清环节；结清后票据状态为「已结清」，不可再进入流通。',
      '风险状态：处于挂失止付、公示催告、司法冻结等状态的票据，不得办理贴现、质押或转让。',
    ],
    tables: [
      {
        caption: '票据状态对照表',
        headers: ['状态', '含义', '可执行操作'],
        rows: [
          ['出票已登记', '出票人登记票据待交付', '交付收款人 / 撤回'],
          ['已承兑', '承兑人承诺到期付款', '背书转让 / 贴现 / 质押 / 持有到期'],
          ['背书转让中', '持票人转让票据权利', '继续背书 / 追索'],
          ['质押设立', '票据用于债务担保', '解押 / 质权人处置'],
          ['已贴现', '银行买入并持有', '转贴现 / 再贴现 / 托收'],
          ['已结清', '票款兑付完毕', '归档，不再流通'],
        ],
      },
    ],
  },
  {
    id: 'b004',
    title: '上海票据交易所（票交所）直连接口报文要素',
    category: '报文规范',
    summary: '商业银行与票据机构通过专线直连上海票据交易所交易系统，按标准报文完成出票、贴现、交易与清算等全流程指令。',
    paragraphs: [
      '系统接入：商业银行及票据机构通过专线直连上海票据交易所（SHCP）票据交易系统，报文采用加解密与数字签名保障安全。',
      '报文要素：每笔报文须包含报文标识、发起机构、交易类型、票据号码、票据金额、到期日、收付方账号等关键要素。',
      '交易类型：覆盖出票登记、承兑、背书转让、贴现申请、转贴现、回购、到期提示付款与追索等票据全生命周期指令。',
    ],
    tables: [
      {
        caption: '报文字段说明',
        headers: ['序号', '属性', '报文名', '类型', '说明'],
        rows: [
          ['1', '报文标识', '报文唯一编号', 'String(32)', '全局唯一'],
          ['2', '发起机构', '机构代码', 'String(12)', '票交所会员代码'],
          ['3', '票据要素', '票据号码', 'String(30)', 'ECDS 唯一票据号'],
          ['4', '交易指令', '交易类型', 'String(8)', '如 101-出票登记'],
          ['5', '金额', '票据金额', 'String(20)', '单位：元，保留两位'],
          ['6', '期限', '到期日', 'Date(YYYYMMDD)', '用于托收与贴现计息'],
        ],
      },
    ],
  },
  {
    id: 'b005',
    title: '银行承兑汇票与商业承兑汇票的对比',
    category: '业务规则',
    summary: '银行承兑汇票由银行承兑并依托银行信用到期付款，流通性与融资性最强；商业承兑汇票由企业承兑，以企业商业信用为付款保证。',
    paragraphs: [
      '银行承兑汇票（银票）由承兑银行承兑，到期由银行无条件付款，凭借银行信用在票据市场流通性最好、贴现成本最低。',
      '商业承兑汇票（商票）由出票企业承兑，付款依赖承兑企业的商业信用；由核心企业签发并经供应链确认的商票，可通过供应链票据平台贴现融资。',
      '银票到期承兑行垫款后，对出票人形成逾期贷款并计收罚息；商票到期如承兑人资金不足，持票人需依约行使追索权。',
    ],
    tables: [
      {
        caption: '银票与商票对比表',
        headers: ['对比项', '银行承兑汇票', '商业承兑汇票'],
        rows: [
          ['承兑主体', '承兑银行', '出票企业（承兑人）'],
          ['付款信用', '银行信用', '企业商业信用'],
          ['贴现难度', '低，银行普遍接受', '较高，取决于承兑人资质'],
          ['到期兑付', '承兑行无条件付款', '承兑人账户资金安排'],
          ['常见期限', '最长 1 年', '通常 6 个月至 1 年'],
        ],
      },
    ],
  },
  {
    id: 'b006',
    title: '票据质押业务：设立、解押与质权人处置',
    category: '业务规则',
    summary: '持票人以未到期票据为债务担保设定质押，质权人取得质权；债务清偿后解除质押，逾期未清偿的质权人可依法行使质权。',
    paragraphs: [
      '设立：出质人与质权人签订质押合同，并在票据系统登记票据为「质押」状态；纸质票据应背书「质押」字样并交付。',
      '效力：质押设立后，未经质权人同意，出质人不得转让或再质押该票据；票据到期时质权人可直接托收票款用于清偿债务。',
      '解押与处置：主债务清偿后办理质押解除；出质人逾期不清偿的，质权人可依法托收、变卖或通过司法程序实现质权。',
    ],
    tables: [
      {
        caption: '票据质押流程要点',
        headers: ['环节', '操作', '注意事项'],
        rows: [
          ['设立', '签质押合同 + 系统登记质押', '须为合法有效未到期票据'],
          ['存续期', '质权人持有票据/质权', '未经同意不得转让、再质押'],
          ['到期托收', '质权人提示付款', '票款优先清偿被担保债务'],
          ['解押', '债务清偿后解除登记', '及时解除避免影响流转'],
        ],
      },
    ],
  },
  {
    id: 'b007',
    title: '票据追索权：行使条件、对象与时效',
    category: '业务规则',
    summary: '持票人到期被拒付或承兑被拒绝后，可凭拒付证明向出票人、背书人、保证人行使追索权；首次追索时效 6 个月、再追索 3 个月。',
    paragraphs: [
      '行使条件：票据到期被拒绝付款，或汇票被拒绝承兑，或承兑人、付款人死亡、逃匿、被依法宣告破产或因违法被责令终止业务活动。',
      '追索对象：出票人、背书人、承兑人和保证人对持票人承担连带责任；持票人可不按背书顺序对其中任何一人行使追索权。',
      '时效：持票人对前手的追索权自被拒绝承兑或被拒绝付款之日起 6 个月；再追索权自清偿日或被提起诉讼之日起 3 个月，逾期权利消灭。',
    ],
    tables: [
      {
        caption: '追索权时效对照表',
        headers: ['权利', '起算点', '时效'],
        rows: [
          ['首次追索权', '被拒绝承兑/付款之日', '6 个月'],
          ['再追索权', '清偿日或被提起诉讼之日', '3 个月'],
          ['票据付款请求权', '票据到期日', '2 年（对出票人/承兑人）'],
        ],
      },
    ],
  },
  {
    id: 'b008',
    title: '电子商业汇票（ECDS）业务规则概览',
    category: '业务规则',
    summary: '电子商业汇票以数据电文形式签发与流转，全程电子化；新一代票据系统支持按金额拆分流转，单张最长 1 年。',
    paragraphs: [
      '电子商业汇票自 2009 年通过电子商业汇票系统（ECDS）运行，出票、承兑、背书、贴现、质押、托收等环节全部线上办理。',
      '新一代票据业务系统（2022 年起推广）支持票据等分化、按金额拆分流转，提升了中小企业支付与融资的灵活性。',
      '电票不存在伪造变造票面风险，票据状态以系统登记为准；纸票须通过票交所系统登记托管后方可进入电子化交易。',
    ],
    tables: [
      {
        caption: '电子商业汇票要点',
        headers: ['要素', '说明'],
        rows: [
          ['载体', '数据电文，全程电子化'],
          ['最长期限', '1 年'],
          ['拆分流转', '新一代票据支持按金额拆分'],
          ['背书方式', '系统内电子背书，自动连续'],
          ['真伪核验', '以票据系统登记状态为准'],
        ],
      },
    ],
  },
  {
    id: 'b009',
    title: '票据贴现利息与实付金额计算',
    category: '业务规则',
    summary: '贴现利息=票面金额×年化贴现利率÷360×贴现天数，实付金额=票面金额-贴现利息；贴现天数按实际天数（算头不算尾）计算。',
    paragraphs: [
      '贴现天数：自贴现银行实际付款日起至票据到期日前一日止的实际天数，通常采用「算头不算尾」；异地票据按惯例加 3 天邮程。',
      '计息公式：贴现利息 = 票面金额 × 年化贴现利率 ÷ 360 × 贴现天数；实付贴现金额 = 票面金额 − 贴现利息。',
      '示例：票面金额 100 万元、剩余期限 90 天、年化贴现利率 2.0%，则利息 = 1000000 × 2% ÷ 360 × 90 = 5000 元，实付 99.5 万元。',
    ],
    tables: [
      {
        caption: '贴现计息示例',
        headers: ['项目', '数值'],
        rows: [
          ['票面金额', '1,000,000 元'],
          ['贴现天数', '90 天'],
          ['年化利率', '2.0%'],
          ['贴现利息', '5,000 元'],
          ['实付金额', '995,000 元'],
        ],
      },
    ],
  },
  {
    id: 'b010',
    title: '票据风险防范与反欺诈要点',
    category: '业务规则',
    summary: '票据常见风险包括伪假票据、一票多卖、重复质押、虚假贸易背景等；应通过票交所系统核验状态、校验贸易背景并警惕异常交易。',
    paragraphs: [
      '常见风险：克隆票与伪造票、一票多卖、同一票据重复质押、背书不连续、以虚假贸易背景套取贴现资金、承兑人恶意拒付等。',
      '防控措施：通过票交所/ECDS 查询票据登记状态与权利归属；核对票面防伪要素；贴现前校验贸易合同与发票；关注挂失止付、公示催告与司法冻结信息。',
      '发现异常应立即停止交易并保全证据，向票交所报告或通过司法途径主张权利，避免扩大损失。',
    ],
    tables: [
      {
        caption: '票据风险与防控对照表',
        headers: ['风险', '典型表现', '防控要点'],
        rows: [
          ['伪假票据', '克隆票、变造票', '核验防伪要素与系统状态'],
          ['一票多卖', '同一票据重复转让', '查询权利归属与登记记录'],
          ['重复质押', '同一票据质押多次', '系统登记质押并锁定票据'],
          ['虚假贸易', '无真实合同套现', '核验合同、发票与物流'],
          ['司法冻结', '挂失止付/公示催告', '及时查询冻结名单'],
        ],
      },
    ],
  }
]

/* ------------------------------------------------------------------ *
 * 王铁 Agent —— 日志分析报告（演示数据）
 * ------------------------------------------------------------------ */

export interface AgentReport {
  readonly id: string
  readonly keyword: string
  readonly env: Environment
  readonly instance: string
  readonly createdAt: string
  readonly costMs: number
  readonly logSize: string
  readonly hits: number
  readonly exception: string
  readonly errorType: string
  readonly suggestion: string
  readonly relatedErrors: readonly string[]
  readonly codeSnippet: readonly string[]
  readonly links?: readonly string[]
}

export const AGENT_REPORTS: readonly AgentReport[] = [
  {
    id: 'rep-102',
    keyword: 'WLC1779977345791',
    env: 'DEV',
    instance: 'scb-online',
    createdAt: '2026/08/28 17:50:00',
    costMs: 9200,
    logSize: '518.6 KB',
    hits: 5,
    exception: '开户网点编码不能为空',
    errorType: 'com.bbbd.dal.core.exception.TransactionException',
    suggestion: '报错链：开户网点编码不能为空，校验服务请求入参网点编码缺失等原因。请上送网点编码（ccnMemberOrCustCd 等字段）',
    relatedErrors: [
      'TRANSACTION_EXCEPTION: WLC_TRANSACTION_EXCEPTION: 开户网点编码不能为空(1)',
      'TRANSACTION_INVALID: com.bbbd.dal.core.exception.TransactionException: 开户网点编码不能为空',
    ],
    codeSnippet: [
      '042  if (StringUtils.isBlank(acquirerId)) {',
      '043    throw new TransactionException("TRANSACTION_EXCEPTION", "开户网点编码不能为空");',
      '044  }',
    ],
  },
  {
    id: 'rep-101',
    keyword: 'WLC1779977345791',
    env: 'SIT',
    instance: 'scb-online',
    createdAt: '2026/08/28 16:03:20',
    costMs: 7400,
    logSize: '46.0 MB',
    hits: 4,
    exception: '数据库连接超时',
    errorType: 'com.bbbd.dal.core.exception.DataAccessException',
    suggestion: '数据库连接池打满，建议检查连接池配置（maxActive=50）与慢 SQL 语句。',
    relatedErrors: ['CannotGetJdbcConnectionException: 超过最大连接数'],
    codeSnippet: [],
  },
  {
    id: 'rep-103',
    keyword: 'WLC177996501387',
    env: 'DEV',
    instance: 'scb-batch',
    createdAt: '2026/08/28 11:20:41',
    costMs: 3100,
    logSize: '60.1 MB',
    hits: 3,
    exception: '批次状态未更新',
    errorType: 'com.bbbd.batch.core.exception.BatchException',
    suggestion: '批次处理进度未回写，请检查批次状态机与定时任务。',
    relatedErrors: ['BATCH_STATE_INVALID: 批次状态与预期不符'],
    codeSnippet: [],
  },
]
