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
var name = "wangtie-os";
var inject = ["slots"];
var open = false;
var listeners = /* @__PURE__ */ new Set();
function setOpen(value) {
  open = value;
  for (const listener of [...listeners]) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useOpen() {
  return (0, import_react.useSyncExternalStore)(subscribe, () => open);
}
function FullScreenApp() {
  const opened = useOpen();
  if (!opened) return null;
  return (0, import_react.createElement)(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "#f4f6fa",
        display: "flex",
        flexDirection: "column"
      }
    },
    (0, import_react.createElement)(
      "div",
      {
        style: {
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          background: "#101728",
          color: "#fff",
          fontSize: 13
        }
      },
      (0, import_react.createElement)("span", { style: { fontWeight: 700 } }, "\u738B\u94C1 OS"),
      (0, import_react.createElement)("button", {
        onClick: () => setOpen(false),
        style: {
          background: "transparent",
          color: "#cdd7ea",
          border: "1px solid #3a4a6e",
          borderRadius: 6,
          padding: "3px 10px",
          cursor: "pointer",
          fontSize: 12
        }
      }, "\u8FD4\u56DE DSH")
    ),
    (0, import_react.createElement)("iframe", {
      src: "/wangtie-os/",
      style: { flex: 1, width: "100%", border: "none", background: "#f4f6fa" },
      title: "\u738B\u94C1 OS"
    })
  );
}
function SidebarTrigger() {
  const opened = useOpen();
  return (0, import_react.createElement)("button", {
    onClick: () => setOpen(!opened),
    style: {
      width: "100%",
      padding: "7px 10px",
      cursor: "pointer",
      fontSize: 12,
      borderRadius: 6,
      border: "none",
      background: opened ? "#2b3a5e" : "transparent",
      color: opened ? "#fff" : "#cdd7ea",
      textAlign: "left"
    }
  }, opened ? "\u9000\u51FA \u738B\u94C1 OS" : "\u{1F34A} \u738B\u94C1 OS");
}
function apply(ctx) {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "wangtie-os-app",
    order: 100,
    label: () => "\u738B\u94C1 OS",
    inject: () => ({})
  }, () => (0, import_react.createElement)(FullScreenApp)));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "wangtie-os-trigger",
    order: 100,
    label: () => "\u738B\u94C1 OS",
    inject: () => ({})
  }, () => (0, import_react.createElement)(SidebarTrigger)));
}
return module.exports; } });
