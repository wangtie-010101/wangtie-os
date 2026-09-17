window.__ModuleLoader__.load({ id: "wangtie-os", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var APP_URL = "/wangtie-os/";
var name = "wangtie-os";
var inject = ["slots"];
function SidebarTrigger() {
  return (0, import_react.createElement)("button", {
    onClick: () => {
      window.open(APP_URL, "_blank", "noopener");
    },
    style: {
      width: "100%",
      padding: "7px 10px",
      cursor: "pointer",
      fontSize: 12,
      borderRadius: 6,
      border: "none",
      background: "transparent",
      color: "#cdd7ea",
      textAlign: "left"
    },
    title: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00\u738B\u94C1 OS\uFF08\u5BBF\u4E3B\u6258\u7BA1 /wangtie-os\uFF09"
  }, "\u{1F34A} \u738B\u94C1 OS");
}
function apply(ctx) {
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "wangtie-os-trigger",
    order: 100,
    label: () => "\u738B\u94C1 OS",
    inject: () => ({})
  }, () => (0, import_react.createElement)(SidebarTrigger)));
}
return module.exports; } });
