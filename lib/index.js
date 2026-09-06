// src/routes.ts
import { fileURLToPath } from "node:url";

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
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("request body too large");
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
    cn: "\u94B1\u5305\u8054\u673A\u670D\u52A1",
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
function jsonParseSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
var registeredPaths = [];
var staticDebug = { called: 0 };
var debugModulePath = fileURLToPath(import.meta.url);
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
      const rows = Array.from({ length: 8 }, (_, i) => Object.fromEntries(table.columns.map((column) => [column.name, column.type.startsWith("NUMBER") ? (i + 1) * 100 : `${column.name.slice(0, 4)}${i + 1}`])));
      sendJson(res, 200, { env: body.env ?? "DEV", sql, table: table.name, costMs, columns, rows, truncated: rows.length >= 8 });
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
  log(`${options.appName}: mounted ${disposers.length} routes under ${route}`);
  return disposers;
}

// src/static.ts
import { existsSync, readFileSync as readFileSync2, statSync } from "node:fs";
import { extname, resolve as resolve2, sep } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var UI_DIR = resolve2(fileURLToPath2(new URL("../ui", import.meta.url)));
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
    if (!existsSync(target) || statSync(target).isDirectory()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const type = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(readFileSync2(target));
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
  registeredPaths.push(`exact:${base}`, `prefix:${uiPrefix}`);
  return [
    webServer.register({
      kind: "exact",
      path: base,
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
    host.effect(() => {
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
