// src/routes.ts
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/http.ts
function sendJson(response, status, payload) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}
async function readJsonBody(request, maxBytes = 1 << 20) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      request.resume();
      throw new Error("request body too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function queryOf(request, key) {
  try {
    return new URL(request.url ?? "", "http://localhost").searchParams.get(key) ?? "";
  } catch {
    return "";
  }
}

// src/config.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
var DEFAULTS = {
  cceUser: "",
  codePath: ""
};
function dshHome() {
  return resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
}
function configDir() {
  return join(dshHome(), "wangtie-os");
}
function configFile() {
  return join(configDir(), "config.json");
}
function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(configFile(), "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveConfig(config) {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configFile(), JSON.stringify(config, null, 2), "utf8");
}

// src/data.ts
var ENVIRONMENTS = ["DEV", "SIT", "UAT1", "UAT2"];
var SERVICES = [
  {
    name: "scb-online",
    cn: "\u7968\u636E\u8054\u673A\u670D\u52A1\uFF08scb\uFF09",
    instances: ["scb-online", "scb-batch"],
    runtime: {
      DEV: { workspace: "scb-online", workload: "dev", container: "scb-online", logPath: "/home/rapp/log/scb-online/dev", dbHost: "10.23.144.199", dbPort: 1521, dbName: "WIC_DEV", dbUser: "wic_dev", schema: "WIC_DEV" },
      SIT: { workspace: "scb-online", workload: "sit", container: "wic-sit", logPath: "/home/rapp/log/scb-online/sit", dbHost: "10.23.144.212", dbPort: 1521, dbName: "WIC_SIT", dbUser: "wic_sit", schema: "WIC_SIT" }
    }
  }
];
var c = (name2, cn, type, extra) => ({ name: name2, cn, type, ...extra });
var TABLES = [
  {
    name: "WLC_PERS_WLT_INFO",
    cn: "\u96F6\u552E\u94B1\u5305\u4FE1\u606F\u8868",
    domain: "\u96F6\u552E",
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("WIC_ID", "\u94B1\u5305ID", "VARCHAR2(32)"),
      c("WIC_NAME", "\u94B1\u5305\u540D\u79F0", "VARCHAR2(32)"),
      c("WIC_UNI_NO", "\u94B1\u5305\u624B\u673A\u53F7\u7801", "VARCHAR2(16)"),
      c("WIC_TTL", "\u94B1\u5305\u7EA7\u522B", "VARCHAR2(4)", { enums: ["W001 \u4E00\u7C7B\u94B1\u5305", "W002 \u4E8C\u7C7B\u94B1\u5305", "W003 \u4E09\u7C7B\u94B1\u5305", "W004 \u56DB\u7C7B\u94B1\u5305"] }),
      c("WIC_TTS", "\u94B1\u5305\u72B6\u6001", "VARCHAR2(2)", { enums: ["01 \u6B63\u5E38", "02 \u51BB\u7ED3", "03 \u6CE8\u9500"] }),
      c("WIC_TYPE", "\u94B1\u5305\u7C7B\u522B", "VARCHAR2(2)"),
      c("WIC_OPEN_TM", "\u94B1\u5305\u5F00\u6237\u65F6\u95F4", "VARCHAR2(14)"),
      c("WIC_CND_TP", "\u94B1\u5305\u5F00\u7ACB\u65B9\u5F0F", "VARCHAR2(4)"),
      c("WIC_OPER_DT", "\u94B1\u5305\u5F00\u6237\u65E5\u671F", "VARCHAR2(8)"),
      c("OPEN_WLT_INQ_NO", "\u5F00\u6237\u94B1\u5305\u6D41\u6C34\u53F7", "VARCHAR2(64)"),
      c("WIC_EXP_END_TM", "\u94B1\u5305\u8FC7\u671F\u65F6\u95F4", "VARCHAR2(14)"),
      c("WIC_ACC_ST", "\u94B1\u5305\u8D26\u6237\u72B6\u6001", "VARCHAR2(2)")
    ]
  },
  {
    name: "WLC_PERS_WLT_INFO_EXT",
    cn: "\u96F6\u552E\u94B1\u5305\u4FE1\u606F\u6269\u5C55\u8868",
    domain: "\u96F6\u552E",
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("WIC_ID", "\u94B1\u5305ID", "VARCHAR2(32)"),
      c("WIC_CALL_BGN_FLAG", "\u5141\u8BB8\u624B\u673A\u53F7\u53D8\u66F4\u6807\u5FD7", "CHAR(1)"),
      c("WIC_MOBILE_FLAG", "\u5C0F\u989D\u514D\u5BC6\u5F00\u901A\u6807\u5FD7", "CHAR(1)"),
      c("BAL_TRADE_ACT_OPEN_CLOSE_FLAG", "\u624B\u673A\u53F7\u53D8\u66F4\u529F\u80FD\u5F00\u5173\u6807\u5FD7", "CHAR(1)"),
      c("BAL_BLOW_CNT", "\u5C0F\u989D\u514D\u5BC6\u6309\u6B21\u6821\u9A8C\u6570", "NUMBER(4)"),
      c("BAL_BLOW_RND", "\u5C0F\u989D\u514D\u5BC6\u968F\u673A\u6570", "NUMBER(4)")
    ]
  },
  {
    name: "WIC_CORP_WLT_AC_BAL",
    cn: "\u4F01\u5212\u94B1\u5305\u8D26\u6237\u4F59\u989D\u8868",
    domain: "\u4F01\u5212",
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("WIC_CORP_WLT_ID", "\u4F01\u5212\u94B1\u5305ID", "VARCHAR2(32)"),
      c("WIC_CORP_WLT_AC_COUNTER", "\u4F01\u5212\u94B1\u5305\u8D26\u6237\u5E8F\u53F7", "VARCHAR2(8)"),
      c("WIC_CORP_WLT_ACCC", "\u8D26\u6237\u5E01\u79CD", "VARCHAR2(3)", { enums: ["CNY \u4EBA\u6C11\u5E01"] }),
      c("BAL_AVAILABLE_AMT", "\u53EF\u7528\u4F59\u989D", "NUMBER(22,2)"),
      c("BAL_FROZEN_AMT", "\u51BB\u7ED3\u91D1\u989D", "NUMBER(22,2)"),
      c("BAL_DIRECTION", "\u4F59\u989D\u65B9\u5411", "VARCHAR2(2)"),
      c("BAL_UPDATE_TM", "\u4F59\u989D\u66F4\u65B0\u65F6\u95F4", "VARCHAR2(14)")
    ]
  },
  {
    name: "WLC_PERS_WLT_OPERATE_RECORD",
    cn: "\u96F6\u552E\u94B1\u5305\u64CD\u4F5C\u8BB0\u5F55\u8868",
    domain: "\u96F6\u552E",
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("WIC_ID", "\u94B1\u5305ID", "VARCHAR2(32)"),
      c("WIC_MOOS_TYPE", "\u64CD\u4F5C\u7C7B\u578B", "VARCHAR2(30)"),
      c("WIC_MOOS_REC_NO", "\u64CD\u4F5C\u8BB0\u5F55\u5E8F\u53F7", "VARCHAR2(30)"),
      c("WIC_MOOS_CN", "\u64CD\u4F5C\u5E8F\u53F7\u533A\u95F4", "VARCHAR2(30)"),
      c("WIC_MOOS_ST", "\u64CD\u4F5C\u72B6\u6001", "VARCHAR2(30)"),
      c("FAIL_REASON", "\u5931\u8D25\u539F\u56E0", "VARCHAR2(500)"),
      c("WIC_MOOS_CONTENT", "\u64CD\u4F5C\u5185\u5BB9", "VARCHAR2(1000)"),
      c("LOCAL_REF", "\u672C\u5730\u5F15\u7528", "VARCHAR2(30)")
    ]
  },
  {
    name: "WLC_FROZEN_APPRO_DETAIL",
    cn: "\u51BB\u7ED3\u5BA1\u6279\u660E\u7EC6\u8868",
    domain: "\u5408\u89C4",
    /** 注意：DEV/SIT 存在差异字段（用于「表结构比对」演示）。 */
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("WLC_WLT_ID", "\u94B1\u5305ID", "VARCHAR2(32)"),
      c("ACQUIS_CHAN_CD", "\u53D1\u8D77\u6E20\u9053\u7F16\u7801", "VARCHAR2(8)"),
      c("APPRO_PROC_STS", "\u5BA1\u6279\u5904\u7406\u72B6\u6001", "VARCHAR2(2)"),
      c("BIZ_TYPE", "\u4E1A\u52A1\u7C7B\u578B", "VARCHAR2(8)"),
      c("APPRO_APPLY_TM", "\u5BA1\u6279\u7533\u8BF7\u65F6\u95F4", "VARCHAR2(14)"),
      c("APPRO_OPR_ID", "\u5BA1\u6279\u64CD\u4F5C\u5458", "VARCHAR2(32)"),
      c("APPRO_RESULT", "\u5BA1\u6279\u7ED3\u679C", "VARCHAR2(2)")
    ]
  },
  {
    name: "DPC_OCP_BASE_CUSTINFO",
    cn: "\u5BA2\u6237\u57FA\u672C\u4FE1\u606F\u8868",
    domain: "\u5BA2\u6237",
    columns: [
      c("ID", "\u4E3B\u952E", "VARCHAR2(32)", { pk: true }),
      c("CUST_ID", "\u5BA2\u6237ID", "VARCHAR2(32)"),
      c("CUST_NM", "\u5BA2\u6237\u540D\u79F0", "VARCHAR2(128)"),
      c("CUST_TYPE", "\u5BA2\u6237\u7C7B\u578B", "VARCHAR2(2)", { enums: ["01 \u4E2A\u4EBA", "02 \u4F01\u4E1A"] }),
      c("CUST_ID_NO", "\u8BC1\u4EF6\u53F7\u7801", "VARCHAR2(32)"),
      c("CUST_MOBILE", "\u624B\u673A\u53F7\u7801", "VARCHAR2(16)"),
      c("CUST_ADDR", "\u5BA2\u6237\u5730\u5740", "VARCHAR2(256)")
    ]
  }
];
var VERSIONS = [
  { version: "v42", env: "SIT", time: "2026/09/05 18:20:11", tables: 194, fields: 3571, changed: [{ table: "SCB_BILL_REG_INFO", kind: "\u65B0\u589E\u5B57\u6BB5", field: "ACPT_DT", to: "VARCHAR2(8)" }] },
  { version: "v41", env: "UAT2", time: "2026/09/04 10:05:30", tables: 194, fields: 3570, changed: [{ table: "SCB_BILL_DISC_INFO", kind: "\u4FEE\u6539\u6CE8\u91CA", field: "DISC_RATE", to: "NUMBER(10,6)" }] },
  { version: "v39", env: "DEV", time: "2026/08/28 17:24:33", tables: 194, fields: 3569, changed: [{ table: "WIC_CORP_WLT_AC_BAL", kind: "\u65B0\u589E\u5B57\u6BB5", field: "BAL_DIRECTION", to: "VARCHAR2(2)" }] },
  { version: "v38", env: "DEV", time: "2026/08/28 16:14:15", tables: 194, fields: 3568, changed: [
    { table: "WLC_PERS_WLT_OPERATE_RECORD", kind: "\u65B0\u589E\u5B57\u6BB5", field: "FAIL_REASON", to: "VARCHAR2(500)" }
  ] },
  { version: "v37", env: "DEV", time: "2026/08/28 15:20:44", tables: 194, fields: 3567, changed: [
    { table: "WLC_PERS_WLT_OPERATE_RECORD", kind: "\u7C7B\u578B\u53D8\u66F4", field: "WIC_MOOS_TYPE", from: "VARCHAR2(20)", to: "VARCHAR2(30)" }
  ] },
  { version: "v36", env: "DEV", time: "2026/08/28 11:41:10", tables: 193, fields: 3546, changed: [
    { table: "WLC_CORP_WLT_OPERATE_RECORD", kind: "\u65B0\u589E\u5B57\u6BB5", field: "WLC_CORP_WLT_OPERATE_RECORD", to: "VARCHAR2(30)" }
  ] }
];
var dictSeq = 0;
var d = (cn, en, code, value, category, source = "\u4F01\u4E1A\u7EA7\u670D\u52A1", version = "V0180918022") => ({ id: ++dictSeq, cn, en, code, value, category, source, version });
var DICTIONARY = [
  d("\u94B1\u5305\u7EA7\u522B", "WIC_TTL", "W001", "\u4E00\u7C7B\u94B1\u5305", "\u94B1\u5305\u5C5E\u6027"),
  d("\u94B1\u5305\u7EA7\u522B", "WIC_TTL", "W002", "\u4E8C\u7C7B\u94B1\u5305", "\u94B1\u5305\u5C5E\u6027"),
  d("\u94B1\u5305\u7EA7\u522B", "WIC_TTL", "W003", "\u4E09\u7C7B\u94B1\u5305", "\u94B1\u5305\u5C5E\u6027"),
  d("\u8F6C\u8D26\u72B6\u6001", "SetRemittanceStatusCode", "SWS01", "\u6B63\u5E38", "\u72B6\u6001"),
  d("\u8F6C\u8D26\u72B6\u6001", "SetRemittanceStatusCode", "SWS02", "\u51BB\u7ED3", "\u72B6\u6001"),
  d("\u8F6C\u8D26\u72B6\u6001", "SetRemittanceStatusCode", "SWS03", "\u6CE8\u9500", "\u72B6\u6001"),
  d("\u4EA4\u6613\u6307\u4EE4\u7801", "DCSP_101", "101", "\u7EDF\u4E00\u4E0B\u5355", "\u4EA4\u6613\u7801"),
  d("\u4EA4\u6613\u6307\u4EE4\u7801", "DCSP_301", "301", "\u7EDF\u4E00\u6536\u5355\u652F\u4ED8", "\u4EA4\u6613\u7801"),
  d("\u4EA4\u6613\u6307\u4EE4\u7801", "DCSP_302", "302", "\u652F\u4ED8\u5904\u7406\u901A\u77E5", "\u4EA4\u6613\u7801"),
  d("\u4EA4\u6613\u6307\u4EE4\u7801", "DCSP_303", "303", "\u4EA4\u6613\u7ED3\u679C\u786E\u8BA4", "\u4EA4\u6613\u7801"),
  d("\u5BA2\u6237\u7C7B\u578B", "CUST_TYPE", "01", "\u4E2A\u4EBA\u5BA2\u6237", "\u72B6\u6001"),
  d("\u5BA2\u6237\u7C7B\u578B", "CUST_TYPE", "02", "\u4F01\u4E1A\u5BA2\u6237", "\u72B6\u6001"),
  d("\u94B1\u5305\u8D26\u6237\u72B6\u6001", "WIC_ACC_ST", "01", "\u6B63\u5E38", "\u72B6\u6001"),
  d("\u94B1\u5305\u8D26\u6237\u72B6\u6001", "WIC_ACC_ST", "02", "\u51BB\u7ED3", "\u72B6\u6001"),
  d("\u94B1\u5305\u8D26\u6237\u72B6\u6001", "WIC_ACC_ST", "03", "\u6CE8\u9500", "\u72B6\u6001"),
  d("\u5E01\u79CD", "WIC_CUR", "CNY", "\u4EBA\u6C11\u5E01", "\u57FA\u7840\u6570\u636E")
];
var KNOWLEDGE_DOCS = [
  {
    id: "b001",
    title: "\u5546\u4E1A\u6C47\u7968\u5230\u671F\u6258\u6536\uFF08\u63D0\u793A\u4ED8\u6B3E\uFF09\u6D41\u7A0B",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u6301\u7968\u4EBA\u5728\u7968\u636E\u5230\u671F\u540E\u5E94\u4E8E\u63D0\u793A\u4ED8\u6B3E\u671F\u5185\u901A\u8FC7\u7968\u636E\u7CFB\u7EDF\u53D1\u8D77\u63D0\u793A\u4ED8\u6B3E\uFF0C\u627F\u5151\u4EBA\u5E94\u5728 3 \u65E5\u5185\u5E94\u7B54\uFF1B\u88AB\u62D2\u4ED8\u540E\u53EF\u4F9D\u6CD5\u884C\u4F7F\u8FFD\u7D22\u6743\u3002",
    paragraphs: [
      "\u63D0\u793A\u4ED8\u6B3E\uFF1A\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u5230\u671F\u540E\uFF0C\u6301\u7968\u4EBA\u5E94\u5728\u7968\u636E\u5230\u671F\u65E5\u8D77 10 \u65E5\u5185\u901A\u8FC7\u7535\u7968\u7CFB\u7EDF\uFF08ECDS\uFF09\u5411\u627F\u5151\u4EBA/\u4ED8\u6B3E\u4EBA\u53D1\u8D77\u63D0\u793A\u4ED8\u6B3E\uFF1B\u903E\u671F\u63D0\u793A\u4ED8\u6B3E\u7684\uFF0C\u6309\u300A\u7968\u636E\u6CD5\u300B\u53CA\u76D1\u7BA1\u89C4\u5B9A\u5904\u7406\u3002",
      "\u5E94\u7B54\u65F6\u9650\uFF1A\u627F\u5151\u4EBA\uFF08\u94F6\u884C\u627F\u5151\u6C47\u7968\u4E3A\u627F\u5151\u94F6\u884C\uFF09\u5E94\u5728\u6536\u5230\u63D0\u793A\u4ED8\u6B3E\u8BF7\u6C42\u540E 3 \u65E5\u5185\u4F5C\u51FA\u5E94\u7B54\uFF1B\u540C\u610F\u4ED8\u6B3E\u7684\uFF0C\u8D44\u91D1\u5B9E\u65F6\u6E05\u7B97\u81F3\u6301\u7968\u4EBA\u8D26\u6237\u3002",
      "\u62D2\u4ED8\u4E0E\u8FFD\u7D22\uFF1A\u627F\u5151\u4EBA\u62D2\u7EDD\u4ED8\u6B3E\u6216\u65E0\u6B63\u5F53\u7406\u7531\u62D6\u5EF6\u7684\uFF0C\u6301\u7968\u4EBA\u53EF\u53D6\u5F97\u62D2\u4ED8\u8BC1\u660E\u540E\uFF0C\u5728\u6CD5\u5B9A\u671F\u9650\u5185\u5411\u51FA\u7968\u4EBA\u3001\u80CC\u4E66\u4EBA\u3001\u4FDD\u8BC1\u4EBA\u884C\u4F7F\u8FFD\u7D22\u6743\uFF08\u6309\u80CC\u4E66\u987A\u5E8F\u8FFD\u7D22\uFF09\u3002",
      "\u94F6\u884C\u627F\u5151\u6C47\u7968\u5230\u671F\u7531\u627F\u5151\u94F6\u884C\u65E0\u6761\u4EF6\u4ED8\u6B3E\uFF08\u51FA\u7968\u4EBA\u8D26\u6237\u4F59\u989D\u4E0D\u8DB3\u65F6\u94F6\u884C\u57AB\u6B3E\u5E76\u8F6C\u4E3A\u903E\u671F\u8D37\u6B3E\uFF09\uFF1B\u5546\u4E1A\u627F\u5151\u6C47\u7968\u4EE5\u627F\u5151\u4F01\u4E1A\u7684\u5546\u4E1A\u4FE1\u7528\u4E3A\u4ED8\u6B3E\u4FDD\u8BC1\u3002"
    ],
    tables: [
      {
        caption: "\u5230\u671F\u6258\u6536\u65F6\u9650\u5224\u5B9A\u8868",
        headers: ["\u573A\u666F", "\u65F6\u9650", "\u5904\u7406\u52A8\u4F5C"],
        rows: [
          ["\u5230\u671F\u65E5\u8D77\u63D0\u793A\u4ED8\u6B3E", "\u5230\u671F\u65E5\u8D77 10 \u65E5\u5185", "\u901A\u8FC7 ECDS \u53D1\u8D77\u63D0\u793A\u4ED8\u6B3E"],
          ["\u903E\u671F\u63D0\u793A\u4ED8\u6B3E", "\u8D85\u8FC7 10 \u65E5", "\u8BF4\u660E\u903E\u671F\u539F\u56E0\u540E\u4ECD\u53EF\u63D0\u793A\uFF0C\u903E\u671F\u98CE\u9669\u81EA\u62C5"],
          ["\u627F\u5151\u4EBA\u62D2\u4ED8", "\u53D6\u5F97\u62D2\u4ED8\u8BC1\u660E\u540E", "10 \u65E5\u5185\u884C\u4F7F\u8FFD\u7D22\u6743"],
          ["\u94F6\u884C\u627F\u5151\u6C47\u7968\u5230\u671F", "\u5230\u671F\u65E5", "\u627F\u5151\u94F6\u884C\u65E0\u6761\u4EF6\u4ED8\u6B3E"]
        ]
      }
    ]
  },
  {
    id: "b002",
    title: "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u8D34\u73B0\u4E1A\u52A1\u8981\u70B9",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u8D34\u73B0\u6307\u6301\u7968\u4EBA\u5C06\u672A\u5230\u671F\u7968\u636E\u80CC\u4E66\u8F6C\u8BA9\u7ED9\u94F6\u884C\u4EE5\u83B7\u53D6\u8D44\u91D1\uFF1B\u987B\u5177\u5907\u771F\u5B9E\u8D38\u6613\u80CC\u666F\u5E76\u63D0\u4EA4\u5408\u540C\u4E0E\u53D1\u7968\uFF0C\u5229\u7387\u4E0E\u671F\u9650\u7531\u53CC\u65B9\u5546\u5B9A\u3002",
    paragraphs: [
      "\u8D34\u73B0\u5B9A\u4E49\uFF1A\u8D34\u73B0\u662F\u6301\u7968\u4EBA\u5728\u7968\u636E\u5230\u671F\u524D\u4E3A\u83B7\u5F97\u8D44\u91D1\uFF0C\u5C06\u7968\u636E\u6743\u5229\u80CC\u4E66\u8F6C\u8BA9\u7ED9\u94F6\u884C\u6216\u8D34\u73B0\u673A\u6784\u7684\u878D\u8D44\u884C\u4E3A\uFF1B\u94F6\u884C\u6263\u9664\u8D34\u73B0\u5229\u606F\u540E\u5C06\u5269\u4F59\u6B3E\u9879\u652F\u4ED8\u7ED9\u6301\u7968\u4EBA\u3002",
      "\u51C6\u5165\u8981\u6C42\uFF1A\u7533\u8BF7\u8D34\u73B0\u987B\u5177\u6709\u771F\u5B9E\u8D38\u6613\u80CC\u666F\uFF0C\u5E76\u63D0\u4F9B\u4EA4\u6613\u5408\u540C\u3001\u589E\u503C\u7A0E\u53D1\u7968\u7B49\u8BC1\u660E\u6587\u4EF6\uFF1B\u4E0D\u5F97\u4E3A\u4E0D\u5177\u6709\u771F\u5B9E\u4EA4\u6613\u5173\u7CFB\u7684\u7968\u636E\u529E\u7406\u8D34\u73B0\u3002",
      "\u671F\u9650\u4E0E\u5229\u7387\uFF1A\u8D34\u73B0\u671F\u9650\u81EA\u8D34\u73B0\u65E5\u8D77\u81F3\u7968\u636E\u5230\u671F\u65E5\u6B62\uFF08\u6700\u957F\u4E0D\u8D85\u8FC7 6 \u4E2A\u6708\uFF09\uFF1B\u8D34\u73B0\u5229\u7387\u53C2\u7167\u5E02\u573A\u5229\u7387\u4E0E\u627F\u5151\u4EBA\u4FE1\u7528\u534F\u5546\u786E\u5B9A\u3002",
      "\u540E\u7EED\u6D41\u8F6C\uFF1A\u8D34\u73B0\u540E\u7684\u7968\u636E\u7531\u8D34\u73B0\u884C\u6301\u6709\uFF0C\u53EF\u7EE7\u7EED\u529E\u7406\u8F6C\u8D34\u73B0\u3001\u518D\u8D34\u73B0\uFF0C\u6216\u6301\u6709\u81F3\u5230\u671F\u6258\u6536\uFF0C\u5F62\u6210\u7968\u636E\u4E8C\u7EA7\u5E02\u573A\u3002"
    ],
    tables: [
      {
        caption: "\u4E0D\u5F97\u529E\u7406\u8D34\u73B0\u7684\u60C5\u5F62",
        headers: ["\u60C5\u5F62", "\u8BF4\u660E"],
        rows: [
          ["\u7968\u636E\u8981\u7D20\u4E0D\u5168", "\u7F3A\u5C11\u51FA\u7968\u4EBA\u7B7E\u7AE0\u3001\u91D1\u989D\u3001\u65E5\u671F\u7B49\u5FC5\u987B\u8BB0\u8F7D\u4E8B\u9879"],
          ["\u80CC\u4E66\u4E0D\u8FDE\u7EED", "\u80CC\u4E66\u94FE\u65AD\u88C2\u6216\u80CC\u4E66\u4EBA\u7B7E\u7AE0\u4E0E\u8BB0\u8F7D\u4E0D\u7B26"],
          ["\u8D38\u6613\u80CC\u666F\u4E0D\u771F\u5B9E", "\u65E0\u6CD5\u63D0\u4F9B\u771F\u5B9E\u4EA4\u6613\u5408\u540C\u6216\u53D1\u7968"],
          ["\u7968\u636E\u88AB\u51BB\u7ED3", "\u5DF2\u6302\u5931\u6B62\u4ED8\u3001\u516C\u793A\u50AC\u544A\u6216\u53F8\u6CD5\u51BB\u7ED3"],
          ["\u5230\u671F\u65E5\u8D85\u9650", "\u5269\u4F59\u671F\u9650\u8D85\u8FC7\u76D1\u7BA1\u89C4\u5B9A\u7684\u6700\u957F\u8D34\u73B0\u671F\u9650"]
        ]
      }
    ]
  },
  {
    id: "b003",
    title: "\u7968\u636E\u72B6\u6001\u4E0E\u751F\u547D\u5468\u671F\u5BF9\u7167\u8868",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u81EA\u51FA\u7968\u767B\u8BB0\u3001\u627F\u5151\u3001\u80CC\u4E66\u6D41\u8F6C\u5230\u5230\u671F\u7ED3\u6E05\u7684\u4E3B\u8981\u72B6\u6001\u4E0E\u53EF\u6267\u884C\u64CD\u4F5C\u8BF4\u660E\u3002",
    paragraphs: [
      "\u51FA\u7968\uFF1A\u51FA\u7968\u4EBA\u901A\u8FC7\u7968\u636E\u7CFB\u7EDF\u767B\u8BB0\u7968\u636E\u8981\u7D20\u5E76\u4EA4\u4ED8\u6536\u6B3E\u4EBA\uFF1B\u6536\u6B3E\u4EBA\u53EF\u7B7E\u6536\u3001\u80CC\u4E66\u8F6C\u8BA9\u6216\u9000\u7968\u3002",
      "\u627F\u5151\u4E0E\u80CC\u4E66\uFF1A\u94F6\u884C\u6216\u4F01\u4E1A\u627F\u5151\u540E\u7968\u636E\u4FE1\u7528\u589E\u5F3A\uFF1B\u6301\u7968\u4EBA\u53EF\u901A\u8FC7\u80CC\u4E66\u5C06\u7968\u636E\u6743\u5229\u8F6C\u8BA9\u7ED9\u4ED6\u4EBA\uFF0C\u80CC\u4E66\u5E94\u5F53\u8FDE\u7EED\u3002",
      "\u5230\u671F\u5904\u7406\uFF1A\u7968\u636E\u5230\u671F\u8FDB\u5165\u63D0\u793A\u4ED8\u6B3E\u3001\u7ED3\u6E05\u73AF\u8282\uFF1B\u7ED3\u6E05\u540E\u7968\u636E\u72B6\u6001\u4E3A\u300C\u5DF2\u7ED3\u6E05\u300D\uFF0C\u4E0D\u53EF\u518D\u8FDB\u5165\u6D41\u901A\u3002",
      "\u98CE\u9669\u72B6\u6001\uFF1A\u5904\u4E8E\u6302\u5931\u6B62\u4ED8\u3001\u516C\u793A\u50AC\u544A\u3001\u53F8\u6CD5\u51BB\u7ED3\u7B49\u72B6\u6001\u7684\u7968\u636E\uFF0C\u4E0D\u5F97\u529E\u7406\u8D34\u73B0\u3001\u8D28\u62BC\u6216\u8F6C\u8BA9\u3002"
    ],
    tables: [
      {
        caption: "\u7968\u636E\u72B6\u6001\u5BF9\u7167\u8868",
        headers: ["\u72B6\u6001", "\u542B\u4E49", "\u53EF\u6267\u884C\u64CD\u4F5C"],
        rows: [
          ["\u51FA\u7968\u5DF2\u767B\u8BB0", "\u51FA\u7968\u4EBA\u767B\u8BB0\u7968\u636E\u5F85\u4EA4\u4ED8", "\u4EA4\u4ED8\u6536\u6B3E\u4EBA / \u64A4\u56DE"],
          ["\u5DF2\u627F\u5151", "\u627F\u5151\u4EBA\u627F\u8BFA\u5230\u671F\u4ED8\u6B3E", "\u80CC\u4E66\u8F6C\u8BA9 / \u8D34\u73B0 / \u8D28\u62BC / \u6301\u6709\u5230\u671F"],
          ["\u80CC\u4E66\u8F6C\u8BA9\u4E2D", "\u6301\u7968\u4EBA\u8F6C\u8BA9\u7968\u636E\u6743\u5229", "\u7EE7\u7EED\u80CC\u4E66 / \u8FFD\u7D22"],
          ["\u8D28\u62BC\u8BBE\u7ACB", "\u7968\u636E\u7528\u4E8E\u503A\u52A1\u62C5\u4FDD", "\u89E3\u62BC / \u8D28\u6743\u4EBA\u5904\u7F6E"],
          ["\u5DF2\u8D34\u73B0", "\u94F6\u884C\u4E70\u5165\u5E76\u6301\u6709", "\u8F6C\u8D34\u73B0 / \u518D\u8D34\u73B0 / \u6258\u6536"],
          ["\u5DF2\u7ED3\u6E05", "\u7968\u6B3E\u5151\u4ED8\u5B8C\u6BD5", "\u5F52\u6863\uFF0C\u4E0D\u518D\u6D41\u901A"]
        ]
      }
    ]
  },
  {
    id: "b004",
    title: "\u4E0A\u6D77\u7968\u636E\u4EA4\u6613\u6240\uFF08\u7968\u4EA4\u6240\uFF09\u76F4\u8FDE\u63A5\u53E3\u62A5\u6587\u8981\u7D20",
    category: "\u62A5\u6587\u89C4\u8303",
    summary: "\u5546\u4E1A\u94F6\u884C\u4E0E\u7968\u636E\u673A\u6784\u901A\u8FC7\u4E13\u7EBF\u76F4\u8FDE\u4E0A\u6D77\u7968\u636E\u4EA4\u6613\u6240\u4EA4\u6613\u7CFB\u7EDF\uFF0C\u6309\u6807\u51C6\u62A5\u6587\u5B8C\u6210\u51FA\u7968\u3001\u8D34\u73B0\u3001\u4EA4\u6613\u4E0E\u6E05\u7B97\u7B49\u5168\u6D41\u7A0B\u6307\u4EE4\u3002",
    paragraphs: [
      "\u7CFB\u7EDF\u63A5\u5165\uFF1A\u5546\u4E1A\u94F6\u884C\u53CA\u7968\u636E\u673A\u6784\u901A\u8FC7\u4E13\u7EBF\u76F4\u8FDE\u4E0A\u6D77\u7968\u636E\u4EA4\u6613\u6240\uFF08SHCP\uFF09\u7968\u636E\u4EA4\u6613\u7CFB\u7EDF\uFF0C\u62A5\u6587\u91C7\u7528\u52A0\u89E3\u5BC6\u4E0E\u6570\u5B57\u7B7E\u540D\u4FDD\u969C\u5B89\u5168\u3002",
      "\u62A5\u6587\u8981\u7D20\uFF1A\u6BCF\u7B14\u62A5\u6587\u987B\u5305\u542B\u62A5\u6587\u6807\u8BC6\u3001\u53D1\u8D77\u673A\u6784\u3001\u4EA4\u6613\u7C7B\u578B\u3001\u7968\u636E\u53F7\u7801\u3001\u7968\u636E\u91D1\u989D\u3001\u5230\u671F\u65E5\u3001\u6536\u4ED8\u65B9\u8D26\u53F7\u7B49\u5173\u952E\u8981\u7D20\u3002",
      "\u4EA4\u6613\u7C7B\u578B\uFF1A\u8986\u76D6\u51FA\u7968\u767B\u8BB0\u3001\u627F\u5151\u3001\u80CC\u4E66\u8F6C\u8BA9\u3001\u8D34\u73B0\u7533\u8BF7\u3001\u8F6C\u8D34\u73B0\u3001\u56DE\u8D2D\u3001\u5230\u671F\u63D0\u793A\u4ED8\u6B3E\u4E0E\u8FFD\u7D22\u7B49\u7968\u636E\u5168\u751F\u547D\u5468\u671F\u6307\u4EE4\u3002"
    ],
    tables: [
      {
        caption: "\u62A5\u6587\u5B57\u6BB5\u8BF4\u660E",
        headers: ["\u5E8F\u53F7", "\u5C5E\u6027", "\u62A5\u6587\u540D", "\u7C7B\u578B", "\u8BF4\u660E"],
        rows: [
          ["1", "\u62A5\u6587\u6807\u8BC6", "\u62A5\u6587\u552F\u4E00\u7F16\u53F7", "String(32)", "\u5168\u5C40\u552F\u4E00"],
          ["2", "\u53D1\u8D77\u673A\u6784", "\u673A\u6784\u4EE3\u7801", "String(12)", "\u7968\u4EA4\u6240\u4F1A\u5458\u4EE3\u7801"],
          ["3", "\u7968\u636E\u8981\u7D20", "\u7968\u636E\u53F7\u7801", "String(30)", "ECDS \u552F\u4E00\u7968\u636E\u53F7"],
          ["4", "\u4EA4\u6613\u6307\u4EE4", "\u4EA4\u6613\u7C7B\u578B", "String(8)", "\u5982 101-\u51FA\u7968\u767B\u8BB0"],
          ["5", "\u91D1\u989D", "\u7968\u636E\u91D1\u989D", "String(20)", "\u5355\u4F4D\uFF1A\u5143\uFF0C\u4FDD\u7559\u4E24\u4F4D"],
          ["6", "\u671F\u9650", "\u5230\u671F\u65E5", "Date(YYYYMMDD)", "\u7528\u4E8E\u6258\u6536\u4E0E\u8D34\u73B0\u8BA1\u606F"]
        ]
      }
    ]
  },
  {
    id: "b005",
    title: "\u94F6\u884C\u627F\u5151\u6C47\u7968\u4E0E\u5546\u4E1A\u627F\u5151\u6C47\u7968\u7684\u5BF9\u6BD4",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u94F6\u884C\u627F\u5151\u6C47\u7968\u7531\u94F6\u884C\u627F\u5151\u5E76\u4F9D\u6258\u94F6\u884C\u4FE1\u7528\u5230\u671F\u4ED8\u6B3E\uFF0C\u6D41\u901A\u6027\u4E0E\u878D\u8D44\u6027\u6700\u5F3A\uFF1B\u5546\u4E1A\u627F\u5151\u6C47\u7968\u7531\u4F01\u4E1A\u627F\u5151\uFF0C\u4EE5\u4F01\u4E1A\u5546\u4E1A\u4FE1\u7528\u4E3A\u4ED8\u6B3E\u4FDD\u8BC1\u3002",
    paragraphs: [
      "\u94F6\u884C\u627F\u5151\u6C47\u7968\uFF08\u94F6\u7968\uFF09\u7531\u627F\u5151\u94F6\u884C\u627F\u5151\uFF0C\u5230\u671F\u7531\u94F6\u884C\u65E0\u6761\u4EF6\u4ED8\u6B3E\uFF0C\u51ED\u501F\u94F6\u884C\u4FE1\u7528\u5728\u7968\u636E\u5E02\u573A\u6D41\u901A\u6027\u6700\u597D\u3001\u8D34\u73B0\u6210\u672C\u6700\u4F4E\u3002",
      "\u5546\u4E1A\u627F\u5151\u6C47\u7968\uFF08\u5546\u7968\uFF09\u7531\u51FA\u7968\u4F01\u4E1A\u627F\u5151\uFF0C\u4ED8\u6B3E\u4F9D\u8D56\u627F\u5151\u4F01\u4E1A\u7684\u5546\u4E1A\u4FE1\u7528\uFF1B\u7531\u6838\u5FC3\u4F01\u4E1A\u7B7E\u53D1\u5E76\u7ECF\u4F9B\u5E94\u94FE\u786E\u8BA4\u7684\u5546\u7968\uFF0C\u53EF\u901A\u8FC7\u4F9B\u5E94\u94FE\u7968\u636E\u5E73\u53F0\u8D34\u73B0\u878D\u8D44\u3002",
      "\u94F6\u7968\u5230\u671F\u627F\u5151\u884C\u57AB\u6B3E\u540E\uFF0C\u5BF9\u51FA\u7968\u4EBA\u5F62\u6210\u903E\u671F\u8D37\u6B3E\u5E76\u8BA1\u6536\u7F5A\u606F\uFF1B\u5546\u7968\u5230\u671F\u5982\u627F\u5151\u4EBA\u8D44\u91D1\u4E0D\u8DB3\uFF0C\u6301\u7968\u4EBA\u9700\u4F9D\u7EA6\u884C\u4F7F\u8FFD\u7D22\u6743\u3002"
    ],
    tables: [
      {
        caption: "\u94F6\u7968\u4E0E\u5546\u7968\u5BF9\u6BD4\u8868",
        headers: ["\u5BF9\u6BD4\u9879", "\u94F6\u884C\u627F\u5151\u6C47\u7968", "\u5546\u4E1A\u627F\u5151\u6C47\u7968"],
        rows: [
          ["\u627F\u5151\u4E3B\u4F53", "\u627F\u5151\u94F6\u884C", "\u51FA\u7968\u4F01\u4E1A\uFF08\u627F\u5151\u4EBA\uFF09"],
          ["\u4ED8\u6B3E\u4FE1\u7528", "\u94F6\u884C\u4FE1\u7528", "\u4F01\u4E1A\u5546\u4E1A\u4FE1\u7528"],
          ["\u8D34\u73B0\u96BE\u5EA6", "\u4F4E\uFF0C\u94F6\u884C\u666E\u904D\u63A5\u53D7", "\u8F83\u9AD8\uFF0C\u53D6\u51B3\u4E8E\u627F\u5151\u4EBA\u8D44\u8D28"],
          ["\u5230\u671F\u5151\u4ED8", "\u627F\u5151\u884C\u65E0\u6761\u4EF6\u4ED8\u6B3E", "\u627F\u5151\u4EBA\u8D26\u6237\u8D44\u91D1\u5B89\u6392"],
          ["\u5E38\u89C1\u671F\u9650", "\u6700\u957F 1 \u5E74", "\u901A\u5E38 6 \u4E2A\u6708\u81F3 1 \u5E74"]
        ]
      }
    ]
  },
  {
    id: "b006",
    title: "\u7968\u636E\u8D28\u62BC\u4E1A\u52A1\uFF1A\u8BBE\u7ACB\u3001\u89E3\u62BC\u4E0E\u8D28\u6743\u4EBA\u5904\u7F6E",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u6301\u7968\u4EBA\u4EE5\u672A\u5230\u671F\u7968\u636E\u4E3A\u503A\u52A1\u62C5\u4FDD\u8BBE\u5B9A\u8D28\u62BC\uFF0C\u8D28\u6743\u4EBA\u53D6\u5F97\u8D28\u6743\uFF1B\u503A\u52A1\u6E05\u507F\u540E\u89E3\u9664\u8D28\u62BC\uFF0C\u903E\u671F\u672A\u6E05\u507F\u7684\u8D28\u6743\u4EBA\u53EF\u4F9D\u6CD5\u884C\u4F7F\u8D28\u6743\u3002",
    paragraphs: [
      "\u8BBE\u7ACB\uFF1A\u51FA\u8D28\u4EBA\u4E0E\u8D28\u6743\u4EBA\u7B7E\u8BA2\u8D28\u62BC\u5408\u540C\uFF0C\u5E76\u5728\u7968\u636E\u7CFB\u7EDF\u767B\u8BB0\u7968\u636E\u4E3A\u300C\u8D28\u62BC\u300D\u72B6\u6001\uFF1B\u7EB8\u8D28\u7968\u636E\u5E94\u80CC\u4E66\u300C\u8D28\u62BC\u300D\u5B57\u6837\u5E76\u4EA4\u4ED8\u3002",
      "\u6548\u529B\uFF1A\u8D28\u62BC\u8BBE\u7ACB\u540E\uFF0C\u672A\u7ECF\u8D28\u6743\u4EBA\u540C\u610F\uFF0C\u51FA\u8D28\u4EBA\u4E0D\u5F97\u8F6C\u8BA9\u6216\u518D\u8D28\u62BC\u8BE5\u7968\u636E\uFF1B\u7968\u636E\u5230\u671F\u65F6\u8D28\u6743\u4EBA\u53EF\u76F4\u63A5\u6258\u6536\u7968\u6B3E\u7528\u4E8E\u6E05\u507F\u503A\u52A1\u3002",
      "\u89E3\u62BC\u4E0E\u5904\u7F6E\uFF1A\u4E3B\u503A\u52A1\u6E05\u507F\u540E\u529E\u7406\u8D28\u62BC\u89E3\u9664\uFF1B\u51FA\u8D28\u4EBA\u903E\u671F\u4E0D\u6E05\u507F\u7684\uFF0C\u8D28\u6743\u4EBA\u53EF\u4F9D\u6CD5\u6258\u6536\u3001\u53D8\u5356\u6216\u901A\u8FC7\u53F8\u6CD5\u7A0B\u5E8F\u5B9E\u73B0\u8D28\u6743\u3002"
    ],
    tables: [
      {
        caption: "\u7968\u636E\u8D28\u62BC\u6D41\u7A0B\u8981\u70B9",
        headers: ["\u73AF\u8282", "\u64CD\u4F5C", "\u6CE8\u610F\u4E8B\u9879"],
        rows: [
          ["\u8BBE\u7ACB", "\u7B7E\u8D28\u62BC\u5408\u540C + \u7CFB\u7EDF\u767B\u8BB0\u8D28\u62BC", "\u987B\u4E3A\u5408\u6CD5\u6709\u6548\u672A\u5230\u671F\u7968\u636E"],
          ["\u5B58\u7EED\u671F", "\u8D28\u6743\u4EBA\u6301\u6709\u7968\u636E/\u8D28\u6743", "\u672A\u7ECF\u540C\u610F\u4E0D\u5F97\u8F6C\u8BA9\u3001\u518D\u8D28\u62BC"],
          ["\u5230\u671F\u6258\u6536", "\u8D28\u6743\u4EBA\u63D0\u793A\u4ED8\u6B3E", "\u7968\u6B3E\u4F18\u5148\u6E05\u507F\u88AB\u62C5\u4FDD\u503A\u52A1"],
          ["\u89E3\u62BC", "\u503A\u52A1\u6E05\u507F\u540E\u89E3\u9664\u767B\u8BB0", "\u53CA\u65F6\u89E3\u9664\u907F\u514D\u5F71\u54CD\u6D41\u8F6C"]
        ]
      }
    ]
  },
  {
    id: "b007",
    title: "\u7968\u636E\u8FFD\u7D22\u6743\uFF1A\u884C\u4F7F\u6761\u4EF6\u3001\u5BF9\u8C61\u4E0E\u65F6\u6548",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u6301\u7968\u4EBA\u5230\u671F\u88AB\u62D2\u4ED8\u6216\u627F\u5151\u88AB\u62D2\u7EDD\u540E\uFF0C\u53EF\u51ED\u62D2\u4ED8\u8BC1\u660E\u5411\u51FA\u7968\u4EBA\u3001\u80CC\u4E66\u4EBA\u3001\u4FDD\u8BC1\u4EBA\u884C\u4F7F\u8FFD\u7D22\u6743\uFF1B\u9996\u6B21\u8FFD\u7D22\u65F6\u6548 6 \u4E2A\u6708\u3001\u518D\u8FFD\u7D22 3 \u4E2A\u6708\u3002",
    paragraphs: [
      "\u884C\u4F7F\u6761\u4EF6\uFF1A\u7968\u636E\u5230\u671F\u88AB\u62D2\u7EDD\u4ED8\u6B3E\uFF0C\u6216\u6C47\u7968\u88AB\u62D2\u7EDD\u627F\u5151\uFF0C\u6216\u627F\u5151\u4EBA\u3001\u4ED8\u6B3E\u4EBA\u6B7B\u4EA1\u3001\u9003\u533F\u3001\u88AB\u4F9D\u6CD5\u5BA3\u544A\u7834\u4EA7\u6216\u56E0\u8FDD\u6CD5\u88AB\u8D23\u4EE4\u7EC8\u6B62\u4E1A\u52A1\u6D3B\u52A8\u3002",
      "\u8FFD\u7D22\u5BF9\u8C61\uFF1A\u51FA\u7968\u4EBA\u3001\u80CC\u4E66\u4EBA\u3001\u627F\u5151\u4EBA\u548C\u4FDD\u8BC1\u4EBA\u5BF9\u6301\u7968\u4EBA\u627F\u62C5\u8FDE\u5E26\u8D23\u4EFB\uFF1B\u6301\u7968\u4EBA\u53EF\u4E0D\u6309\u80CC\u4E66\u987A\u5E8F\u5BF9\u5176\u4E2D\u4EFB\u4F55\u4E00\u4EBA\u884C\u4F7F\u8FFD\u7D22\u6743\u3002",
      "\u65F6\u6548\uFF1A\u6301\u7968\u4EBA\u5BF9\u524D\u624B\u7684\u8FFD\u7D22\u6743\u81EA\u88AB\u62D2\u7EDD\u627F\u5151\u6216\u88AB\u62D2\u7EDD\u4ED8\u6B3E\u4E4B\u65E5\u8D77 6 \u4E2A\u6708\uFF1B\u518D\u8FFD\u7D22\u6743\u81EA\u6E05\u507F\u65E5\u6216\u88AB\u63D0\u8D77\u8BC9\u8BBC\u4E4B\u65E5\u8D77 3 \u4E2A\u6708\uFF0C\u903E\u671F\u6743\u5229\u6D88\u706D\u3002"
    ],
    tables: [
      {
        caption: "\u8FFD\u7D22\u6743\u65F6\u6548\u5BF9\u7167\u8868",
        headers: ["\u6743\u5229", "\u8D77\u7B97\u70B9", "\u65F6\u6548"],
        rows: [
          ["\u9996\u6B21\u8FFD\u7D22\u6743", "\u88AB\u62D2\u7EDD\u627F\u5151/\u4ED8\u6B3E\u4E4B\u65E5", "6 \u4E2A\u6708"],
          ["\u518D\u8FFD\u7D22\u6743", "\u6E05\u507F\u65E5\u6216\u88AB\u63D0\u8D77\u8BC9\u8BBC\u4E4B\u65E5", "3 \u4E2A\u6708"],
          ["\u7968\u636E\u4ED8\u6B3E\u8BF7\u6C42\u6743", "\u7968\u636E\u5230\u671F\u65E5", "2 \u5E74\uFF08\u5BF9\u51FA\u7968\u4EBA/\u627F\u5151\u4EBA\uFF09"]
        ]
      }
    ]
  },
  {
    id: "b008",
    title: "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\uFF08ECDS\uFF09\u4E1A\u52A1\u89C4\u5219\u6982\u89C8",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u4EE5\u6570\u636E\u7535\u6587\u5F62\u5F0F\u7B7E\u53D1\u4E0E\u6D41\u8F6C\uFF0C\u5168\u7A0B\u7535\u5B50\u5316\uFF1B\u65B0\u4E00\u4EE3\u7968\u636E\u7CFB\u7EDF\u652F\u6301\u6309\u91D1\u989D\u62C6\u5206\u6D41\u8F6C\uFF0C\u5355\u5F20\u6700\u957F 1 \u5E74\u3002",
    paragraphs: [
      "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u81EA 2009 \u5E74\u901A\u8FC7\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u7CFB\u7EDF\uFF08ECDS\uFF09\u8FD0\u884C\uFF0C\u51FA\u7968\u3001\u627F\u5151\u3001\u80CC\u4E66\u3001\u8D34\u73B0\u3001\u8D28\u62BC\u3001\u6258\u6536\u7B49\u73AF\u8282\u5168\u90E8\u7EBF\u4E0A\u529E\u7406\u3002",
      "\u65B0\u4E00\u4EE3\u7968\u636E\u4E1A\u52A1\u7CFB\u7EDF\uFF082022 \u5E74\u8D77\u63A8\u5E7F\uFF09\u652F\u6301\u7968\u636E\u7B49\u5206\u5316\u3001\u6309\u91D1\u989D\u62C6\u5206\u6D41\u8F6C\uFF0C\u63D0\u5347\u4E86\u4E2D\u5C0F\u4F01\u4E1A\u652F\u4ED8\u4E0E\u878D\u8D44\u7684\u7075\u6D3B\u6027\u3002",
      "\u7535\u7968\u4E0D\u5B58\u5728\u4F2A\u9020\u53D8\u9020\u7968\u9762\u98CE\u9669\uFF0C\u7968\u636E\u72B6\u6001\u4EE5\u7CFB\u7EDF\u767B\u8BB0\u4E3A\u51C6\uFF1B\u7EB8\u7968\u987B\u901A\u8FC7\u7968\u4EA4\u6240\u7CFB\u7EDF\u767B\u8BB0\u6258\u7BA1\u540E\u65B9\u53EF\u8FDB\u5165\u7535\u5B50\u5316\u4EA4\u6613\u3002"
    ],
    tables: [
      {
        caption: "\u7535\u5B50\u5546\u4E1A\u6C47\u7968\u8981\u70B9",
        headers: ["\u8981\u7D20", "\u8BF4\u660E"],
        rows: [
          ["\u8F7D\u4F53", "\u6570\u636E\u7535\u6587\uFF0C\u5168\u7A0B\u7535\u5B50\u5316"],
          ["\u6700\u957F\u671F\u9650", "1 \u5E74"],
          ["\u62C6\u5206\u6D41\u8F6C", "\u65B0\u4E00\u4EE3\u7968\u636E\u652F\u6301\u6309\u91D1\u989D\u62C6\u5206"],
          ["\u80CC\u4E66\u65B9\u5F0F", "\u7CFB\u7EDF\u5185\u7535\u5B50\u80CC\u4E66\uFF0C\u81EA\u52A8\u8FDE\u7EED"],
          ["\u771F\u4F2A\u6838\u9A8C", "\u4EE5\u7968\u636E\u7CFB\u7EDF\u767B\u8BB0\u72B6\u6001\u4E3A\u51C6"]
        ]
      }
    ]
  },
  {
    id: "b009",
    title: "\u7968\u636E\u8D34\u73B0\u5229\u606F\u4E0E\u5B9E\u4ED8\u91D1\u989D\u8BA1\u7B97",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u8D34\u73B0\u5229\u606F=\u7968\u9762\u91D1\u989D\xD7\u5E74\u5316\u8D34\u73B0\u5229\u7387\xF7360\xD7\u8D34\u73B0\u5929\u6570\uFF0C\u5B9E\u4ED8\u91D1\u989D=\u7968\u9762\u91D1\u989D-\u8D34\u73B0\u5229\u606F\uFF1B\u8D34\u73B0\u5929\u6570\u6309\u5B9E\u9645\u5929\u6570\uFF08\u7B97\u5934\u4E0D\u7B97\u5C3E\uFF09\u8BA1\u7B97\u3002",
    paragraphs: [
      "\u8D34\u73B0\u5929\u6570\uFF1A\u81EA\u8D34\u73B0\u94F6\u884C\u5B9E\u9645\u4ED8\u6B3E\u65E5\u8D77\u81F3\u7968\u636E\u5230\u671F\u65E5\u524D\u4E00\u65E5\u6B62\u7684\u5B9E\u9645\u5929\u6570\uFF0C\u901A\u5E38\u91C7\u7528\u300C\u7B97\u5934\u4E0D\u7B97\u5C3E\u300D\uFF1B\u5F02\u5730\u7968\u636E\u6309\u60EF\u4F8B\u52A0 3 \u5929\u90AE\u7A0B\u3002",
      "\u8BA1\u606F\u516C\u5F0F\uFF1A\u8D34\u73B0\u5229\u606F = \u7968\u9762\u91D1\u989D \xD7 \u5E74\u5316\u8D34\u73B0\u5229\u7387 \xF7 360 \xD7 \u8D34\u73B0\u5929\u6570\uFF1B\u5B9E\u4ED8\u8D34\u73B0\u91D1\u989D = \u7968\u9762\u91D1\u989D \u2212 \u8D34\u73B0\u5229\u606F\u3002",
      "\u793A\u4F8B\uFF1A\u7968\u9762\u91D1\u989D 100 \u4E07\u5143\u3001\u5269\u4F59\u671F\u9650 90 \u5929\u3001\u5E74\u5316\u8D34\u73B0\u5229\u7387 2.0%\uFF0C\u5219\u5229\u606F = 1000000 \xD7 2% \xF7 360 \xD7 90 = 5000 \u5143\uFF0C\u5B9E\u4ED8 99.5 \u4E07\u5143\u3002"
    ],
    tables: [
      {
        caption: "\u8D34\u73B0\u8BA1\u606F\u793A\u4F8B",
        headers: ["\u9879\u76EE", "\u6570\u503C"],
        rows: [
          ["\u7968\u9762\u91D1\u989D", "1,000,000 \u5143"],
          ["\u8D34\u73B0\u5929\u6570", "90 \u5929"],
          ["\u5E74\u5316\u5229\u7387", "2.0%"],
          ["\u8D34\u73B0\u5229\u606F", "5,000 \u5143"],
          ["\u5B9E\u4ED8\u91D1\u989D", "995,000 \u5143"]
        ]
      }
    ]
  },
  {
    id: "b010",
    title: "\u7968\u636E\u98CE\u9669\u9632\u8303\u4E0E\u53CD\u6B3A\u8BC8\u8981\u70B9",
    category: "\u4E1A\u52A1\u89C4\u5219",
    summary: "\u7968\u636E\u5E38\u89C1\u98CE\u9669\u5305\u62EC\u4F2A\u5047\u7968\u636E\u3001\u4E00\u7968\u591A\u5356\u3001\u91CD\u590D\u8D28\u62BC\u3001\u865A\u5047\u8D38\u6613\u80CC\u666F\u7B49\uFF1B\u5E94\u901A\u8FC7\u7968\u4EA4\u6240\u7CFB\u7EDF\u6838\u9A8C\u72B6\u6001\u3001\u6821\u9A8C\u8D38\u6613\u80CC\u666F\u5E76\u8B66\u60D5\u5F02\u5E38\u4EA4\u6613\u3002",
    paragraphs: [
      "\u5E38\u89C1\u98CE\u9669\uFF1A\u514B\u9686\u7968\u4E0E\u4F2A\u9020\u7968\u3001\u4E00\u7968\u591A\u5356\u3001\u540C\u4E00\u7968\u636E\u91CD\u590D\u8D28\u62BC\u3001\u80CC\u4E66\u4E0D\u8FDE\u7EED\u3001\u4EE5\u865A\u5047\u8D38\u6613\u80CC\u666F\u5957\u53D6\u8D34\u73B0\u8D44\u91D1\u3001\u627F\u5151\u4EBA\u6076\u610F\u62D2\u4ED8\u7B49\u3002",
      "\u9632\u63A7\u63AA\u65BD\uFF1A\u901A\u8FC7\u7968\u4EA4\u6240/ECDS \u67E5\u8BE2\u7968\u636E\u767B\u8BB0\u72B6\u6001\u4E0E\u6743\u5229\u5F52\u5C5E\uFF1B\u6838\u5BF9\u7968\u9762\u9632\u4F2A\u8981\u7D20\uFF1B\u8D34\u73B0\u524D\u6821\u9A8C\u8D38\u6613\u5408\u540C\u4E0E\u53D1\u7968\uFF1B\u5173\u6CE8\u6302\u5931\u6B62\u4ED8\u3001\u516C\u793A\u50AC\u544A\u4E0E\u53F8\u6CD5\u51BB\u7ED3\u4FE1\u606F\u3002",
      "\u53D1\u73B0\u5F02\u5E38\u5E94\u7ACB\u5373\u505C\u6B62\u4EA4\u6613\u5E76\u4FDD\u5168\u8BC1\u636E\uFF0C\u5411\u7968\u4EA4\u6240\u62A5\u544A\u6216\u901A\u8FC7\u53F8\u6CD5\u9014\u5F84\u4E3B\u5F20\u6743\u5229\uFF0C\u907F\u514D\u6269\u5927\u635F\u5931\u3002"
    ],
    tables: [
      {
        caption: "\u7968\u636E\u98CE\u9669\u4E0E\u9632\u63A7\u5BF9\u7167\u8868",
        headers: ["\u98CE\u9669", "\u5178\u578B\u8868\u73B0", "\u9632\u63A7\u8981\u70B9"],
        rows: [
          ["\u4F2A\u5047\u7968\u636E", "\u514B\u9686\u7968\u3001\u53D8\u9020\u7968", "\u6838\u9A8C\u9632\u4F2A\u8981\u7D20\u4E0E\u7CFB\u7EDF\u72B6\u6001"],
          ["\u4E00\u7968\u591A\u5356", "\u540C\u4E00\u7968\u636E\u91CD\u590D\u8F6C\u8BA9", "\u67E5\u8BE2\u6743\u5229\u5F52\u5C5E\u4E0E\u767B\u8BB0\u8BB0\u5F55"],
          ["\u91CD\u590D\u8D28\u62BC", "\u540C\u4E00\u7968\u636E\u8D28\u62BC\u591A\u6B21", "\u7CFB\u7EDF\u767B\u8BB0\u8D28\u62BC\u5E76\u9501\u5B9A\u7968\u636E"],
          ["\u865A\u5047\u8D38\u6613", "\u65E0\u771F\u5B9E\u5408\u540C\u5957\u73B0", "\u6838\u9A8C\u5408\u540C\u3001\u53D1\u7968\u4E0E\u7269\u6D41"],
          ["\u53F8\u6CD5\u51BB\u7ED3", "\u6302\u5931\u6B62\u4ED8/\u516C\u793A\u50AC\u544A", "\u53CA\u65F6\u67E5\u8BE2\u51BB\u7ED3\u540D\u5355"]
        ]
      }
    ]
  }
];
var AGENT_REPORTS = [
  {
    id: "rep-102",
    keyword: "WLC1779977345791",
    env: "DEV",
    instance: "scb-online",
    createdAt: "2026/08/28 17:50:00",
    costMs: 9200,
    logSize: "518.6 KB",
    hits: 5,
    exception: "\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A",
    errorType: "com.bbbd.dal.core.exception.TransactionException",
    suggestion: "\u62A5\u9519\u94FE\uFF1A\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u6821\u9A8C\u670D\u52A1\u8BF7\u6C42\u5165\u53C2\u7F51\u70B9\u7F16\u7801\u7F3A\u5931\u7B49\u539F\u56E0\u3002\u8BF7\u4E0A\u9001\u7F51\u70B9\u7F16\u7801\uFF08ccnMemberOrCustCd \u7B49\u5B57\u6BB5\uFF09",
    relatedErrors: [
      "TRANSACTION_EXCEPTION: WLC_TRANSACTION_EXCEPTION: \u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A(1)",
      "TRANSACTION_INVALID: com.bbbd.dal.core.exception.TransactionException: \u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A"
    ],
    codeSnippet: [
      "042  if (StringUtils.isBlank(acquirerId)) {",
      '043    throw new TransactionException("TRANSACTION_EXCEPTION", "\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A");',
      "044  }"
    ]
  },
  {
    id: "rep-101",
    keyword: "WLC1779977345791",
    env: "SIT",
    instance: "scb-online",
    createdAt: "2026/08/28 16:03:20",
    costMs: 7400,
    logSize: "46.0 MB",
    hits: 4,
    exception: "\u6570\u636E\u5E93\u8FDE\u63A5\u8D85\u65F6",
    errorType: "com.bbbd.dal.core.exception.DataAccessException",
    suggestion: "\u6570\u636E\u5E93\u8FDE\u63A5\u6C60\u6253\u6EE1\uFF0C\u5EFA\u8BAE\u68C0\u67E5\u8FDE\u63A5\u6C60\u914D\u7F6E\uFF08maxActive=50\uFF09\u4E0E\u6162 SQL \u8BED\u53E5\u3002",
    relatedErrors: ["CannotGetJdbcConnectionException: \u8D85\u8FC7\u6700\u5927\u8FDE\u63A5\u6570"],
    codeSnippet: []
  },
  {
    id: "rep-103",
    keyword: "WLC177996501387",
    env: "DEV",
    instance: "scb-batch",
    createdAt: "2026/08/28 11:20:41",
    costMs: 3100,
    logSize: "60.1 MB",
    hits: 3,
    exception: "\u6279\u6B21\u72B6\u6001\u672A\u66F4\u65B0",
    errorType: "com.bbbd.batch.core.exception.BatchException",
    suggestion: "\u6279\u6B21\u5904\u7406\u8FDB\u5EA6\u672A\u56DE\u5199\uFF0C\u8BF7\u68C0\u67E5\u6279\u6B21\u72B6\u6001\u673A\u4E0E\u5B9A\u65F6\u4EFB\u52A1\u3002",
    relatedErrors: ["BATCH_STATE_INVALID: \u6279\u6B21\u72B6\u6001\u4E0E\u9884\u671F\u4E0D\u7B26"],
    codeSnippet: []
  }
];

// src/dbprobe.ts
import { connect } from "node:net";
var DB_DEFAULT_PORTS = {
  oracle: 1521,
  mysql: 3306,
  postgresql: 5432,
  sqlserver: 1433,
  dm: 5236,
  kingbase: 54321,
  oceanbase: 2881
};
function resolveDbPort(profile) {
  const kind = profile.type ?? "";
  let port;
  if (profile.port === void 0 || profile.port === null || String(profile.port).trim() === "") {
    port = DB_DEFAULT_PORTS[kind] ?? DB_DEFAULT_PORTS.mysql;
  } else {
    port = Number(profile.port);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}
async function testTcpReachability(host, port, timeoutMs = 3e3) {
  const started = Date.now();
  return new Promise((resolve3) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (ok, code, detail) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve3({ ok, code, detail, ms: Date.now() - started });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, "OK", `TCP \u8FDE\u63A5\u6210\u529F\uFF08${host}:${port}\uFF09\uFF0C\u7AEF\u53E3\u53EF\u8FBE`));
    socket.once("timeout", () => finish(false, "ETIMEDOUT", `\u8FDE\u63A5\u8D85\u65F6\uFF08${timeoutMs}ms\uFF09\uFF0C\u76EE\u6807\u4E3B\u673A\u65E0\u54CD\u5E94\u6216\u9632\u706B\u5899\u62E6\u622A`));
    socket.once("error", (error) => {
      const code = error.code ?? "ERROR";
      const messages = {
        ECONNREFUSED: "\u76EE\u6807\u7AEF\u53E3\u62D2\u7EDD\u8FDE\u63A5\uFF08\u672A\u76D1\u542C\u6216\u672A\u5F00\u653E\uFF09",
        ENOTFOUND: "\u65E0\u6CD5\u89E3\u6790\u4E3B\u673A\u540D",
        EHOSTUNREACH: "\u4E3B\u673A\u4E0D\u53EF\u8FBE\uFF08\u7F51\u7EDC/\u8DEF\u7531\u95EE\u9898\uFF09",
        ENETUNREACH: "\u7F51\u7EDC\u4E0D\u53EF\u8FBE"
      };
      finish(false, code, messages[code] ?? `\u8FDE\u63A5\u5931\u8D25\uFF1A${error.message}`);
    });
  });
}

// src/oceanbase.ts
import mysql from "mysql2/promise";
var OceanBaseError = class extends Error {
  constructor(message, status = 400, uncertain = false, code = "", details) {
    super(message);
    this.status = status;
    this.uncertain = uncertain;
    this.code = code;
    this.details = details;
  }
};
var TENANT_MODE = "oracle";
var DEFAULT_PORT = 2883;
var TRANSPORT = "mysql-protocol";
var SYSTEM_SCHEMAS = ["SYS", "SYSTEM", "LBACSYS", "ORAAUDITOR", "OCEANBASE", "PUBLIC", "MDSYS", "CTXSYS", "XDB", "__RECYCLEBIN"];
var BINARY_TYPES = /^(BLOB|RAW|LONG RAW|BFILE)/i;
var LOB_TYPES = /^(CLOB|NCLOB|LONG)/i;
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OceanBaseError("\u8BF7\u6C42\u53C2\u6570\u5FC5\u987B\u662F\u5BF9\u8C61");
  return value;
}
function required(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 256 || value.includes("\0")) throw new OceanBaseError(`${label}\u4E0D\u80FD\u4E3A\u7A7A\u6216\u683C\u5F0F\u4E0D\u6B63\u786E`);
  return value.trim();
}
function identifier(value) {
  return '"' + value.replace(/"/g, '""') + '"';
}
function scalar(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" && Number.isFinite(value)) return value;
  throw new OceanBaseError("\u5B57\u6BB5\u503C\u53EA\u652F\u6301\u6587\u672C\u3001\u6570\u5B57\u548C NULL\uFF1B\u4E8C\u8FDB\u5236\u5B57\u6BB5\u8BF7\u4F7F\u7528\u5341\u516D\u8FDB\u5236\u6587\u672C");
}
function normalize(value) {
  const checked = scalar(value);
  if (typeof checked === "string" && checked === "") return null;
  return checked;
}
function pageNumber(value, fallback, max) {
  if (value === void 0) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new OceanBaseError("\u5206\u9875\u53C2\u6570\u65E0\u6548");
  return n;
}
function parseUser(input) {
  const [bare = "", rest = ""] = String(input).split("@");
  const [tenant = "", cluster = ""] = rest.split("#");
  return { user: bare.trim(), tenant: tenant.trim(), cluster: cluster.trim() };
}
var CONNECT_TIMEOUT_MS = 12e3;
var TCP_PRECHECK_MS = 5e3;
function resolveProfile(raw) {
  const profile = object(raw);
  if (profile.mode !== TENANT_MODE) throw new OceanBaseError("\u4EC5\u652F\u6301 OceanBase Oracle \u517C\u5BB9\u6A21\u5F0F\u79DF\u6237\uFF0C\u8BF7\u786E\u8BA4\u79DF\u6237\u6A21\u5F0F\u540E\u91CD\u8BD5");
  const port = profile.port === void 0 || profile.port === "" ? DEFAULT_PORT : Number(profile.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new OceanBaseError("\u7AEF\u53E3\u5FC5\u987B\u5728 1\u201365535 \u4E4B\u95F4");
  if (typeof profile.password !== "string") throw new OceanBaseError("\u8BF7\u586B\u5199\u6570\u636E\u5E93\u5BC6\u7801\uFF08\u5141\u8BB8\u7A7A\u5BC6\u7801\uFF09");
  const host = required(profile.host, "\u4E3B\u673A");
  const parsed = parseUser(required(profile.user, "\u6570\u636E\u5E93\u7528\u6237\u540D"));
  if (!parsed.user || /[@#\s]/.test(parsed.user)) throw new OceanBaseError("\u6570\u636E\u5E93\u7528\u6237\u540D\u8BF7\u53EA\u586B\u7528\u6237\u540D\u672C\u8EAB\uFF08\u79DF\u6237\u540D\u3001\u96C6\u7FA4\u540D\u5206\u5F00\u586B\uFF09");
  const tenantField = typeof profile.tenant === "string" ? profile.tenant.trim() : "";
  const clusterField = typeof profile.cluster === "string" ? profile.cluster.trim() : "";
  if (tenantField && parsed.tenant && tenantField !== parsed.tenant) throw new OceanBaseError("\u79DF\u6237\u540D\u4E0E\u7528\u6237\u540D\u91CC\u7684\u79DF\u6237\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u53EA\u586B\u4E00\u5904\u6216\u4FDD\u6301\u76F8\u540C");
  if (clusterField && parsed.cluster && clusterField !== parsed.cluster) throw new OceanBaseError("\u96C6\u7FA4\u540D\u4E0E\u7528\u6237\u540D\u91CC\u7684\u96C6\u7FA4\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u53EA\u586B\u4E00\u5904\u6216\u4FDD\u6301\u76F8\u540C");
  const tenant = tenantField || parsed.tenant;
  const cluster = clusterField || parsed.cluster;
  if (!tenant) throw new OceanBaseError("\u8BF7\u586B\u5199\u79DF\u6237\u540D\uFF1A\u8FDE\u63A5\u8D26\u53F7\u5FC5\u987B\u662F \u7528\u6237\u540D@\u79DF\u6237\u540D#\u96C6\u7FA4\u540D \u7684\u5F62\u5F0F");
  if (/[@#\s]/.test(tenant)) throw new OceanBaseError("\u79DF\u6237\u540D\u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u4E0D\u8981\u5E26 @ \u6216 #\uFF09");
  if (/[@#\s]/.test(cluster)) throw new OceanBaseError("\u96C6\u7FA4\u540D\u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u4E0D\u8981\u5E26 @ \u6216 #\uFF09");
  const database = typeof profile.database === "string" ? profile.database.trim() : typeof profile.schema === "string" ? profile.schema.trim() : "";
  if (database && /[`\s]/.test(database)) throw new OceanBaseError("\u9ED8\u8BA4\u6A21\u5F0F\u540D\u683C\u5F0F\u4E0D\u6B63\u786E\uFF08\u4E0D\u8981\u5E26\u7A7A\u683C\u6216\u53CD\u5F15\u53F7\uFF09");
  const user = `${parsed.user}@${tenant}${cluster ? `#${cluster}` : ""}`;
  return {
    fields: { host, port, database, user, tenant, cluster, tls: profile.tls === true },
    driver: {
      host,
      port,
      user,
      password: profile.password,
      ...database ? { database } : {},
      connectTimeout: CONNECT_TIMEOUT_MS,
      multipleStatements: false,
      namedPlaceholders: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      charset: "utf8mb4",
      // ODP 默认明文；只有服务端确实启用了 TLS 才勾选。
      ...profile.tls === true ? { ssl: { rejectUnauthorized: false } } : {}
    }
  };
}
function connectionOptions(raw) {
  return resolveProfile(raw).driver;
}
function displayType(row) {
  const type = String(row.data_type ?? "").toUpperCase();
  const charLength = row.char_length === null || row.char_length === void 0 ? null : Number(row.char_length);
  const length = row.data_length === null || row.data_length === void 0 ? null : Number(row.data_length);
  const precision = row.data_precision === null || row.data_precision === void 0 ? null : Number(row.data_precision);
  const scale = row.data_scale === null || row.data_scale === void 0 ? null : Number(row.data_scale);
  const charUsed = String(row.char_used ?? "").toUpperCase() === "C";
  if (/^VARCHAR2|^NVARCHAR2|^CHAR|^NCHAR/.test(type)) {
    const size = charLength ?? length;
    return size === null ? type : `${type}(${size}${charUsed ? " CHAR" : ""})`;
  }
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(type)) {
    if (precision === null) return type;
    return scale === null || scale === 0 ? `${type}(${precision})` : `${type}(${precision},${scale})`;
  }
  if (/^RAW/.test(type)) return length === null ? type : `${type}(${length})`;
  if (/^TIMESTAMP/.test(type)) {
    const scaleMatch = /\((\d+)\)/.exec(type);
    return scaleMatch ? `TIMESTAMP(${scaleMatch[1]})` : "TIMESTAMP(6)";
  }
  return type;
}
function isBinaryType(type) {
  return BINARY_TYPES.test(type);
}
function isLobType(type) {
  return LOB_TYPES.test(type);
}
function columnFrom(row) {
  const dataType = String(row.data_type ?? "").toUpperCase();
  const rawDefault = row.data_default;
  const defaultValue = rawDefault === null || rawDefault === void 0 ? null : String(rawDefault).trim();
  return {
    name: String(row.column_name),
    type: displayType(row),
    dataType,
    nullable: String(row.nullable ?? "").toUpperCase() === "Y",
    defaultValue: defaultValue === "" ? null : defaultValue,
    primary: String(row.is_pk ?? "").toUpperCase() === "Y",
    identity: String(row.identity_column ?? "").toUpperCase() === "YES",
    virtual: String(row.virtual_column ?? "").toUpperCase() === "YES",
    binary: isBinaryType(dataType),
    lob: isLobType(dataType),
    comment: String(row.comments ?? "")
  };
}
var BINARY_HEX_LIMIT = 4096;
async function serialRow(row) {
  const entries = await Promise.all(Object.entries(row).map(async ([key, value]) => [key, await serialValue(value)]));
  return Object.fromEntries(entries);
}
async function serialValue(value) {
  if (Buffer.isBuffer(value)) return bufferToHex(value);
  if (isLob(value)) {
    try {
      const data = await value.getData();
      if (typeof data === "string") return bufferToHex(Buffer.from(data, "utf8"));
      if (Buffer.isBuffer(data)) return bufferToHex(data);
      return bufferToHex(Buffer.from(String(data), "utf8"));
    } catch {
      return { binaryHex: "", truncated: true, length: Number(value.length ?? 0) };
    } finally {
      try {
        await value.close();
      } catch {
      }
    }
  }
  if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 19);
  return value;
}
function bufferToHex(buffer) {
  if (buffer.length <= BINARY_HEX_LIMIT) return { binaryHex: buffer.toString("hex") };
  return { binaryHex: buffer.subarray(0, BINARY_HEX_LIMIT).toString("hex"), truncated: true, length: buffer.length };
}
function isLob(value) {
  return typeof value === "object" && value !== null && typeof value.getData === "function" && typeof value.close === "function";
}
function columnOf(columns, name2) {
  const column = columns.find((item) => item.name === name2);
  if (!column) throw new OceanBaseError("\u5B57\u6BB5\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5237\u65B0\u8868\u7ED3\u6784");
  return column;
}
var COLUMN_SQL_TIERS = [
  // 档 1：完整（标识列/虚拟列/字符语义 + 注释 + 主键）
  `SELECT c.column_name, c.data_type, c.data_length, c.char_length, c.char_used, c.data_precision, c.data_scale,
          c.nullable, c.data_default, c.identity_column, c.virtual_column, cc.comments,
          CASE WHEN pk.column_name IS NULL THEN 'N' ELSE 'Y' END AS is_pk
     FROM all_tab_columns c
     LEFT JOIN all_col_comments cc
       ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     LEFT JOIN (SELECT ac.owner, ac.table_name, acc.column_name
                  FROM all_constraints ac
                  JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                 WHERE ac.constraint_type = 'P') pk
       ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`,
  // 档 2：去掉 12c 才有的标识列/虚拟列与字符语义
  `SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
          c.nullable, c.data_default, cc.comments,
          CASE WHEN pk.column_name IS NULL THEN 'N' ELSE 'Y' END AS is_pk
     FROM all_tab_columns c
     LEFT JOIN all_col_comments cc
       ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     LEFT JOIN (SELECT ac.owner, ac.table_name, acc.column_name
                  FROM all_constraints ac
                  JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
                 WHERE ac.constraint_type = 'P') pk
       ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`,
  // 档 3：最保守——只用最基础的列（连注释表、主键关联都不要）
  `SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
          c.nullable, c.data_default
     FROM all_tab_columns c
    WHERE c.owner = :p1 AND c.table_name = :p2
    ORDER BY c.column_id`
];
var columnSqlTier = 0;
function isDictionaryGap(error) {
  const text3 = `${String(error?.message ?? "")} ${String(error?.sqlMessage ?? "")}`;
  return /ORA-(?:00904|00942|01722|00932)/.test(text3);
}
var PRIMARY_KEY_SQL = `
SELECT acc.column_name
  FROM all_constraints ac
  JOIN all_cons_columns acc
    ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
 WHERE ac.owner = :p1 AND ac.table_name = :p2 AND ac.constraint_type = 'P'
 ORDER BY acc.position`;
async function queryRows(connection, sql, binds = {}) {
  const [rows2] = await connection.query(sql, binds);
  return rows2 ?? [];
}
function lowerKeys(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
}
async function queryDictionary(connection, sql, binds = {}) {
  return (await queryRows(connection, sql, binds)).map(lowerKeys);
}
async function schemasOf(connection) {
  const collect = (rows2) => rows2.map((row) => String(row.name ?? "")).filter((name2) => name2 !== "");
  try {
    const rows2 = await queryDictionary(connection, "SELECT username AS name FROM all_users ORDER BY username");
    if (rows2.length) return collect(rows2);
  } catch {
  }
  try {
    const owners = await queryDictionary(connection, "SELECT DISTINCT owner AS name FROM all_tables ORDER BY owner");
    if (owners.length) return collect(owners);
  } catch {
  }
  const current = await queryDictionary(connection, "SELECT USER AS name FROM DUAL");
  return collect(current);
}
async function tablesOf(connection, schema) {
  let rows2;
  try {
    rows2 = await queryDictionary(connection, `
      SELECT t.table_name AS name,
             CASE WHEN v.view_name IS NULL THEN 'TABLE' ELSE 'VIEW' END AS kind,
             c.comments AS comments
        FROM all_tables t
        LEFT JOIN all_views v ON v.owner = t.owner AND v.view_name = t.table_name
        LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
       WHERE t.owner = :p1
       ORDER BY t.table_name`, { p1: schema });
  } catch (error) {
    if (error instanceof OceanBaseError || !isDictionaryGap(error)) throw error;
    rows2 = await queryDictionary(connection, "SELECT table_name AS name FROM all_tables WHERE owner = :p1 ORDER BY table_name", { p1: schema });
  }
  return rows2.map((row) => ({
    name: String(row.name),
    type: String(row.kind ?? "TABLE").toUpperCase() === "VIEW" ? "VIEW" : "TABLE",
    comment: String(row.comments ?? "")
  }));
}
async function columnsFor(connection, schema, table) {
  let lastError;
  for (let tier = columnSqlTier; tier < COLUMN_SQL_TIERS.length; tier += 1) {
    try {
      const rows2 = await queryDictionary(connection, COLUMN_SQL_TIERS[tier], { p1: schema, p2: table });
      if (!rows2.length) throw new OceanBaseError("\u8868\u6216\u89C6\u56FE\u4E0D\u5B58\u5728\uFF0C\u6216\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u8BBF\u95EE\u6743\u9650", 404);
      columnSqlTier = tier;
      return rows2.map(columnFrom);
    } catch (error) {
      lastError = error;
      if (!(error instanceof OceanBaseError) && isDictionaryGap(error) && tier < COLUMN_SQL_TIERS.length - 1) continue;
      throw error;
    }
  }
  throw lastError;
}
var ROWID_FIELD = "wt_rowid";
function keySpecOf(columns, tableType) {
  const primary = columns.filter((column) => column.primary);
  if (primary.length && !primary.some((column) => column.binary)) return { mode: "primary", columns: primary.map((column) => column.name) };
  if (tableType === "TABLE") return { mode: "rowid", columns: [ROWID_FIELD] };
  return { mode: "none", columns: [] };
}
function keyCondition(spec, key) {
  if (spec.mode === "none") throw new OceanBaseError("\u8BE5\u5BF9\u8C61\u6CA1\u6709\u4E3B\u952E\u4E14\u4E0D\u662F\u53EF\u5B9A\u4F4D\u7684\u5806\u8868\uFF0C\u53EA\u80FD\u67E5\u8BE2", 403);
  const values = object(key);
  if (spec.mode === "rowid") {
    const rowid = values[ROWID_FIELD];
    if (typeof rowid !== "string" || rowid.trim() === "") throw new OceanBaseError("\u7F3A\u5C11 ROWID\uFF0C\u8BF7\u5237\u65B0\u6570\u636E\u540E\u91CD\u8BD5");
    return { sql: "ROWID = :k1", binds: { k1: rowid.trim() } };
  }
  if (Object.keys(values).length !== spec.columns.length) throw new OceanBaseError("\u5FC5\u987B\u63D0\u4F9B\u5B8C\u6574\u4E3B\u952E\uFF0C\u62D2\u7EDD\u65E0\u6761\u4EF6\u4FEE\u6539\u6216\u5220\u9664");
  const binds = {};
  const parts = spec.columns.map((name2, index) => {
    const value = values[name2];
    if (value === null || value === void 0) throw new OceanBaseError("\u5FC5\u987B\u63D0\u4F9B\u5B8C\u6574\u4E3B\u952E\uFF0C\u62D2\u7EDD\u65E0\u6761\u4EF6\u4FEE\u6539\u6216\u5220\u9664");
    binds[`k${index + 1}`] = scalar(value);
    return `${identifier(name2)} = :k${index + 1}`;
  });
  return { sql: parts.join(" AND "), binds };
}
function valueExpression(column, bind) {
  const type = column.dataType;
  if (/^DATE/.test(type)) {
    return `TO_DATE(${bind}, CASE WHEN INSTR(${bind}, ':') > 0 THEN 'YYYY-MM-DD HH24:MI:SS' ELSE 'YYYY-MM-DD' END)`;
  }
  if (/^TIMESTAMP/.test(type)) {
    const fmt = "CASE WHEN INSTR(" + bind + ", '.') > 0 THEN 'YYYY-MM-DD HH24:MI:SS.FF' WHEN INSTR(" + bind + ", ':') > 0 THEN 'YYYY-MM-DD HH24:MI:SS' ELSE 'YYYY-MM-DD' END";
    return `TO_TIMESTAMP(${bind}, ${fmt})`;
  }
  return bind;
}
function formatValue(column, label, text3) {
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(column.dataType) && !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text3)) {
    throw new OceanBaseError(`${label}\u9700\u8981\u6570\u5B57\uFF0C\u8BF7\u68C0\u67E5\u8F93\u5165\uFF08\u5F53\u524D\u4E3A\u300C${text3.slice(0, 32)}\u300D\uFF09`);
  }
  if (/^DATE/.test(column.dataType) && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(text3)) {
    throw new OceanBaseError(`${label}\u9700\u8981\u65E5\u671F\uFF0C\u683C\u5F0F\u4E3A YYYY-MM-DD \u6216 YYYY-MM-DD HH24:MI:SS`);
  }
  if (/^TIMESTAMP/.test(column.dataType) && !/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(text3)) {
    throw new OceanBaseError(`${label}\u9700\u8981\u65F6\u95F4\uFF0C\u683C\u5F0F\u4E3A YYYY-MM-DD HH24:MI:SS[.FF]`);
  }
  if (!column.lob && text3.length > 4e3 && /^(VARCHAR2|NVARCHAR2|CHAR|NCHAR|RAW)/.test(column.dataType)) {
    throw new OceanBaseError(`${label}\u5185\u5BB9\u8D85\u8FC7 4000 \u5B57\u7B26\uFF0C${column.dataType} \u65E0\u6CD5\u5BB9\u7EB3\uFF0C\u8BF7\u6539\u7528 CLOB`);
  }
  return text3;
}
function prepareValue(column, label, value) {
  const normalized = normalize(value);
  if (normalized === null) {
    if (!column.nullable) throw new OceanBaseError(`${label}\u4E0D\u80FD\u4E3A NULL\uFF08Oracle \u6A21\u5F0F\u4E0B\u7A7A\u5B57\u7B26\u4E32\u540C\u6837\u89C6\u4E3A NULL\uFF09`);
    return null;
  }
  return formatValue(column, label, String(normalized));
}
function editableColumn(columns, name2) {
  const column = columnOf(columns, name2);
  if (column.virtual) throw new OceanBaseError(`\u5B57\u6BB5 ${column.name} \u662F\u865A\u62DF\u5217\uFF0C\u4E0D\u80FD\u5199\u5165`);
  if (column.identity) throw new OceanBaseError(`\u5B57\u6BB5 ${column.name} \u662F\u6807\u8BC6\u5217\uFF0C\u8BF7\u4F7F\u7528\u300C\u9ED8\u8BA4\u503C / \u81EA\u52A8\u751F\u6210\u300D`);
  if (column.binary) throw new OceanBaseError(`\u5B57\u6BB5 ${column.name} \u662F\u4E8C\u8FDB\u5236\u5217\uFF0C\u4E0D\u652F\u6301\u6587\u672C\u7F16\u8F91`);
  return column;
}
function whereFilter(columns, raw) {
  if (raw === void 0 || raw === null) return { sql: "", binds: {} };
  const filter = object(raw);
  const column = columnOf(columns, filter.column);
  if (column.binary) throw new OceanBaseError("\u6682\u4E0D\u652F\u6301\u4E8C\u8FDB\u5236\u5B57\u6BB5\u7B5B\u9009");
  const name2 = identifier(column.name);
  if (filter.op === "null") return { sql: ` WHERE ${name2} IS NULL`, binds: {} };
  if (filter.op === "notnull") return { sql: ` WHERE ${name2} IS NOT NULL`, binds: {} };
  if (filter.op === "contains") return { sql: ` WHERE INSTR(TO_CHAR(${name2}), :p1) > 0`, binds: { p1: String(normalize(filter.value) ?? "") } };
  const ops = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
  const op = Object.hasOwn(ops, String(filter.op)) ? ops[String(filter.op)] : void 0;
  if (!op) throw new OceanBaseError("\u7B5B\u9009\u64CD\u4F5C\u4E0D\u652F\u6301");
  const normalized = normalize(filter.value);
  const value = normalized === null || column.lob || /^RAW|^LONG RAW|^BFILE/.test(column.dataType) ? normalized : formatValue(column, `\u5B57\u6BB5 ${column.name} \u7684\u7B5B\u9009\u503C`, String(normalized));
  return { sql: ` WHERE ${name2} ${op} ${valueExpression(column, ":p1")}`, binds: { p1: value } };
}
function orderClause(columns, sort, direction, tiebreak) {
  const items = [];
  if (sort !== void 0 && sort !== null && sort !== "") {
    const column = columnOf(columns, sort);
    const dir = direction === "desc" ? "DESC" : "ASC";
    items.push(`${identifier(column.name)} ${dir} NULLS ${dir === "DESC" ? "FIRST" : "LAST"}`);
  }
  for (const name2 of tiebreak) {
    if (items.some((item) => item.startsWith(identifier(name2)))) continue;
    items.push(`${identifier(name2)} ASC`);
  }
  return items.length ? ` ORDER BY ${items.join(", ")}` : "";
}
function buildRowQuery(target, columns, options) {
  const filter = whereFilter(columns, options.filter);
  const order = orderClause(columns, options.sort, options.direction, options.key.mode === "primary" ? options.key.columns : []);
  const needsRowid = options.key.mode === "rowid";
  const selectList = needsRowid ? `t.*, t.ROWID AS ${identifier(ROWID_FIELD)}` : "t.*";
  const inner = `SELECT ${selectList} FROM ${qualified(target)} t${filter.sql}${order}`;
  return {
    sql: `SELECT * FROM (SELECT wt_inner.*, ROWNUM AS ${identifier("wt_rn")} FROM (${inner}) wt_inner WHERE ROWNUM <= :p_max) WHERE ${identifier("wt_rn")} > :p_off`,
    binds: { ...filter.binds, p_max: options.offset + options.limit + 1, p_off: options.offset }
  };
}
function qualified(target) {
  return `${identifier(target.schema)}.${identifier(target.table)}`;
}
function defaultInsertSQL(target, columns) {
  const insertable = columns.filter((column) => !column.virtual);
  if (!insertable.length) throw new OceanBaseError("\u8BE5\u5BF9\u8C61\u6CA1\u6709\u53EF\u5199\u5165\u7684\u5217");
  return `INSERT INTO ${qualified(target)} (${insertable.map((column) => identifier(column.name)).join(", ")}) VALUES (${insertable.map(() => "DEFAULT").join(", ")})`;
}
function buildInsert(target, columns, rawValues) {
  const values = object(rawValues);
  const names = Object.keys(values);
  if (!names.length) return { sql: defaultInsertSQL(target, columns), binds: {} };
  const binds = {};
  const targets = [];
  const placeholders = [];
  names.forEach((name2, index) => {
    const column = editableColumn(columns, name2);
    const bind = `:p${index + 1}`;
    binds[`p${index + 1}`] = prepareValue(column, `\u5B57\u6BB5 ${column.name}`, values[name2]);
    targets.push(identifier(column.name));
    placeholders.push(valueExpression(column, bind));
  });
  return { sql: `INSERT INTO ${qualified(target)} (${targets.join(", ")}) VALUES (${placeholders.join(", ")})`, binds };
}
function buildUpdate(target, columns, spec, body) {
  const values = object(body.values);
  const names = Object.keys(values);
  if (!names.length) throw new OceanBaseError("\u6CA1\u6709\u9700\u8981\u4FEE\u6539\u7684\u5B57\u6BB5");
  const binds = {};
  const assignments = names.map((name2, index) => {
    const column = editableColumn(columns, name2);
    if (column.primary) throw new OceanBaseError(`\u5B57\u6BB5 ${column.name} \u662F\u4E3B\u952E\uFF0C\u4E0D\u652F\u6301\u4FEE\u6539`);
    if (!Object.hasOwn(object(body.original), name2)) throw new OceanBaseError("\u7F3A\u5C11\u5B57\u6BB5\u539F\u503C\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5");
    const bind = `:p${index + 1}`;
    binds[`p${index + 1}`] = prepareValue(column, `\u5B57\u6BB5 ${column.name}`, values[name2]);
    return `${identifier(column.name)} = ${valueExpression(column, bind)}`;
  });
  const key = keyCondition(spec, body.key);
  return { sql: `UPDATE ${qualified(target)} SET ${assignments.join(", ")} WHERE ${key.sql}`, binds: { ...binds, ...key.binds } };
}
function buildDelete(target, spec, body) {
  if (body.confirm !== true) throw new OceanBaseError("\u8BF7\u786E\u8BA4\u5220\u9664\u8BB0\u5F55");
  const key = keyCondition(spec, body.key);
  return { sql: `DELETE FROM ${qualified(target)} WHERE ${key.sql}`, binds: key.binds };
}
async function assertRowUnchanged(connection, target, spec, columns, body) {
  const key = keyCondition(spec, body.key);
  const rows2 = await queryRows(connection, `SELECT * FROM ${qualified(target)} WHERE ${key.sql} FOR UPDATE`, key.binds);
  if (rows2.length !== 1) throw new OceanBaseError("\u8BB0\u5F55\u5DF2\u88AB\u4FEE\u6539\u6216\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u6570\u636E\u540E\u91CD\u8BD5", 409);
  const actual = await serialRow(rows2[0]);
  const original = object(body.original);
  for (const column of columns) {
    if (column.virtual) continue;
    if (!Object.hasOwn(original, column.name)) throw new OceanBaseError("\u539F\u59CB\u8BB0\u5F55\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5237\u65B0\u6570\u636E\u540E\u91CD\u8BD5");
    if (JSON.stringify(actual[column.name] ?? null) !== JSON.stringify(original[column.name] ?? null)) {
      throw new OceanBaseError("\u8BB0\u5F55\u5DF2\u88AB\u4FEE\u6539\u6216\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u6570\u636E\u540E\u91CD\u8BD5", 409);
    }
  }
}
async function versionInfo(connection) {
  const identity = await queryDictionary(connection, `SELECT USER AS current_user, SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name FROM DUAL`);
  const info = { currentUser: identity[0]?.current_user ?? "", dbName: identity[0]?.db_name ?? "" };
  try {
    const banner = await queryDictionary(connection, "SELECT banner FROM v$version WHERE ROWNUM = 1");
    info.version = banner[0]?.banner ?? "";
  } catch {
    try {
      const ob = await queryDictionary(connection, "SELECT version() AS version");
      info.version = String(ob[0]?.version ?? "");
    } catch {
      info.version = "";
    }
  }
  return info;
}
async function perform(connection, action, body) {
  if (action === "connect") {
    return { info: await versionInfo(connection), schemas: await schemasOf(connection) };
  }
  if (action === "verify") {
    const checks = [];
    const push = async (name2, task) => {
      try {
        checks.push({ name: name2, ok: true, detail: String(await task()).slice(0, 200) });
      } catch (error) {
        const failure = error;
        checks.push({ name: name2, ok: false, detail: `${String(failure.code ?? "")} ${String(failure.sqlMessage ?? failure.message ?? error)}`.slice(0, 200) });
      }
    };
    let schemas = [];
    await push("\u5F53\u524D\u8D26\u53F7 (SELECT USER FROM DUAL)", async () => (await queryDictionary(connection, "SELECT USER AS name FROM DUAL"))[0]?.name ?? "");
    await push("\u6A21\u5F0F\u5217\u8868 (ALL_USERS)", async () => {
      schemas = await schemasOf(connection);
      return `${schemas.length} \u4E2A\uFF1A${schemas.slice(0, 6).join(", ")}`;
    });
    await push("\u7248\u672C\u4FE1\u606F (v$version)", async () => (await queryDictionary(connection, "SELECT banner FROM v$version WHERE ROWNUM = 1"))[0]?.banner ?? "");
    const probeSchema = typeof body.schema === "string" && body.schema.trim() ? body.schema.trim() : schemas[0] ?? "";
    let firstTable = "";
    await push(`\u8868/\u89C6\u56FE\u5217\u8868 (ALL_TABLES, \u6A21\u5F0F ${probeSchema || "\u672A\u53D6\u5230"})`, async () => {
      const entries = await tablesOf(connection, probeSchema);
      firstTable = entries[0]?.name ?? "";
      return `\u5171 ${entries.length} \u4E2A\u5BF9\u8C61${firstTable ? `\uFF0C\u9996\u4E2A\uFF1A${firstTable}` : ""}`;
    });
    if (firstTable) {
      for (let tier = 0; tier < COLUMN_SQL_TIERS.length; tier += 1) {
        await push(`\u5B57\u6BB5\u7ED3\u6784\xB7\u6863 ${tier + 1} (${firstTable})`, async () => {
          const rows2 = await queryDictionary(connection, COLUMN_SQL_TIERS[tier], { p1: probeSchema, p2: firstTable });
          return `${rows2.length} \u5217`;
        });
      }
      await push(`\u4E3B\u952E\u7EA6\u675F (ALL_CONSTRAINTS, ${firstTable})`, async () => {
        const rows2 = await queryDictionary(connection, PRIMARY_KEY_SQL, { p1: probeSchema, p2: firstTable });
        return rows2.length ? `\u4E3B\u952E\u5217\uFF1A${rows2.map((row) => String(row.column_name)).join(", ")}` : "\u65E0\u4E3B\u952E";
      });
      await push(`\u884C\u67E5\u8BE2 (ROWNUM \u5206\u9875, ${firstTable})`, async () => {
        const columns2 = await columnsFor(connection, probeSchema, firstTable);
        const spec2 = keySpecOf(columns2, "TABLE");
        const query = buildRowQuery({ schema: probeSchema, table: firstTable }, columns2, { limit: 2, offset: 0, key: spec2 });
        const rows2 = await queryRows(connection, query.sql, query.binds);
        return `\u8FD4\u56DE ${rows2.length} \u884C\uFF0C\u4F7F\u7528\u6863\u4F4D ${columnSqlTier + 1}`;
      });
    }
    return { checks, columnTier: columnSqlTier + 1, schema: probeSchema };
  }
  const schema = required(body.schema, "\u6A21\u5F0F\uFF08Schema\uFF09");
  if (action === "tables") {
    return { tables: await tablesOf(connection, schema) };
  }
  const table = required(body.table, "\u8868\u540D");
  const columns = await columnsFor(connection, schema, table);
  const tables = await tablesOf(connection, schema);
  const entry = tables.find((item) => item.name === table);
  const tableType = entry?.type ?? "TABLE";
  const writable = tableType === "TABLE" && !SYSTEM_SCHEMAS.includes(schema.toUpperCase());
  const spec = keySpecOf(columns, tableType);
  const permissions = { insert: writable, edit: writable && spec.mode !== "none" };
  if (action === "rows") {
    const limit = pageNumber(body.limit, 50, 200);
    if (!limit) throw new OceanBaseError("\u6BCF\u9875\u884C\u6570\u81F3\u5C11\u4E3A 1");
    const offset = pageNumber(body.offset, 0, 1e7);
    const query = buildRowQuery({ schema, table }, columns, { filter: body.filter, sort: body.sort, direction: body.direction, limit, offset, key: spec });
    const rows2 = await queryRows(connection, query.sql, query.binds);
    const hasMore = rows2.length > limit;
    const page = [];
    for (const row of rows2.slice(0, limit)) {
      const serialized = await serialRow(row);
      delete serialized.wt_rn;
      page.push(serialized);
    }
    return { columns, rows: page, offset, limit, hasMore, permissions, key: { mode: spec.mode, columns: spec.columns, label: spec.mode === "rowid" ? "ROWID" : spec.mode === "primary" ? "\u4E3B\u952E" : "\u65E0" }, tableType };
  }
  if (!writable) throw new OceanBaseError("\u4EC5\u5141\u8BB8\u4FEE\u6539\u666E\u901A\u8868\uFF1B\u89C6\u56FE\u548C\u7CFB\u7EDF\u6A21\u5F0F\u53EA\u8BFB", 403);
  const statement = action === "insert" ? buildInsert({ schema, table }, columns, body.values) : action === "update" ? buildUpdate({ schema, table }, columns, spec, body) : action === "delete" ? buildDelete({ schema, table }, spec, body) : (() => {
    throw new OceanBaseError("\u4E0D\u652F\u6301\u7684\u64CD\u4F5C");
  })();
  await connection.rollback();
  try {
    if (action !== "insert") await assertRowUnchanged(connection, { schema, table }, spec, columns, body);
    const [result] = await connection.query(statement.sql, statement.binds);
    const affected = result.affectedRows ?? 0;
    if (affected !== 1) throw new OceanBaseError("\u8BB0\u5F55\u5DF2\u88AB\u4FEE\u6539\u6216\u5220\u9664\uFF0C\u8BF7\u5237\u65B0\u6570\u636E\u540E\u91CD\u8BD5", 409);
    await connection.commit();
    return { affectedRows: affected };
  } catch (error) {
    await connection.rollback().catch(() => {
    });
    throw error;
  }
}
function connectionFailure(error, tls = false) {
  const code = String(error?.code ?? "");
  const detail = `${String(error?.message ?? "")} ${String(error?.sqlMessage ?? "")}`;
  if (tls && /tls|ssl|handshake|certificate|secure/i.test(detail)) {
    return new OceanBaseError("TLS/SSL \u63E1\u624B\u5931\u8D25\uFF1A\u8BE5\u7AEF\u53E3\u5F88\u53EF\u80FD\u6CA1\u6709\u542F\u7528 TLS\u3002ODP \u9ED8\u8BA4\u660E\u6587\uFF0C\u8BF7\u53D6\u6D88\u52FE\u9009\u300C\u4F7F\u7528 TLS\u300D\u540E\u91CD\u8BD5", 400, false, code || "TLS");
  }
  const messages = {
    ETIMEDOUT: `\u8FDE\u63A5\u6570\u636E\u5E93\u8D85\u65F6\uFF08\u5DF2\u7B49\u5F85 ${Math.round(CONNECT_TIMEOUT_MS / 1e3)} \u79D2\uFF09\uFF1A\u8BF7\u68C0\u67E5\u4E3B\u673A\u3001\u7AEF\u53E3\u4E0E\u7F51\u7EDC\u7B56\u7565\u662F\u5426\u653E\u901A`,
    ENOTFOUND: "\u65E0\u6CD5\u89E3\u6790\u6570\u636E\u5E93\u4E3B\u673A\u540D\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u5730\u5740",
    EAI_AGAIN: "\u57DF\u540D\u89E3\u6790\u6682\u65F6\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 DNS \u6216\u8FDE\u63A5\u5730\u5740",
    ECONNREFUSED: "\u76EE\u6807\u7AEF\u53E3\u62D2\u7EDD\u8FDE\u63A5\uFF1A\u8BF7\u68C0\u67E5\u7AEF\u53E3\u662F\u5426\u6B63\u786E\uFF08ODP 2883 / \u76F4\u8FDE observer 2881\uFF09",
    EHOSTUNREACH: "\u4E3B\u673A\u4E0D\u53EF\u8FBE\uFF1A\u8BF7\u68C0\u67E5\u7F51\u7EDC\u4E0E\u8DEF\u7531",
    ENETUNREACH: "\u7F51\u7EDC\u4E0D\u53EF\u8FBE\uFF1A\u8BF7\u68C0\u67E5\u7F51\u7EDC\u4E0E\u8DEF\u7531",
    "ER_ACCESS_DENIED_ERROR": "\u8BA4\u8BC1\u5931\u8D25\uFF1A\u8D26\u53F7\u3001\u79DF\u6237\u6216\u5BC6\u7801\u4E0D\u6B63\u786E\uFF08\u8D26\u53F7\u9700\u5199\u6210 \u7528\u6237\u540D@\u79DF\u6237\u540D#\u96C6\u7FA4\u540D\uFF09",
    "ER_DBACCESS_DENIED_ERROR": "\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u8BBF\u95EE\u8BE5\u6A21\u5F0F\u7684\u6743\u9650",
    PROTOCOL_CONNECTION_LOST: "\u8FDE\u63A5\u88AB\u6570\u636E\u5E93\u5173\u95ED",
    ECONNRESET: "\u8FDE\u63A5\u88AB\u91CD\u7F6E",
    EPIPE: "\u8FDE\u63A5\u5DF2\u65AD\u5F00"
  };
  return new OceanBaseError(messages[code] ?? "\u65E0\u6CD5\u8FDE\u63A5\u6570\u636E\u5E93\uFF0C\u8BF7\u68C0\u67E5\u5730\u5740\u3001\u7AEF\u53E3\u3001\u79DF\u6237\u540D\u4E0E\u8D26\u53F7\u5BC6\u7801", 400, false, code);
}
async function executeOceanBase(action, body, probe = testTcpReachability) {
  const { driver, fields } = resolveProfile(body.connection);
  const reachable = await probe(fields.host, fields.port, TCP_PRECHECK_MS);
  if (!reachable.ok) {
    throw new OceanBaseError(
      `\u7F51\u7EDC\u5C42\u4E0D\u901A\uFF1A${reachable.detail}\u3002\u8BF7\u786E\u8BA4\u300C\u8FD0\u884C\u672C\u670D\u52A1\u7684\u90A3\u53F0\u673A\u5668\u300D\uFF08\u4E0D\u662F\u6D4F\u89C8\u5668\u6240\u5728\u673A\u5668\uFF09\u80FD\u8BBF\u95EE ${fields.host}:${fields.port}\u2014\u2014\u5185\u7F51\u7B56\u7565 / VPN / \u9632\u706B\u5899\u662F\u5426\u5BF9\u8BE5\u8FDB\u7A0B\u653E\u901A\u3002`,
      400,
      false,
      reachable.code
    );
  }
  let connection;
  let timer;
  let connectTimer;
  try {
    let timedOut = false;
    const pending = mysql.createConnection(driver).catch((error) => {
      throw connectionFailure(error, fields.tls);
    });
    connection = await Promise.race([
      pending,
      new Promise((_resolve, reject) => {
        connectTimer = setTimeout(() => {
          timedOut = true;
          reject(new OceanBaseError(
            `\u8FDE\u63A5\u6570\u636E\u5E93\u8D85\u65F6\uFF08\u5DF2\u7B49\u5F85 ${Math.round(CONNECT_TIMEOUT_MS / 1e3)} \u79D2\uFF09\uFF1ATCP \u5DF2\u80FD\u8FDE\u4E0A ${fields.host}:${fields.port}\uFF0C\u4F46\u6CA1\u6709\u5B8C\u6210 MySQL \u534F\u8BAE\u63E1\u624B\u3002\u8BF7\u786E\u8BA4\u7AEF\u53E3\uFF08ODP 2883 / \u76F4\u8FDE observer 2881\uFF09\u3001\u8D26\u53F7 ${fields.user} \u4E0E\u7F51\u7EDC\u7B56\u7565\uFF1B\u53EF\u7528 node tools/ob-probe.mjs --variants \u4E00\u6B21\u6027\u6838\u5BF9\u8FDE\u63A5\u5199\u6CD5\u3002`,
            504,
            false,
            "CONNECT_TIMEOUT"
          ));
        }, CONNECT_TIMEOUT_MS);
      })
    ]);
    void pending.then((late) => {
      if (timedOut) void closeConnection(late);
    }).catch(() => {
    });
    const active = connection;
    const result = await Promise.race([
      perform(active, action, body),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          void closeConnection(active);
          reject(new OceanBaseError("\u6570\u636E\u5E93\u64CD\u4F5C\u8D85\u65F6\uFF0C\u8BF7\u5237\u65B0\u6838\u5B9E\u7ED3\u679C\u540E\u518D\u64CD\u4F5C", 504, ["insert", "update", "delete"].includes(action)));
        }, 15e3);
      })
    ]);
    return action === "connect" ? { ...result, mode: TENANT_MODE, tenant: fields.tenant, cluster: fields.cluster, transport: TRANSPORT, database: fields.database } : result;
  } finally {
    if (timer) clearTimeout(timer);
    if (connectTimer) clearTimeout(connectTimer);
    if (connection) await closeConnection(connection);
  }
}
async function closeConnection(connection) {
  let closeTimer;
  try {
    await Promise.race([
      connection.end(),
      new Promise((resolve3) => {
        closeTimer = setTimeout(() => resolve3(), 1e3);
      })
    ]);
  } catch {
    try {
      connection.destroy();
    } catch {
    }
  } finally {
    if (closeTimer) clearTimeout(closeTimer);
  }
}

// src/connections.ts
import { mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
function storeFile() {
  return join2(configDir(), "connections.json");
}
function listProfiles() {
  try {
    const raw = JSON.parse(readFileSync2(storeFile(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => Boolean(item) && typeof item === "object" && typeof item.id === "string");
  } catch {
    return [];
  }
}
function writeProfiles(profiles) {
  mkdirSync2(configDir(), { recursive: true });
  writeFileSync2(storeFile(), JSON.stringify(profiles, null, 2), "utf8");
}
function text(value, label, max = 64) {
  if (value === void 0 || value === null) return "";
  if (typeof value !== "string") throw new OceanBaseError(`${label}\u5FC5\u987B\u662F\u6587\u672C`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new OceanBaseError(`${label}\u8FC7\u957F\uFF08\u6700\u591A ${max} \u5B57\uFF09`);
  if (trimmed.includes("\0")) throw new OceanBaseError(`${label}\u5305\u542B\u975E\u6CD5\u5B57\u7B26`);
  return trimmed;
}
function profileId(host, port, user, tenant, cluster) {
  return `${host}:${port}/${user}@${tenant}${cluster ? "#" + cluster : ""}`.toLowerCase();
}
function saveProfile(raw) {
  const input = object(raw);
  const name2 = text(input.name, "\u6863\u6848\u540D\u79F0", 80);
  const env = text(input.env, "\u73AF\u5883\u522B\u540D", 40);
  const { fields } = resolveProfile({ ...input, mode: "oracle", password: typeof input.password === "string" ? input.password : "" });
  const bareUser = fields.user.includes("@") ? fields.user.split("@")[0] : fields.user;
  const id = profileId(fields.host, fields.port, bareUser, fields.tenant, fields.cluster);
  const profile = {
    id,
    name: name2 || `${fields.tenant || fields.host}`,
    env,
    host: fields.host,
    port: fields.port,
    cluster: fields.cluster,
    tenant: fields.tenant,
    user: bareUser,
    database: fields.database,
    tls: fields.tls,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const profiles = listProfiles().filter((item) => item.id !== id);
  profiles.unshift(profile);
  writeProfiles(profiles);
  return profile;
}
function removeProfile(raw) {
  const id = text(object(raw).id, "\u6863\u6848 id", 256);
  if (!id) throw new OceanBaseError("\u7F3A\u5C11\u6863\u6848 id");
  const before = listProfiles();
  const profiles = before.filter((item) => item.id !== id);
  writeProfiles(profiles);
  return { removed: profiles.length !== before.length, id };
}
function handleProfileAction(raw) {
  const body = object(raw);
  const op = text(body.op, "\u64CD\u4F5C", 20) || "list";
  if (op === "list") return { profiles: listProfiles() };
  if (op === "save") return { profile: saveProfile(body.profile) };
  if (op === "remove") return removeProfile(body.profile);
  throw new OceanBaseError("\u8FDE\u63A5\u6863\u6848\u53EA\u652F\u6301 list / save / remove");
}

// src/ddl-compare.ts
import { existsSync, readFileSync as readFileSync3, statSync } from "node:fs";
import { join as join3 } from "node:path";
import { fileURLToPath } from "node:url";
import mysql2 from "mysql2/promise";
function configCandidates() {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const fromEnv = process.env.DDL_ENV_CONFIG;
  return [
    ...fromEnv ? [fromEnv] : [],
    // $DSH_HOME 下的配置优先：装进 DSH 宿主（/wangtie-os/）时项目目录在 node_modules 里，
    // 把可编辑的配置放在 $DSH_HOME/wangtie-os/ 下更顺手。
    join3(configDir(), "ddl-environments.json"),
    join3(projectRoot, "config", "ddl-environments.local.json"),
    join3(projectRoot, "config", "ddl-environments.json")
  ];
}
function resolveConfigPath() {
  for (const candidate of configCandidates()) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
    }
  }
  return null;
}
function text2(value, fallback = "") {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : fallback;
}
function loadEnvironments() {
  const path = resolveConfigPath();
  if (!path) throw new OceanBaseError(`\u6CA1\u6709\u627E\u5230 DDL \u6BD4\u8F83\u7684\u914D\u7F6E\u6587\u4EF6\u3002\u8BF7\u521B\u5EFA config/ddl-environments.json\uFF08\u53EF\u53C2\u8003\u5305\u5185\u6A21\u677F\uFF09\uFF0C\u6216\u7528\u73AF\u5883\u53D8\u91CF DDL_ENV_CONFIG \u6307\u5B9A\u8DEF\u5F84\u3002`, 400);
  let raw;
  try {
    raw = JSON.parse(readFileSync3(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new OceanBaseError(`\u914D\u7F6E\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF08${path}\uFF09\uFF1A${error.message}`, 400);
  }
  const list = Array.isArray(raw?.environments) ? raw.environments : [];
  const environments = list.map((item, index) => {
    const env = object(item);
    const user = text2(env.user);
    const key = text2(env.key) || `ENV${index + 1}`;
    return {
      key,
      name: text2(env.name) || key,
      host: text2(env.host),
      port: env.port === void 0 || env.port === "" ? 2883 : Number(env.port),
      cluster: text2(env.cluster),
      tenant: text2(env.tenant),
      user,
      password: typeof env.password === "string" ? env.password : "",
      schema: (text2(env.schema) || user.split("@")[0] || "").toUpperCase(),
      enabled: env.enabled !== false
    };
  });
  if (environments.length < 2) throw new OceanBaseError(`\u914D\u7F6E\u6587\u4EF6\u91CC\u81F3\u5C11\u8981\u6709\u4E24\u4E2A\u73AF\u5883\u624D\u80FD\u6BD4\u8F83\uFF08\u5F53\u524D ${environments.length} \u4E2A\uFF09\uFF1A${path}`, 400);
  return { path, environments };
}
function environmentsForDisplay() {
  const { path, environments } = loadEnvironments();
  let updatedAt = "";
  try {
    updatedAt = path ? statSync(path).mtime.toISOString() : "";
  } catch {
  }
  return {
    path,
    updatedAt,
    environments: environments.map((env) => ({
      key: env.key,
      name: env.name,
      host: env.host,
      port: env.port,
      cluster: env.cluster,
      tenant: env.tenant,
      user: env.user,
      schema: env.schema,
      enabled: env.enabled,
      hasPassword: env.password !== ""
    }))
  };
}
async function rows(connection, sql, binds) {
  const [result] = await connection.query(sql, binds);
  const list = Array.isArray(result) ? result : [];
  return list.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])));
}
function typeOf(row) {
  const type = String(row.data_type ?? "").toUpperCase();
  const charLength = row.char_length === null || row.char_length === void 0 ? null : Number(row.char_length);
  const length = row.data_length === null || row.data_length === void 0 ? null : Number(row.data_length);
  const precision = row.data_precision === null || row.data_precision === void 0 ? null : Number(row.data_precision);
  const scale = row.data_scale === null || row.data_scale === void 0 ? null : Number(row.data_scale);
  if (/^VARCHAR2|^NVARCHAR2|^CHAR|^NCHAR/.test(type)) {
    const size = charLength ?? length;
    return size === null ? type : `${type}(${size})`;
  }
  if (/^NUMBER|^FLOAT|^DECIMAL|^NUMERIC/.test(type)) {
    if (precision === null) return type;
    return scale === null || scale === 0 ? `${type}(${precision})` : `${type}(${precision},${scale})`;
  }
  if (/^RAW/.test(type)) return length === null ? type : `${type}(${length})`;
  if (/^TIMESTAMP/.test(type)) {
    const match = /\((\d+)\)/.exec(type);
    return match ? `TIMESTAMP(${match[1]})` : "TIMESTAMP(6)";
  }
  return type;
}
async function readSnapshot(environment, connection) {
  const schema = environment.schema;
  const warnings = [];
  const withBinds = { p1: schema };
  const objectRows = await rows(connection, `
    SELECT t.table_name AS name,
           CASE WHEN v.view_name IS NULL THEN 'TABLE' ELSE 'VIEW' END AS kind,
           c.comments AS comments
      FROM all_tables t
      LEFT JOIN all_views v ON v.owner = t.owner AND v.view_name = t.table_name
      LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
     WHERE t.owner = :p1
     ORDER BY t.table_name`, withBinds);
  const columnRows = await rows(connection, `
    SELECT c.table_name, c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
           c.nullable, c.data_default, cc.comments
      FROM all_tab_columns c
      LEFT JOIN all_col_comments cc
        ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     WHERE c.owner = :p1
     ORDER BY c.table_name, c.column_id`, withBinds);
  const keyRows = await rows(connection, `
    SELECT ac.table_name, ac.constraint_name, ac.constraint_type, acc.column_name
      FROM all_constraints ac
      JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
     WHERE ac.owner = :p1 AND ac.constraint_type = 'P'
     ORDER BY ac.table_name, acc.position`, withBinds);
  let indexRows = [];
  try {
    indexRows = await rows(connection, `
      SELECT i.table_name, i.index_name, i.uniqueness, ic.column_name
        FROM all_indexes i
        JOIN all_ind_columns ic ON ic.index_owner = i.owner AND ic.index_name = i.index_name
       WHERE i.owner = :p1
       ORDER BY i.table_name, i.index_name, ic.column_position`, withBinds);
  } catch (error) {
    warnings.push(`\u7D22\u5F15\u4FE1\u606F\u8BFB\u53D6\u5931\u8D25\uFF08\u5DF2\u8DF3\u8FC7\u7D22\u5F15\u6BD4\u8F83\uFF09\uFF1A${String(error.message).slice(0, 120)}`);
  }
  let viewRows = [];
  try {
    viewRows = await rows(connection, "SELECT view_name, text FROM all_views WHERE owner = :p1", withBinds);
  } catch {
    warnings.push("\u89C6\u56FE\u5B9A\u4E49\u8BFB\u53D6\u5931\u8D25\uFF08\u5DF2\u8DF3\u8FC7\u89C6\u56FE SQL \u6BD4\u8F83\uFF09");
  }
  const pkNames = new Set(keyRows.map((row) => String(row.constraint_name)));
  const objects = /* @__PURE__ */ new Map();
  for (const row of objectRows) {
    const name2 = String(row.name);
    objects.set(name2, { name: name2, type: String(row.kind) === "VIEW" ? "VIEW" : "TABLE", comment: String(row.comments ?? ""), columns: [], primaryKey: [], indexes: [], viewText: "" });
  }
  for (const row of columnRows) {
    const target = objects.get(String(row.table_name));
    if (!target) continue;
    target.columns.push({
      name: String(row.column_name),
      type: typeOf(row),
      nullable: String(row.nullable ?? "").toUpperCase() === "Y",
      defaultValue: row.data_default === null || row.data_default === void 0 ? null : String(row.data_default).trim() || null,
      comment: String(row.comments ?? "")
    });
  }
  for (const row of keyRows) {
    const target = objects.get(String(row.table_name));
    if (target && !target.primaryKey.includes(String(row.column_name))) target.primaryKey.push(String(row.column_name));
  }
  for (const row of indexRows) {
    const target = objects.get(String(row.table_name));
    if (!target) continue;
    const indexName = String(row.index_name);
    if (pkNames.has(indexName)) continue;
    let index = target.indexes.find((item) => item.name === indexName);
    if (!index) {
      index = { name: indexName, unique: String(row.uniqueness) === "UNIQUE", columns: [] };
      target.indexes.push(index);
    }
    index.columns.push(String(row.column_name));
  }
  for (const row of viewRows) {
    const target = objects.get(String(row.view_name));
    if (target) target.viewText = String(row.text ?? "").replace(/\s+/g, " ").trim();
  }
  return { environment: `${environment.key}\uFF08${environment.name}\uFF09`, schema, objects: [...objects.values()], warnings };
}
async function snapshotOf(environment) {
  const driver = connectionOptions({
    mode: "oracle",
    host: environment.host,
    port: environment.port,
    cluster: environment.cluster,
    tenant: environment.tenant,
    user: environment.user,
    password: environment.password
  });
  const connection = await mysql2.createConnection(driver);
  try {
    return await readSnapshot(environment, connection);
  } finally {
    await connection.end().catch(() => connection.destroy());
  }
}
function buildDDL(schema, item) {
  const quote = (value) => `"${value.replace(/"/g, '""')}"`;
  if (item.type === "VIEW") {
    return [`-- \u89C6\u56FE ${schema}.${item.name}`, `CREATE OR REPLACE VIEW ${quote(schema)}.${quote(item.name)} AS`, `${item.viewText || "\uFF08\u53D6\u4E0D\u5230\u89C6\u56FE\u5B9A\u4E49\uFF09"};`].join("\n");
  }
  const lines = [`CREATE TABLE ${quote(schema)}.${quote(item.name)} (`];
  const parts = item.columns.map((column) => {
    const bits = [`  ${quote(column.name)} ${column.type}`];
    if (column.defaultValue !== null) bits.push(`DEFAULT ${column.defaultValue}`);
    if (!column.nullable) bits.push("NOT NULL");
    return bits.join(" ");
  });
  if (item.primaryKey.length) parts.push(`  CONSTRAINT ${quote(`PK_${item.name}`)} PRIMARY KEY (${item.primaryKey.map(quote).join(", ")})`);
  lines.push(parts.join(",\n"), ");");
  if (item.comment) lines.push(`COMMENT ON TABLE ${quote(schema)}.${quote(item.name)} IS '${item.comment.replace(/'/g, "''")}';`);
  for (const column of item.columns) {
    if (column.comment) lines.push(`COMMENT ON COLUMN ${quote(schema)}.${quote(item.name)}.${quote(column.name)} IS '${column.comment.replace(/'/g, "''")}';`);
  }
  for (const index of item.indexes) {
    lines.push(`CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quote(index.name)} ON ${quote(schema)}.${quote(item.name)} (${index.columns.map(quote).join(", ")});`);
  }
  return lines.join("\n");
}
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function compareSnapshots(left, right, options = {}) {
  const leftMap = new Map(left.objects.map((item) => [item.name, item]));
  const rightMap = new Map(right.objects.map((item) => [item.name, item]));
  const names = [.../* @__PURE__ */ new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
  const diffs = [];
  for (const name2 of names) {
    const before = leftMap.get(name2);
    const after = rightMap.get(name2);
    if (before && !after) {
      diffs.push({ name: name2, type: before.type, kind: "only-left", identical: false, lines: [`\u53EA\u5728\u5DE6\u4FA7\uFF08${left.environment}\uFF09\u5B58\u5728\uFF0C\u53F3\u4FA7\u6CA1\u6709\u8FD9\u4E2A\u5BF9\u8C61`], ddlLeft: buildDDL(left.schema, before), ddlRight: "" });
      continue;
    }
    if (!before && after) {
      diffs.push({ name: name2, type: after.type, kind: "only-right", identical: false, lines: [`\u53EA\u5728\u53F3\u4FA7\uFF08${right.environment}\uFF09\u5B58\u5728\uFF0C\u5DE6\u4FA7\u6CA1\u6709\u8FD9\u4E2A\u5BF9\u8C61`], ddlLeft: "", ddlRight: buildDDL(right.schema, after) });
      continue;
    }
    if (!before || !after) continue;
    const lines = [];
    if (before.type !== after.type) lines.push(`~ \u5BF9\u8C61\u7C7B\u578B ${before.type} \u2192 ${after.type}`);
    if (before.type === "VIEW" && after.type === "VIEW" && before.viewText !== after.viewText) {
      lines.push("~ \u89C6\u56FE\u5B9A\u4E49\u4E0D\u540C\uFF08\u89C1\u4E0B\u65B9 DDL \u5BF9\u7167\uFF09");
    }
    if (before.comment !== after.comment) lines.push(`~ \u8868\u6CE8\u91CA ${before.comment || "\uFF08\u7A7A\uFF09"} \u2192 ${after.comment || "\uFF08\u7A7A\uFF09"}`);
    const leftColumns = new Map(before.columns.map((column) => [column.name, column]));
    const rightColumns = new Map(after.columns.map((column) => [column.name, column]));
    for (const column of after.columns) {
      if (!leftColumns.has(column.name)) lines.push(`+ \u5B57\u6BB5 ${column.name} ${column.type}${column.nullable ? "" : " NOT NULL"}\uFF08\u53F3\u4FA7\u65B0\u589E\uFF09`);
    }
    for (const column of before.columns) {
      if (!rightColumns.has(column.name)) lines.push(`- \u5B57\u6BB5 ${column.name} ${column.type}\uFF08\u53F3\u4FA7\u7F3A\u5931\uFF09`);
    }
    for (const column of before.columns) {
      const counterpart = rightColumns.get(column.name);
      if (!counterpart) continue;
      if (column.type !== counterpart.type) lines.push(`~ \u5B57\u6BB5 ${column.name} \u7C7B\u578B ${column.type} \u2192 ${counterpart.type}`);
      if (column.nullable !== counterpart.nullable) lines.push(`~ \u5B57\u6BB5 ${column.name} \u53EF\u7A7A ${column.nullable ? "\u662F" : "\u5426"} \u2192 ${counterpart.nullable ? "\u662F" : "\u5426"}`);
      if ((column.defaultValue ?? "") !== (counterpart.defaultValue ?? "")) lines.push(`~ \u5B57\u6BB5 ${column.name} \u9ED8\u8BA4\u503C ${column.defaultValue ?? "\uFF08\u65E0\uFF09"} \u2192 ${counterpart.defaultValue ?? "\uFF08\u65E0\uFF09"}`);
      if (column.comment !== counterpart.comment) lines.push(`~ \u5B57\u6BB5 ${column.name} \u6CE8\u91CA ${column.comment || "\uFF08\u7A7A\uFF09"} \u2192 ${counterpart.comment || "\uFF08\u7A7A\uFF09"}`);
    }
    if (!sameJson(before.primaryKey, after.primaryKey)) {
      lines.push(`~ \u4E3B\u952E (${before.primaryKey.join(", ") || "\u65E0"}) \u2192 (${after.primaryKey.join(", ") || "\u65E0"})`);
    }
    const leftIndexes = new Map(before.indexes.map((index) => [index.name, index]));
    const rightIndexes = new Map(after.indexes.map((index) => [index.name, index]));
    for (const index of after.indexes) {
      if (!leftIndexes.has(index.name)) lines.push(`+ \u7D22\u5F15 ${index.name}${index.unique ? " UNIQUE" : ""} (${index.columns.join(", ")})\uFF08\u53F3\u4FA7\u65B0\u589E\uFF09`);
    }
    for (const index of before.indexes) {
      const counterpart = rightIndexes.get(index.name);
      if (!counterpart) {
        lines.push(`- \u7D22\u5F15 ${index.name}\uFF08\u53F3\u4FA7\u7F3A\u5931\uFF09`);
        continue;
      }
      if (!sameJson(index, counterpart)) lines.push(`~ \u7D22\u5F15 ${index.name} (${index.columns.join(", ")})${index.unique ? " UNIQUE" : ""} \u2192 (${counterpart.columns.join(", ")})${counterpart.unique ? " UNIQUE" : ""}`);
    }
    const identical2 = lines.length === 0;
    if (identical2 && !options.includeIdentical) continue;
    diffs.push({
      name: name2,
      type: after.type,
      kind: identical2 ? "changed" : "changed",
      identical: identical2,
      lines: identical2 ? ["\u4E24\u4FA7\u7ED3\u6784\u5B8C\u5168\u4E00\u81F4"] : lines,
      ddlLeft: buildDDL(left.schema, before),
      ddlRight: buildDDL(right.schema, after)
    });
  }
  const onlyLeft = diffs.filter((diff) => diff.kind === "only-left").length;
  const onlyRight = diffs.filter((diff) => diff.kind === "only-right").length;
  const identical = diffs.filter((diff) => diff.identical).length;
  return {
    summary: { leftCount: left.objects.length, rightCount: right.objects.length, onlyLeft, onlyRight, changed: diffs.length - onlyLeft - onlyRight - identical, identical },
    diffs,
    warnings: [...left.warnings, ...right.warnings]
  };
}
function errorText(error) {
  const failure = error;
  const rawCode = String(failure.code ?? "");
  const text3 = `${String(failure.sqlMessage ?? "")} ${String(failure.message ?? "")}`;
  const ora = /ORA-(\d{5})/.exec(text3);
  if (ora) return { error: `\u6570\u636E\u5E93\u8FD4\u56DE ORA-${ora[1]}\uFF1A${text3.trim().slice(0, 160)}`, code: `ORA-${ora[1]}` };
  const mapped = connectionFailure(error);
  return { error: mapped.message, code: mapped.code || rawCode };
}
async function snapshotWithStatus(environment) {
  const base = { key: environment.key, name: environment.name, schema: environment.schema };
  try {
    const snapshot = await snapshotOf(environment);
    return { status: { ...base, ok: true, objectCount: snapshot.objects.length }, snapshot };
  } catch (error) {
    return { status: { ...base, ok: false, ...errorText(error) } };
  }
}
async function testEnvironments() {
  const { path, environments } = loadEnvironments();
  const usable = environments.filter((env) => env.enabled);
  const results = await Promise.all(usable.map((environment) => snapshotWithStatus(environment)));
  return { path, environments: results.map((item) => item.status) };
}
async function runComparison(raw) {
  const body = object(raw);
  const { path, environments } = loadEnvironments();
  const usable = environments.filter((env) => env.enabled);
  if (usable.length < 2) throw new OceanBaseError("\u914D\u7F6E\u6587\u4EF6\u91CC\u9700\u8981\u81F3\u5C11\u4E24\u4E2A enabled \u7684\u73AF\u5883", 400);
  const left = usable[0];
  const right = usable[1];
  const filter = typeof body.filter === "string" ? body.filter.trim().toUpperCase() : "";
  const includeViews = body.includeViews !== false;
  const includeIdentical = body.includeIdentical === true;
  const [leftRead, rightRead] = await Promise.all([snapshotWithStatus(left), snapshotWithStatus(right)]);
  if (!leftRead.status.ok || !rightRead.status.ok) {
    const failed = [leftRead.status, rightRead.status].filter((status) => !status.ok);
    const ok = [leftRead.status, rightRead.status].filter((status) => status.ok);
    const message = [
      failed.map((status) => `${status.key}\uFF08${status.name}\uFF09\u8FDE\u63A5\u5931\u8D25\uFF1A${status.error}`).join("\uFF1B"),
      ok.length ? `\u53E6\u4E00\u4FA7\u53EF\u6B63\u5E38\u8BFB\u53D6\uFF1A${ok.map((status) => `${status.key} ${status.objectCount} \u4E2A\u5BF9\u8C61`).join("\u3001")}` : "",
      `\u8BF7\u68C0\u67E5\u914D\u7F6E\u6587\u4EF6\u91CC\u7684 user / tenant / cluster / password\uFF1A${path ?? "\uFF08\u672A\u627E\u5230\u914D\u7F6E\u6587\u4EF6\uFF09"}`
    ].filter(Boolean).join("\uFF1B");
    throw new OceanBaseError(message, 400, false, failed[0]?.code ?? "", {
      left: leftRead.status,
      right: rightRead.status,
      path
    });
  }
  const filtered = [leftRead.snapshot, rightRead.snapshot].map((snapshot) => ({
    ...snapshot,
    objects: snapshot.objects.filter((item) => (includeViews || item.type === "TABLE") && (!filter || item.name.includes(filter)))
  }));
  const result = compareSnapshots(filtered[0], filtered[1], { includeIdentical });
  return {
    left: { key: left.key, name: left.name, schema: left.schema, host: left.host, objects: filtered[0].objects.length },
    right: { key: right.key, name: right.name, schema: right.schema, host: right.host, objects: filtered[1].objects.length },
    statuses: { left: leftRead.status, right: rightRead.status },
    filter,
    ...result
  };
}

// src/oceanbase-routes.ts
var ORACLE_ERRORS = {
  1: "\u4E3B\u952E\u6216\u552F\u4E00\u7EA6\u675F\u51B2\u7A81\uFF1A\u8BE5\u503C\u5DF2\u5B58\u5728",
  54: "\u8BB0\u5F55\u6B63\u88AB\u5176\u4ED6\u4F1A\u8BDD\u9501\u5B9A\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  904: "\u5B57\u6BB5\u6216\u5BF9\u8C61\u540D\u65E0\u6548\uFF0C\u8BF7\u5237\u65B0\u8868\u7ED3\u6784\u540E\u91CD\u8BD5",
  942: "\u8868\u6216\u89C6\u56FE\u4E0D\u5B58\u5728\uFF0C\u6216\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u8BBF\u95EE\u6743\u9650",
  1013: "\u6570\u636E\u5E93\u64CD\u4F5C\u8D85\u65F6\uFF08\u8BF7\u6C42\u88AB\u53D6\u6D88\uFF09\uFF0C\u8BF7\u5237\u65B0\u6838\u5B9E\u7ED3\u679C",
  1017: "\u8BA4\u8BC1\u5931\u8D25\uFF1A\u7528\u6237\u540D\u3001\u79DF\u6237\u6216\u5BC6\u7801\u4E0D\u6B63\u786E",
  1031: "\u5F53\u524D\u8D26\u53F7\u6743\u9650\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u6267\u884C\u6B64\u64CD\u4F5C",
  1034: "\u5F53\u524D\u8D26\u53F7\u6743\u9650\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u6267\u884C\u6B64\u64CD\u4F5C",
  1400: "\u5FC5\u586B\u5B57\u6BB5\u4E0D\u80FD\u4E3A NULL",
  1407: "\u5FC5\u586B\u5B57\u6BB5\u4E0D\u80FD\u66F4\u65B0\u4E3A NULL",
  1427: "\u63D2\u5165\u7684\u503C\u8FC7\u591A\u6216\u8FC7\u5C11\uFF0C\u8BF7\u5237\u65B0\u8868\u7ED3\u6784\u540E\u91CD\u8BD5",
  1438: "\u5B57\u6BB5\u503C\u8D85\u51FA\u8BE5\u5217\u5141\u8BB8\u7684\u8303\u56F4",
  1722: "\u5B57\u6BB5\u503C\u4E0E\u5217\u7C7B\u578B\u4E0D\u5339\u914D\uFF08\u8BE5\u5217\u9700\u8981\u6570\u5B57\uFF09",
  1843: "\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u4F7F\u7528 YYYY-MM-DD \u6216 YYYY-MM-DD HH24:MI:SS",
  1858: "\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u4F7F\u7528 YYYY-MM-DD \u6216 YYYY-MM-DD HH24:MI:SS",
  1861: "\u65E5\u671F\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u4F7F\u7528 YYYY-MM-DD \u6216 YYYY-MM-DD HH24:MI:SS",
  2289: "\u552F\u4E00\u7EA6\u675F\u51B2\u7A81\uFF1A\u8BE5\u503C\u5DF2\u5B58\u5728",
  2291: "\u5173\u8054\u8BB0\u5F55\u4E0D\u5B58\u5728\uFF1A\u8BF7\u68C0\u67E5\u5916\u952E\u5B57\u6BB5\u7684\u503C",
  2292: "\u8BB0\u5F55\u88AB\u5176\u4ED6\u6570\u636E\u5F15\u7528\uFF0C\u4E0D\u80FD\u5220\u9664",
  30926: "\u5BF9\u8C61\u4E3A\u53EA\u8BFB\uFF0C\u4E0D\u80FD\u6267\u884C\u5199\u5165\u64CD\u4F5C",
  12899: "\u5B57\u6BB5\u5185\u5BB9\u8D85\u8FC7\u5217\u5141\u8BB8\u957F\u5EA6",
  12170: "\u8FDE\u63A5\u6570\u636E\u5E93\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u4E0E\u7AEF\u53E3",
  12514: "\u670D\u52A1\u540D\uFF08Oracle \u6A21\u5F0F\u901A\u5E38\u4E3A\u79DF\u6237\u540D\uFF09\u4E0D\u6B63\u786E",
  12541: "\u65E0\u6CD5\u8FDE\u63A5\u6570\u636E\u5E93\uFF1A\u5730\u5740\u6216\u7AEF\u53E3\u4E0D\u53EF\u8FBE",
  12545: "\u65E0\u6CD5\u5EFA\u7ACB\u8FDE\u63A5\uFF1A\u8BF7\u68C0\u67E5\u5730\u5740\u3001\u7AEF\u53E3\u4E0E\u670D\u52A1\u540D",
  3113: "\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u65AD\u5F00",
  3114: "\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u65AD\u5F00",
  3135: "\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u4E22\u5931"
};
var MYSQL_ERRORS = {
  ER_ACCESS_DENIED_ERROR: "\u8BA4\u8BC1\u5931\u8D25\uFF1A\u8D26\u53F7\u3001\u79DF\u6237\u6216\u5BC6\u7801\u4E0D\u6B63\u786E\uFF08\u8D26\u53F7\u9700\u5199\u6210 \u7528\u6237\u540D@\u79DF\u6237\u540D#\u96C6\u7FA4\u540D\uFF09",
  ER_DBACCESS_DENIED_ERROR: "\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u8BBF\u95EE\u8BE5\u6A21\u5F0F\u7684\u6743\u9650",
  ER_TABLEACCESS_DENIED_ERROR: "\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u6267\u884C\u6B64\u64CD\u4F5C\u7684\u6743\u9650",
  ER_DUP_ENTRY: "\u4E3B\u952E\u6216\u552F\u4E00\u7EA6\u675F\u51B2\u7A81\uFF1A\u8BE5\u503C\u5DF2\u5B58\u5728",
  ER_BAD_NULL_ERROR: "\u5FC5\u586B\u5B57\u6BB5\u4E0D\u80FD\u4E3A NULL",
  ER_NO_DEFAULT_FOR_FIELD: "\u8BF7\u586B\u5199\u6240\u6709\u65E0\u9ED8\u8BA4\u503C\u7684\u5FC5\u586B\u5B57\u6BB5",
  ER_DATA_TOO_LONG: "\u5B57\u6BB5\u5185\u5BB9\u8D85\u8FC7\u5217\u5141\u8BB8\u957F\u5EA6",
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: "\u5B57\u6BB5\u503C\u4E0E\u5217\u7C7B\u578B\u4E0D\u5339\u914D",
  ER_WARN_DATA_OUT_OF_RANGE: "\u5B57\u6BB5\u503C\u8D85\u51FA\u8BE5\u5217\u5141\u8BB8\u7684\u8303\u56F4",
  ER_NO_REFERENCED_ROW_2: "\u5173\u8054\u8BB0\u5F55\u4E0D\u5B58\u5728\uFF1A\u8BF7\u68C0\u67E5\u5916\u952E\u5B57\u6BB5\u7684\u503C",
  ER_ROW_IS_REFERENCED_2: "\u8BB0\u5F55\u88AB\u5176\u4ED6\u6570\u636E\u5F15\u7528\uFF0C\u4E0D\u80FD\u5220\u9664",
  ER_LOCK_WAIT_TIMEOUT: "\u8BB0\u5F55\u6B63\u88AB\u5176\u4ED6\u4F1A\u8BDD\u9501\u5B9A\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  ER_LOCK_DEADLOCK: "\u68C0\u6D4B\u5230\u6B7B\u9501\uFF0C\u4E8B\u52A1\u5DF2\u56DE\u6EDA\uFF0C\u8BF7\u91CD\u8BD5",
  ER_QUERY_INTERRUPTED: "\u6570\u636E\u5E93\u64CD\u4F5C\u8D85\u65F6\uFF08\u8BF7\u6C42\u88AB\u53D6\u6D88\uFF09\uFF0C\u8BF7\u5237\u65B0\u6838\u5B9E\u7ED3\u679C",
  ECONNREFUSED: "\u76EE\u6807\u7AEF\u53E3\u62D2\u7EDD\u8FDE\u63A5\uFF1A\u8BF7\u68C0\u67E5\u7AEF\u53E3\u662F\u5426\u6B63\u786E\uFF08ODP 2883 / \u76F4\u8FDE observer 2881\uFF09",
  ENOTFOUND: "\u65E0\u6CD5\u89E3\u6790\u6570\u636E\u5E93\u4E3B\u673A\u540D\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u5730\u5740",
  ETIMEDOUT: "\u8FDE\u63A5\u6570\u636E\u5E93\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u4E3B\u673A\u3001\u7AEF\u53E3\u4E0E\u7F51\u7EDC\u7B56\u7565",
  PROTOCOL_CONNECTION_LOST: "\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u65AD\u5F00",
  ECONNRESET: "\u6570\u636E\u5E93\u8FDE\u63A5\u5DF2\u91CD\u7F6E"
};
var CONNECTION_LOST = /* @__PURE__ */ new Set([1013, 3113, 3114, 3135, 12170, 12541, 12545]);
var CONNECTION_LOST_CODES = /* @__PURE__ */ new Set(["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "EPIPE", "ETIMEDOUT"]);
function describeFailure(error, action) {
  const failure = error;
  const errorNum = typeof failure.errorNum === "number" ? failure.errorNum : void 0;
  const rawCode = String(failure.code ?? "");
  const oraMatch = /ORA-(\d{5})/.exec(`${String(failure.message ?? "")} ${String(failure.sqlMessage ?? "")}`);
  const oraNum = errorNum ?? (oraMatch ? Number(oraMatch[1]) : void 0);
  const code = error instanceof OceanBaseError && error.code ? error.code : oraNum !== void 0 ? `ORA-${String(oraNum).padStart(5, "0")}` : rawCode;
  const writes = ["insert", "update", "delete"].includes(action);
  const uncertain = error instanceof OceanBaseError ? error.uncertain : writes && (oraNum !== void 0 && CONNECTION_LOST.has(oraNum) || CONNECTION_LOST_CODES.has(rawCode));
  const tooLarge = failure.message === "request body too large";
  const error$ = error instanceof OceanBaseError ? error.message : error instanceof SyntaxError ? "\u8BF7\u6C42 JSON \u683C\u5F0F\u4E0D\u6B63\u786E" : tooLarge ? "\u8BF7\u6C42\u5185\u5BB9\u8D85\u8FC7 1 MB\uFF0C\u8BF7\u51CF\u5C11\u5B57\u6BB5\u5185\u5BB9\u540E\u91CD\u8BD5" : (oraNum !== void 0 ? ORACLE_ERRORS[oraNum] : void 0) ?? MYSQL_ERRORS[rawCode] ?? "\u6570\u636E\u5E93\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5B57\u6BB5\u7C7B\u578B\u3001\u8FDE\u63A5\u914D\u7F6E\u548C\u8D26\u53F7\u6743\u9650";
  return {
    status: error instanceof OceanBaseError ? error.status : tooLarge ? 413 : uncertain ? 503 : 400,
    body: {
      error: uncertain ? "\u8FDE\u63A5\u4E2D\u65AD\u6216\u8D85\u65F6\uFF0C\u5199\u5165\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\u3002\u8BF7\u5237\u65B0\u6838\u5B9E\u8BB0\u5F55\uFF0C\u52FF\u91CD\u590D\u63D0\u4EA4\u3002" : error$,
      uncertain,
      ...code ? { code } : {},
      ...error instanceof OceanBaseError && error.details !== void 0 ? { details: error.details } : {}
    }
  };
}
function mountOceanBase(host, prefix) {
  return ["connect", "verify", "profiles", "ddl-environments", "ddl-test", "ddl-compare", "tables", "rows", "insert", "update", "delete"].map((action) => host.webServer.register({
    kind: "exact",
    path: `${prefix}/api/oceanbase/${action}`,
    handler: async (req, res) => {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "\u8BF7\u4F7F\u7528 POST \u8BF7\u6C42" });
        return;
      }
      let originOK = false;
      try {
        const origin = new URL(req.headers.origin || "");
        originOK = ["http:", "https:"].includes(origin.protocol) && origin.host === req.headers.host;
      } catch {
      }
      if (!originOK || !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
        sendJson(res, 403, { error: "\u4EC5\u5141\u8BB8\u4ECE\u672C\u5E94\u7528\u53D1\u8D77 JSON \u8BF7\u6C42" });
        return;
      }
      try {
        const body = object(await readJsonBody(req));
        const result = action === "profiles" ? handleProfileAction(body) : action === "ddl-environments" ? environmentsForDisplay() : action === "ddl-test" ? await testEnvironments() : action === "ddl-compare" ? await runComparison(body) : await executeOceanBase(action, body);
        sendJson(res, 200, { ok: true, ...object(result) });
      } catch (error) {
        const { status, body } = describeFailure(error, action);
        sendJson(res, status, body);
      }
    }
  }));
}

// src/werun.ts
import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "node:fs";
import { get } from "node:https";
import { join as join4 } from "node:path";
function werunFile() {
  return join4(configDir(), "werun.json");
}
function loadWeRunMap() {
  try {
    return JSON.parse(readFileSync4(werunFile(), "utf8"));
  } catch {
    return {};
  }
}
function saveWeRunEntry(date, steps) {
  const map = loadWeRunMap();
  map[date] = steps;
  writeFileSync3(werunFile(), JSON.stringify(map, null, 2), "utf8");
}
function code2session(code) {
  const appid = process.env.WEIXIN_APPID;
  const secret = process.env.WEIXIN_SECRET;
  if (!appid || !secret) {
    return Promise.reject(new Error("\u672A\u914D\u7F6E WEIXIN_APPID / WEIXIN_SECRET\uFF08\u5C0F\u7A0B\u5E8F AppID / AppSecret\uFF09"));
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  return new Promise((resolve3, reject) => {
    get(url, (res) => {
      let raw = "";
      res.on("data", (c2) => {
        raw += c2;
      });
      res.on("end", () => {
        try {
          resolve3(JSON.parse(raw));
        } catch (e) {
          reject(new Error("code2session \u8FD4\u56DE\u89E3\u6790\u5931\u8D25"));
        }
      });
    }).on("error", reject);
  });
}
function decryptWeixinData(encryptedData, sessionKey, iv) {
  const decipher = createDecipheriv("aes-128-cbc", Buffer.from(sessionKey, "base64"), Buffer.from(iv, "base64"));
  decipher.setAutoPadding(true);
  const decoded = Buffer.concat([decipher.update(Buffer.from(encryptedData, "base64")), decipher.final()]);
  return JSON.parse(decoded.toString("utf8"));
}
function todayStepsFromWeRun(data) {
  const list = data.stepInfoList ?? [];
  const latest = list.length ? list[list.length - 1] : null;
  if (!latest) return { date: "", steps: 0 };
  const d2 = new Date((latest.timestamp + 8 * 3600) * 1e3);
  const date = `${d2.getUTCFullYear()}-${String(d2.getUTCMonth() + 1).padStart(2, "0")}-${String(d2.getUTCDate()).padStart(2, "0")}`;
  return { date, steps: latest.step };
}

// src/routes.ts
var liveReports = [...AGENT_REPORTS];
var liveDict = [...DICTIONARY];
var dictCursor = DICTIONARY.length;
var ENV_OVERRIDES = {
  WLC_FROZEN_APPRO_DETAIL: {
    SIT: {
      drop: ["BIZ_TYPE"],
      change: { ACQUIS_CHAN_CD: { type: "VARCHAR2(16)", comment: "\u53D1\u8D77\u6E20\u9053\u7F16\u7801\uFF08SIT \u653E\u5BBD\u4E3A 16 \u4F4D\uFF09" } }
    }
  }
};
function envColumns(env, table) {
  const override = ENV_OVERRIDES[table.name]?.[env];
  if (override === void 0) return table.columns;
  const drop = new Set(override.drop ?? []);
  return table.columns.filter((column) => !drop.has(column.name)).map((column) => ({ ...column, ...override.change?.[column.name] ?? {} }));
}
function jsonParseSafe(text3) {
  try {
    return JSON.parse(text3);
  } catch {
    return null;
  }
}
var registeredPaths = [];
var staticDebug = { called: 0 };
var debugModulePath = fileURLToPath2(import.meta.url);
var mountState = { apiError: "", staticError: "" };
function noteMountError(section, message) {
  if (section === "api") mountState.apiError = message;
  else mountState.staticError = message;
}
function mountRoutes(host, options) {
  const route = options.routePrefix.replace(/\/$/, "");
  const disposers = [];
  const seen = /* @__PURE__ */ new Set();
  const on = (path, handler) => {
    if (seen.has(path)) {
      throw new Error(`wangtie-os: duplicate route ${path} \u2014 \u5408\u5E76 handler \u6309 method/\u53C2\u6570\u5206\u53D1\uFF0C\u4E0D\u8981\u91CD\u590D\u6CE8\u518C`);
    }
    seen.add(path);
    registeredPaths.push(`${route}${path}`);
    disposers.push(host.webServer.register({ kind: "exact", path: `${route}${path}`, handler }));
  };
  const log = host.logger?.info ?? (() => {
  });
  on("/api/health", (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      name: options.appName,
      version: options.appVersion,
      routes: [...registeredPaths],
      debug: { modulePath: debugModulePath, staticCalled: staticDebug.called, mountState }
    });
  });
  on("/api/app-info", (_req, res) => {
    sendJson(res, 200, {
      name: options.appName,
      version: options.appVersion,
      environments: ENVIRONMENTS,
      services: SERVICES.map((service) => ({ name: service.name, cn: service.cn, instances: service.instances }))
    });
  });
  on("/api/environments", (_req, res) => {
    sendJson(res, 200, ENVIRONMENTS);
  });
  on("/api/services", (req, res) => {
    const env = queryOf(req, "env") || "DEV";
    sendJson(res, 200, SERVICES.map((service) => ({ name: service.name, cn: service.cn, runtime: service.runtime[env] ?? null })));
  });
  on("/api/config", (req, res) => {
    if (req.method === "GET") {
      const config = loadConfig();
      sendJson(res, 200, config);
      return;
    }
    if (req.method !== "PUT") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const config = { ...loadConfig(), ...jsonParseSafe(JSON.stringify(raw)) ?? {} };
      saveConfig(config);
      sendJson(res, 200, { ok: true, config });
    }).catch((error) => sendJson(res, 400, { error: String(error) }));
  });
  on("/api/db/test", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      const host2 = String(body.host ?? "").trim();
      if (host2 === "") {
        sendJson(res, 400, { ok: false, error: "host\uFF08\u6570\u636E\u5E93\u5730\u5740\uFF09\u4E0D\u80FD\u4E3A\u7A7A" });
        return;
      }
      const port = resolveDbPort(body);
      if (port === null) {
        sendJson(res, 400, { ok: false, error: "\u7AEF\u53E3\u65E0\u6548\uFF081-65535\uFF09\uFF0C\u6216\u672A\u63D0\u4F9B\u4E14\u65E0\u8BE5\u7C7B\u578B\u9ED8\u8BA4\u7AEF\u53E3" });
        return;
      }
      void testTcpReachability(host2, port, 3e3).then((result) => {
        sendJson(res, 200, { ok: result.ok, code: result.code, ms: result.ms, detail: result.detail, host: host2, port, type: body.type ?? "mysql" });
      });
    }).catch((error) => sendJson(res, 400, { ok: false, error: String(error) }));
  });
  on("/api/werun/sync", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      if (!body.code || !body.encryptedData || !body.iv) {
        sendJson(res, 400, { ok: false, error: "\u7F3A\u5C11 code / encryptedData / iv" });
        return;
      }
      void code2session(body.code).then((session) => {
        if (session.errcode || !session.session_key) {
          sendJson(res, 400, { ok: false, error: session.errmsg ?? "code2session \u5931\u8D25" });
          return;
        }
        try {
          const data = decryptWeixinData(body.encryptedData, session.session_key, body.iv);
          const { date, steps } = todayStepsFromWeRun(data);
          if (date) saveWeRunEntry(date, steps);
          sendJson(res, 200, { ok: true, date, steps, openid: session.openid ?? "" });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: "\u89E3\u5BC6\u5931\u8D25\uFF1A" + String(error) });
        }
      }).catch((error) => sendJson(res, 400, { ok: false, error: String(error) }));
    }).catch((error) => sendJson(res, 400, { ok: false, error: String(error) }));
  });
  on("/api/health/werun/latest", (_req, res) => {
    const map = loadWeRunMap();
    const dates = Object.keys(map).sort();
    const date = dates[dates.length - 1];
    if (!date) {
      sendJson(res, 200, { ok: true, synced: false });
      return;
    }
    sendJson(res, 200, { ok: true, synced: true, date, steps: map[date] });
  });
  on("/api/knowledge/docs", (_req, res) => {
    sendJson(res, 200, KNOWLEDGE_DOCS.map(({ id, title, category, summary }) => ({ id, title, category, summary })));
  });
  on("/api/knowledge/search", (req, res) => {
    const q = queryOf(req, "q").trim();
    if (q === "") {
      sendJson(res, 200, { answer: "\u8BF7\u8F93\u5165\u8981\u68C0\u7D22\u7684\u95EE\u9898\u3002", citations: [], tables: [] });
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = KNOWLEDGE_DOCS.map((doc) => {
      const corpus = [doc.title, doc.summary, ...doc.paragraphs].join("\n").toLowerCase();
      const score = terms.reduce((acc, term) => acc + (corpus.includes(term.toLowerCase()) ? 1 : 0), 0);
      return { doc, score };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
    if (scored.length === 0) {
      sendJson(res, 200, {
        answer: `\u7968\u636E\u77E5\u8BC6\u5E93\u4E2D\u672A\u627E\u5230\u4E0E\u300C${q}\u300D\u76F8\u5173\u7684\u6587\u6863\uFF0C\u8BF7\u5C1D\u8BD5\u66F4\u6362\u5173\u952E\u8BCD\uFF0C\u6216\u6D4F\u89C8\u77E5\u8BC6\u5E93\u5168\u91CF\u6587\u6863\u3002`,
        citations: [],
        tables: []
      });
      return;
    }
    const best = scored[0];
    if (!best) return;
    sendJson(res, 200, {
      answer: best.doc.paragraphs.join("\n\n"),
      citations: scored.map(({ doc, score }) => ({ id: doc.id, title: doc.title, category: doc.category, score })),
      tables: best.doc.tables ?? [],
      docId: best.doc.id
    });
  });
  function detectTable(sql) {
    const match = /\bfrom\s+([a-z_][a-z0-9_]*)/i.exec(sql.replace(/[\r\n]/g, " "));
    if (match === null) return void 0;
    const name2 = match[1].toUpperCase();
    return TABLES.find((table) => table.name === name2);
  }
  on("/api/sql/tables", (_req, res) => {
    sendJson(res, 200, TABLES.map((table) => ({ name: table.name, cn: table.cn, domain: table.domain })));
  });
  on("/api/sql/query", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      const sql = (body.sql ?? "").trim();
      if (sql === "") {
        sendJson(res, 400, { error: "empty sql" });
        return;
      }
      const table = detectTable(sql);
      const costMs = 3 + Math.floor(Math.random() * 40);
      if (table === void 0) {
        sendJson(res, 200, {
          env: body.env ?? "DEV",
          sql,
          table: null,
          costMs,
          columns: [],
          rows: [],
          message: "\u672A\u8BC6\u522B\u5230\u8868\u540D\uFF08Mock \u67E5\u8BE2\uFF09\uFF0C\u63A5\u5165\u771F\u5B9E\u6570\u636E\u6E90\u540E\u7531 SQL \u7F51\u5173\u6267\u884C\u3002"
        });
        return;
      }
      const columns = table.columns.map((column) => ({ name: column.name, cn: column.cn, type: column.type }));
      const rows2 = Array.from({ length: 8 }, (_, i) => Object.fromEntries(table.columns.map((column) => [column.name, column.type.startsWith("NUMBER") ? (i + 1) * 100 : `${column.name.slice(0, 4)}${i + 1}`])));
      sendJson(res, 200, { env: body.env ?? "DEV", sql, table: table.name, costMs, columns, rows: rows2, truncated: rows2.length >= 8 });
    }).catch((error) => sendJson(res, 400, { error: String(error) }));
  });
  on("/api/agent/log-search", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      const keyword = (body.keyword ?? "").trim();
      if (keyword === "") {
        sendJson(res, 400, { error: "keyword required" });
        return;
      }
      const env = body.env ?? "DEV";
      const instance = body.instance ?? "scb-online";
      const hits = 3 + Math.floor(Math.random() * 6);
      const steps = [
        { step: "1 \u4E0B\u8F7D\u65E5\u5FD7", detail: `\u4E0B\u8F7D ${instance}_20260828.log\uFF08518.6 KB\uFF0C\u6309\u9700\u622A\u53D6\uFF09`, cost: "1.2s" },
        { step: "2 \u5173\u952E\u5B57\u68C0\u7D22", detail: `\u547D\u4E2D\u5173\u952E\u5B57 ${keyword} \u5171 ${hits} \u5904\uFF08\u4E0A\u4E0B\u5404 5 \u884C\u4E0A\u4E0B\u6587\uFF09`, cost: "0.8s" },
        { step: "3 \u53BB\u566A", detail: "\u8FC7\u6EE4\u5FC3\u8DF3/\u5E38\u89C4\u65E5\u5FD7 2 \u5904\uFF0C\u4FDD\u7559\u5F02\u5E38\u4E0A\u4E0B\u6587", cost: "0.3s" },
        { step: "4 \u5F02\u5E38\u94FE\u5206\u6790", detail: "\u8BC6\u522B 1 \u6761\u5F02\u5E38\u94FE\uFF0C1 \u7C7B\u62A5\u9519", cost: "3.1s" },
        { step: "5 \u751F\u6210\u62A5\u544A", detail: "\u5DF2\u4FDD\u5B58\u5230\u5386\u53F2\u5206\u6790\u62A5\u544A", cost: "0.4s" }
      ];
      const report = {
        id: `rep-live-${Date.now()}`,
        keyword,
        env,
        instance,
        createdAt: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { hour12: false }),
        costMs: 5800,
        logSize: "518.6 KB",
        hits,
        exception: "\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A",
        errorType: "com.bbbd.dal.core.exception.TransactionException",
        suggestion: "\u62A5\u9519\u94FE\uFF1A\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u6821\u9A8C\u670D\u52A1\u8BF7\u6C42\u5165\u53C2\u7F51\u70B9\u7F16\u7801\u7F3A\u5931\u7B49\u539F\u56E0\u3002\u8BF7\u4E0A\u9001\u7F51\u70B9\u7F16\u7801\uFF08ccnMemberOrCustCd \u7B49\u5B57\u6BB5\uFF09\u5230\u5B57\u6BB5\uFF1B\u5728\u8BF7\u6C42\u62A5\u6587 XML \u4E2D\u8865\u5145\u7F51\u70B9\u7F16\u7801\u3002",
        relatedErrors: [
          `TRANSACTION_EXCEPTION: WLC_TRANSACTION_EXCEPTION: ${keyword}(1)`,
          "TRANSACTION_INVALID: com.bbbd.dal.core.exception.TransactionException: \u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A"
        ],
        codeSnippet: [
          "042  if (StringUtils.isBlank(acquirerId)) {",
          '043    throw new TransactionException("TRANSACTION_EXCEPTION", "\u5F00\u6237\u7F51\u70B9\u7F16\u7801\u4E0D\u80FD\u4E3A\u7A7A");',
          "044  }"
        ]
      };
      liveReports.unshift(report);
      sendJson(res, 200, { steps, costMs: report.costMs, report });
    }).catch((error) => sendJson(res, 400, { error: String(error) }));
  });
  on("/api/agent/reports", (req, res) => {
    const id = queryOf(req, "id");
    if (id === "") {
      sendJson(res, 200, liveReports);
      return;
    }
    const report = liveReports.find((item) => item.id === id);
    if (report === void 0) {
      sendJson(res, 404, { error: "report not found" });
      return;
    }
    sendJson(res, 200, report);
  });
  on("/api/dictionary/entries", (req, res) => {
    const q = queryOf(req, "q").trim().toLowerCase();
    const category = queryOf(req, "category");
    const entries = liveDict.filter((entry) => (category === "" || entry.category === category) && (q === "" || entry.cn.toLowerCase().includes(q) || entry.en.toLowerCase().includes(q) || entry.code.toLowerCase().includes(q)));
    sendJson(res, 200, { total: liveDict.length, entries });
  });
  on("/api/dictionary/categories", (_req, res) => {
    sendJson(res, 200, [...new Set(liveDict.map((entry) => entry.category))]);
  });
  on("/api/dictionary/import", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      const lines = (body.payload ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const parsed = lines.map((line) => {
        const [cn, en, code, value, category = "\u5BFC\u5165"] = line.split(/[,，\t]/).map((part) => (part ?? "").trim());
        return {
          id: ++dictCursor,
          cn: cn ?? "",
          en: en ?? "",
          code: code ?? "",
          value: value ?? "",
          category,
          source: "\u624B\u52A8\u5BFC\u5165",
          version: `IMPORT-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
        };
      }).filter((entry) => entry.code !== "");
      liveDict.unshift(...parsed);
      sendJson(res, 200, { ok: true, imported: parsed.length, entries: parsed });
    }).catch((error) => sendJson(res, 400, { error: String(error) }));
  });
  on("/api/metadata/tables", (req, res) => {
    const env = queryOf(req, "env") || "DEV";
    sendJson(res, 200, TABLES.map((table) => ({
      name: table.name,
      cn: table.cn,
      domain: table.domain,
      fieldCount: envColumns(env, table).length
    })));
  });
  on("/api/metadata/table", (req, res) => {
    const env = queryOf(req, "env") || "DEV";
    const name2 = queryOf(req, "name").toUpperCase();
    const table = TABLES.find((item) => item.name === name2);
    if (table === void 0) {
      sendJson(res, 404, { error: "table not found" });
      return;
    }
    sendJson(res, 200, { name: table.name, cn: table.cn, domain: table.domain, columns: envColumns(env, table) });
  });
  on("/api/metadata/compare", (req, res) => {
    const a = queryOf(req, "a") || "DEV";
    const b = queryOf(req, "b") || "SIT";
    const name2 = queryOf(req, "name").toUpperCase();
    const table = TABLES.find((item) => item.name === name2);
    if (table === void 0) {
      sendJson(res, 404, { error: "table not found" });
      return;
    }
    const ca = envColumns(a, table);
    const cb = envColumns(b, table);
    const mapA = new Map(ca.map((column) => [column.name, column]));
    const mapB = new Map(cb.map((column) => [column.name, column]));
    const aOnly = ca.filter((column) => !mapB.has(column.name));
    const bOnly = cb.filter((column) => !mapA.has(column.name));
    const typeDiffs = ca.filter((column) => mapB.get(column.name)?.type !== column.type);
    sendJson(res, 200, { table: table.name, a, b, aOnly, bOnly, typeDiffs, aCount: ca.length, bCount: cb.length });
  });
  on("/api/metadata/versions", (req, res) => {
    const env = queryOf(req, "env") || "DEV";
    sendJson(res, 200, VERSIONS.filter((version) => version.env === env));
  });
  on("/api/metadata/alter-sql", (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    void readJsonBody(req).then((raw) => {
      const body = raw ?? {};
      const table = (body.table ?? "").toUpperCase();
      if (table === "" || !Array.isArray(body.changes)) {
        sendJson(res, 400, { error: "table and changes required" });
        return;
      }
      const sql = body.changes.map((change) => {
        const field = (change.field ?? "").toUpperCase();
        const type = change.type ?? "VARCHAR2(32)";
        if (!field) return null;
        if (change.kind === "modify") return `ALTER TABLE ${table} MODIFY (${field} ${type}${change.cn ? ` /* ${change.cn} */` : ""});`;
        return `ALTER TABLE ${table} ADD (${field} ${type}${change.cn ? ` /* ${change.cn} */` : ""});`;
      }).filter((line) => line !== null);
      sendJson(res, 200, { table, sql });
    }).catch((error) => sendJson(res, 400, { error: String(error) }));
  });
  disposers.push(...mountOceanBase(host, route));
  log(`${options.appName}: mounted ${disposers.length} routes under ${route}`);
  return disposers;
}

// src/static.ts
import { existsSync as existsSync2, readFileSync as readFileSync5, statSync as statSync2 } from "node:fs";
import { extname, resolve as resolve2, sep } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var UI_DIR = resolve2(fileURLToPath3(new URL("../ui", import.meta.url)));
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};
function staticDisposers(webServer, routePrefix) {
  staticDebug.called += 1;
  const base = routePrefix.replace(/\/$/, "");
  const uiPrefix = `${base}/ui`;
  const serveFile = (response, relative) => {
    const target = resolve2(UI_DIR, relative);
    if (target !== UI_DIR && !target.startsWith(UI_DIR + sep)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    if (!existsSync2(target) || statSync2(target).isDirectory()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const type = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(readFileSync5(target));
  };
  const serveRelative = (request, response) => {
    let pathname = "/";
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
    }
    let relative = pathname.slice(uiPrefix.length);
    if (relative === "" || relative === "/") relative = "index.html";
    if (relative.startsWith("/")) relative = relative.slice(1);
    serveFile(response, relative);
  };
  registeredPaths.push(`exact:${base}`, `exact:${base}/`, `prefix:${uiPrefix}`);
  return [
    webServer.register({
      kind: "exact",
      path: base,
      handler: (_request, response) => serveFile(response, "index.html")
    }),
    webServer.register({
      kind: "exact",
      path: `${base}/`,
      handler: (_request, response) => serveFile(response, "index.html")
    }),
    webServer.register({
      kind: "prefix",
      path: uiPrefix,
      handler: serveRelative
    })
  ];
}

// src/index.ts
var name = "wangtie-os";
function apply(ctx, config) {
  ctx.inject(["webServer"], (hostCtx) => {
    const host = hostCtx;
    const options = {
      routePrefix: config?.routePrefix ?? "/wangtie-os",
      appName: config?.appName ?? "\u738B\u94C1 OS",
      appVersion: config?.appVersion ?? "0.1.0-rc.1"
    };
    hostCtx.effect(() => {
      const disposers = [];
      try {
        disposers.push(...mountRoutes(host, options));
      } catch (error) {
        noteMountError("api", String(error));
      }
      try {
        disposers.push(...staticDisposers(host.webServer, options.routePrefix));
      } catch (error) {
        noteMountError("static", String(error));
      }
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, `${name}: http routes`);
  });
}
export {
  apply,
  name
};
