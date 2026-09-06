/**
 * 王铁 OS — DSH 客户端插件。
 *
 * 契约（详见调研报告 / 参照 dshmarket）：
 *  - package.json 声明 dsh.client.platform=web 与 exports['./client']；
 *  - 本文件经 esbuild 打包为「工厂式 CJS」：
 *      window.__ModuleLoader__.load({ id: 'wangtie-os', factory: (require) => { ... } })
 *  - 仅 react 等 8 个平台词为外部依赖（seed 提供），其余一律内联；
 *  - web 壳启动时经 /plugins/wangtie-os/client.js 动态拉取，无需重建 apps/web。
 *
 * 挂载方式（官方推荐的槽位）：
 *  - 'shell.overlay'：全屏罩层（position:fixed; inset:0），内嵌我们的 SPA iframe；
 *  - 'sidebar.footer.action'：侧边栏入口按钮，控制全屏层的打开/关闭。
 */

import { createElement as h, useSyncExternalStore } from 'react'

/** 客户端插件 ID（必须是包名，与模块表行 id 一致）。 */
export const name = 'wangtie-os'

/** 注入所需服务：slots（槽位注册表）。 */
export const inject = ['slots']

/* ------------------------ 全屏层开关（跨组件共享状态） ------------------------ */

let open = false
const listeners = new Set<() => void>()

function setOpen(value: boolean): void {
  open = value
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function useOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open)
}

/* ------------------------------- 组件 ------------------------------- */

/** 全屏应用层：内嵌 /wangtie-os/ 的 SPA（同源 iframe，完全自包含）。 */
function FullScreenApp(): ReturnType<typeof h> {
  const opened = useOpen()
  if (!opened) return null
  return h('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 999, background: '#f4f6fa',
      display: 'flex', flexDirection: 'column',
    },
  },
    h('div', {
      style: {
        height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', background: '#101728', color: '#fff', fontSize: 13,
      },
    },
      h('span', { style: { fontWeight: 700 } }, '王铁 OS'),
      h('button', {
        onClick: () => setOpen(false),
        style: {
          background: 'transparent', color: '#cdd7ea', border: '1px solid #3a4a6e',
          borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12,
        },
      }, '返回 DSH'),
    ),
    h('iframe', {
      src: '/wangtie-os/',
      style: { flex: 1, width: '100%', border: 'none', background: '#f4f6fa' },
      title: '王铁 OS',
    }),
  )
}

/** 侧边栏入口按钮。 */
function SidebarTrigger(): ReturnType<typeof h> {
  const opened = useOpen()
  return h('button', {
    onClick: () => setOpen(!opened),
    style: {
      width: '100%', padding: '7px 10px', cursor: 'pointer', fontSize: 12,
      borderRadius: 6, border: 'none',
      background: opened ? '#2b3a5e' : 'transparent', color: opened ? '#fff' : '#cdd7ea',
      textAlign: 'left',
    },
  }, opened ? '退出 王铁 OS' : '🍊 王铁 OS')
}

/* ------------------------------- 注册 ------------------------------- */

// 类型从宽：客户端运行时由宿主提供（@deepseek-ai/dsh-client-runtime），骨架阶段不强类型。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apply(ctx: any): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'wangtie-os-app',
    order: 100,
    label: () => '王铁 OS',
    inject: () => ({}),
  }, () => h(FullScreenApp)))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'wangtie-os-trigger',
    order: 100,
    label: () => '王铁 OS',
    inject: () => ({}),
  }, () => h(SidebarTrigger)))
}
