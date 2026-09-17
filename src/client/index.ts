/**
 * 王铁 OS — DSH 客户端插件（入口按钮）。
 *
 * 契约（参照 dshmarket）：
 *  - package.json 声明 dsh.client.platform=web 与 exports['./client']；
 *  - 本文件经 esbuild 打包为「工厂式 CJS」；
 *  - 仅 react 等 8 个平台词为外部依赖，其余内联。
 *
 * 挂载：'sidebar.footer.action' 侧边栏入口按钮。
 * 点击后在新标签页打开王铁 OS（宿主托管的 /wangtie-os），不遮挡 DSH 当前界面。
 */

import { createElement as h } from 'react'

/**
 * 王铁 OS 应用地址：同源 `/wangtie-os`，即 DSH 宿主自己托管的这份应用
 * （已把预览版代码合并进宿主插件，所以不再指向 3081 的本地预览）。
 */
const APP_URL = '/wangtie-os/'

/** 客户端插件 ID（必须是包名）。 */
export const name = 'wangtie-os'

/** 注入所需服务：slots（槽位注册表）。 */
export const inject = ['slots']

/** 侧边栏入口按钮：新标签页打开王铁 OS 本地预览（保持 DSH 界面不被遮挡）。 */
function SidebarTrigger(): ReturnType<typeof h> {
  return h('button', {
    onClick: () => {
      window.open(APP_URL, '_blank', 'noopener')
    },
    style: {
      width: '100%', padding: '7px 10px', cursor: 'pointer', fontSize: 12,
      borderRadius: 6, border: 'none',
      background: 'transparent', color: '#cdd7ea', textAlign: 'left',
    },
    title: '在新标签页打开王铁 OS（宿主托管 /wangtie-os）',
  }, '🍊 王铁 OS')
}

/** 注册到 DSH 侧边栏底部动作区。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apply(ctx: any): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'wangtie-os-trigger',
    order: 100,
    label: () => '王铁 OS',
    inject: () => ({}),
  }, () => h(SidebarTrigger)))
}
