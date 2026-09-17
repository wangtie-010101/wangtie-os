/**
 * 王铁 OS — 「OceanBase 管理」（Oracle 模式）前端交互测试。
 * 用 jsdom + 假的 /api/oceanbase/* 接口跑完整流程：连接 → 选模式/表 → 查询 → 筛选 →
 * 新增 → 修改 → 并发冲突 → 删除 → 刷新失败/不确定写入/离开页面等边界。
 * 覆盖 Oracle 特有两处：主键定位与无主键堆表的 ROWID 定位。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { JSDOM } from 'jsdom'
import { renderOceanBase, oceanBaseCsvCell, parseConnectString, splitUser } from '../ui/oceanbase.js'

test('connect-string smart parse accepts obclient/OceanBase-client style input', () => {
  // OceanBase 客户端里那一行示例
  assert.deepEqual(parseConnectString("obclient -h 10.0.0.10 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'0bPassw0rd'"), {
    host: '10.0.0.10', port: '2883', user: 'OB_USER', tenant: 'obtenant_sit', cluster: 'OB_CLUSTER', password: '0bPassw0rd',
  })
  // 带引号/双引号/长参数的写法
  assert.deepEqual(parseConnectString('mysql --host=10.0.0.9 --port=2881 --user=app@t -p"secret"'), {
    host: '10.0.0.9', port: '2881', user: 'app', tenant: 't', cluster: '', password: 'secret',
  })
  // 没有参数时退化为 host:port 连接串
  assert.deepEqual(parseConnectString('10.0.0.9:2883'), { host: '10.0.0.9', port: '2883' })
  // 什么都没解析到时返回空对象（页面会提示粘贴格式）
  assert.deepEqual(parseConnectString('随便一句话'), {})
  assert.deepEqual(splitUser('OB_USER@obtenant_sit#OB_CLUSTER'), { user: 'OB_USER', tenant: 'obtenant_sit', cluster: 'OB_CLUSTER' })
  assert.deepEqual(splitUser('OB_USER'), { user: 'OB_USER', tenant: '', cluster: '' })
})

test('CSV escapes quotes, multiline text and spreadsheet formulas', () => {
  assert.equal(oceanBaseCsvCell('a"b\nc'), '"a""b\nc"')
  assert.equal(oceanBaseCsvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"')
  assert.equal(oceanBaseCsvCell('  =1+1'), '"\'  =1+1"')
  assert.equal(oceanBaseCsvCell('\n=1+1'), '"\'\n=1+1"')
  assert.equal(oceanBaseCsvCell({ binaryHex: '00ff', truncated: true }), '"0x00ff…"')
  assert.equal(oceanBaseCsvCell(null), '"NULL"')
})

/** 公共测试台：一份可编程的假服务端 + 常用操作方法。 */
function harness({ columns, records, key = { mode: 'primary', columns: ['ID'], label: '主键' }, tableType = 'TABLE' }) {
  const dom = new JSDOM('<main id="root"></main>', { url: 'http://localhost/wangtie-os/' })
  const originalGlobals = { window: globalThis.window, document: globalThis.document, FormData: globalThis.FormData, fetch: globalThis.fetch }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData })
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  const calls = []
  const errors = []
  dom.window.addEventListener('error', event => errors.push(event.error ?? event.message))
  const state = { records, conflict: false, failRefresh: false, uncertainWrite: false, holdRows: false, releaseRows: null }
  const savedProfiles = []                                    // 仿真服务端连接档案（不含密码）
  const profileErrors = []                                    // 记录服务端收到的档案请求，便于断言
  globalThis.fetch = async (url, options) => {
    const action = url.split('/').at(-1)
    const body = JSON.parse(options.body)
    calls.push({ action, body })
    let data
    switch (action) {
      case 'profiles': {
        profileErrors.push(body)
        if (body.op === 'list') data = { profiles: [...savedProfiles] }
        else if (body.op === 'save') {
          if (body.profile && 'password' in body.profile && body.profile.password) profileErrors.push({ warning: 'password-must-not-be-sent' })
          const profile = { id: `${body.profile.host}/${body.profile.tenant}`, name: body.profile.name || '未命名', env: body.profile.env || '', host: body.profile.host, port: body.profile.port, cluster: body.profile.cluster || '', tenant: body.profile.tenant, user: body.profile.user, database: body.profile.database || '', tls: body.profile.tls === true, updatedAt: 'now' }
          const index = savedProfiles.findIndex(item => item.id === profile.id)
          if (index >= 0) savedProfiles[index] = profile; else savedProfiles.unshift(profile)
          data = { profile }
        } else if (body.op === 'remove') {
          const index = savedProfiles.findIndex(item => item.id === body.profile.id)
          if (index >= 0) savedProfiles.splice(index, 1)
          data = { removed: index >= 0, id: body.profile.id }
        } else data = { profiles: [] }
        break
      }
      case 'connect': data = { info: { currentUser: 'TESTER', dbName: 'OBTEST', version: 'OceanBase_CE 4.3.0.0 (Oracle)' }, schemas: ['SYS', 'SANDBOX'], mode: 'oracle', tenant: 'obtenant' }; break
      case 'tables': data = { tables: [{ name: 'CUSTOMERS', type: tableType, comment: '客户表' }, { name: 'CUSTOMER_VIEW', type: 'VIEW', comment: '' }] }; break
      case 'rows':
        if (state.holdRows) { state.holdRows = false; await new Promise(resolve => { state.releaseRows = resolve }) }
        if (state.failRefresh) { state.failRefresh = false; throw new Error('Refresh failed') }
        data = { columns, rows: structuredClone(state.records), offset: body.offset, limit: body.limit, hasMore: false, permissions: { insert: tableType === 'TABLE', edit: tableType === 'TABLE' }, key, tableType }; break
      case 'insert': state.records.push({ ID: '9007199254740994', NOTE: null, ...body.values }); data = { affectedRows: 1 }; break
      case 'update':
        if (state.uncertainWrite) { state.uncertainWrite = false; throw new TypeError('Network interrupted') }
        if (state.conflict) return { ok: false, json: async () => ({ error: '记录已被修改或删除，请刷新数据后重试' }) }
        state.records = state.records.map(item => (item.ID ?? item[key.columns[0]]) === (body.key.ID ?? body.key[key.columns[0]]) ? { ...item, ...body.values } : item)
        data = { affectedRows: 1 }; break
      case 'delete': state.records = state.records.filter(item => (item.ID ?? item[key.columns[0]]) !== (body.key.ID ?? body.key[key.columns[0]])); data = { affectedRows: 1 }; break
      default: throw new Error(`Unexpected action: ${action}`)
    }
    return { ok: true, json: async () => structuredClone(data) }
  }
  const root = document.querySelector('#root')
  const $ = selector => root.querySelector(selector)
  const change = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new window.Event('change', { bubbles: true })) }
  const submit = selector => $(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  const idle = async () => {
    const deadline = Date.now() + 2000
    while (root.getAttribute('aria-busy') === 'true') { if (Date.now() > deadline) throw new Error('UI stuck busy'); await setImmediate() }
    await setImmediate()
  }
  const connect = async () => {
    $('[name="host"]').value = '10.0.0.10'; $('[name="port"]').value = '2883'
    $('[name="cluster"]').value = 'OB_CLUSTER'; $('[name="tenant"]').value = 'obtenant_sit'
    $('[name="user"]').value = 'OB_USER'; $('[name="password"]').value = 'test-only-password'
    submit('#ob-connect-form'); await idle()
  }
  const close = () => { Object.assign(globalThis, originalGlobals); dom.window.close() }
  return { root, $, change, submit, idle, connect, calls, state, errors, close, key }
}

const ORACLE_COLUMNS = [
  { name: 'ID', type: 'NUMBER(19)', dataType: 'NUMBER', nullable: false, defaultValue: null, primary: true, identity: false, virtual: false, binary: false, lob: false, comment: '主键' },
  { name: 'NAME', type: 'VARCHAR2(60)', dataType: 'VARCHAR2', nullable: false, defaultValue: null, primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '客户名称' },
  { name: 'NOTE', type: 'VARCHAR2(200)', dataType: 'VARCHAR2', nullable: true, defaultValue: null, primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '' },
  { name: 'CREATED_AT', type: 'DATE', dataType: 'DATE', nullable: true, defaultValue: 'SYSDATE', primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '' },
  { name: 'SEQ', type: 'NUMBER(19)', dataType: 'NUMBER', nullable: false, defaultValue: null, primary: false, identity: true, virtual: false, binary: false, lob: false, comment: '标识列' },
]

test('Oracle-mode UI: smart parse fills the OceanBase client fields, and a missing tenant is caught early', async () => {
  const kit = harness({ columns: ORACLE_COLUMNS, records: [] })
  const { $, submit, idle, calls, errors, close } = kit
  try {
    renderOceanBase(kit.root)
    // 粘一行 OceanBase 客户端的连接信息 → 自动拆成 主机/端口/用户名/租户/集群/密码
    $('#ob-parse-text').value = "obclient -h 10.0.0.10 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'0bPassw0rd'"
    $('#ob-parse').click()
    assert.equal($('[name="host"]').value, '10.0.0.10')
    assert.equal($('[name="port"]').value, '2883')
    assert.equal($('[name="user"]').value, 'OB_USER')
    assert.equal($('[name="tenant"]').value, 'obtenant_sit')
    assert.equal($('[name="cluster"]').value, 'OB_CLUSTER')
    assert.equal($('[name="password"]').value, '0bPassw0rd')
    assert.match($('#ob-message').textContent, /已解析/)

    // 解析结果可以直接连（payload 与手填一致）
    submit('#ob-connect-form'); await idle()
    const sent = calls.at(-1).body.connection
    assert.deepEqual([sent.user, sent.tenant, sent.cluster, sent.port], ['OB_USER', 'obtenant_sit', 'OB_CLUSTER', 2883])

    // 没填租户、用户名里也没有 @ → 本地就拦住，不发请求
    $('[name="tenant"]').value = ''; $('[name="user"]').value = 'OB_USER'
    const before = calls.length
    submit('#ob-connect-form'); await idle()
    assert.equal(calls.length, before, 'must not call the server with an un-routable username')
    assert.match($('#ob-message').textContent, /租户名/)
    assert.deepEqual(errors.map(String), [])
    // 退出时断开：本页面在「切换模块后再回来」时会复用连接（产品行为），
    // 测试之间必须清掉，否则下一个用例会带着已连接状态开始。
    $('#ob-disconnect').click()
  } finally { close() }
})

test('Oracle-mode UI: connect, query, filter, insert, update, conflict, delete, disconnect', async () => {
  const kit = harness({ columns: ORACLE_COLUMNS, records: [{ ID: '9007199254740993', NAME: '<img src=x onerror=alert(1)>', NOTE: null, CREATED_AT: '2026-01-02 03:04:05', SEQ: '1' }] })
  const { root, $, change, submit, idle, connect, calls, state, errors, close } = kit
  try {
    const leavePage = renderOceanBase(root)
    assert.equal($('#ob-workspace').hidden, true)

    await connect()
    assert.equal($('#ob-workspace').hidden, false)
    const sent = calls.at(-1).body.connection
    assert.equal(sent.mode, 'oracle', 'Oracle mode must be the only mode sent to the server')
    // 页面按 OceanBase 客户端的字段收集参数，拼接交给服务端
    assert.deepEqual(
      { host: sent.host, port: sent.port, cluster: sent.cluster, tenant: sent.tenant, user: sent.user, database: sent.database, tls: sent.tls },
      { host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit', user: 'OB_USER', database: '', tls: false },
    )
    assert.equal(sent.database, '', '默认模式留空，由服务端按账号同名模式处理')
    assert.equal(calls.at(-1).body.schema, 'SANDBOX', 'system schemas must not be selected by default')
    // 状态栏必须显示「连的是 OceanBase 的哪个租户」，避免与 Oracle 数据库混淆
    assert.match($('#ob-status').textContent, /租户 obtenant · TESTER/)
    assert.match($('#ob-status').textContent, /OceanBase Oracle 兼容模式 · MySQL 线协议/)
    assert.match($('#ob-grid').textContent, /9007199254740993/)
    assert.equal($('#ob-grid img'), null, 'database text must be escaped')
    assert.equal($('#ob-add').disabled, false)
    assert.match($('#ob-table-note').textContent, /主键（ID）/, 'editing is explained by the key strategy')
    assert.equal(window.localStorage.length, 0, 'credentials must never be persisted by this page')

    change('#ob-column', 'NAME'); change('#ob-op', 'contains'); $('#ob-value').value = '客户'
    submit('#ob-filter'); await idle()
    assert.deepEqual(calls.at(-1).body.filter, { column: 'NAME', op: 'contains', value: '客户' })
    $('#ob-reset').click(); await idle()

    $('#ob-add').click()
    assert.equal($('#ob-editor').open, true)
    assert.match($('#ob-editor').textContent, /空字符串按 NULL 存储/)
    assert.equal($('[data-field="4"] select').disabled, true, 'identity column is not editable')
    // 无默认值的 NUMBER 主键需要手工填写（Oracle 常见：应用侧赋值或序列）
    $('#ob-field-0').value = '9007199254740994'
    change('[data-field="1"] select', 'value'); $('#ob-field-1').value = '新客户'
    change('[data-field="2"] select', 'null')
    submit('#ob-editor-form'); await idle()
    assert.equal($('#ob-editor').open, false)
    assert.deepEqual(calls.find(call => call.action === 'insert').body.values, { ID: '9007199254740994', NAME: '新客户', NOTE: null })
    assert.match($('#ob-grid').textContent, /新客户/)

    $('[data-edit="1"]').click()
    assert.equal($('#ob-field-0').disabled, true, 'primary key is read-only while editing')
    $('#ob-field-1').value = '修改后客户'
    submit('#ob-editor-form'); await idle()
    assert.match($('#ob-grid').textContent, /修改后客户/)
    assert.deepEqual(calls.find(call => call.action === 'update').body.key, { ID: '9007199254740994' })

    state.conflict = true
    $('[data-edit="1"]').click(); $('#ob-field-1').value = '并发修改'
    submit('#ob-editor-form'); await idle()
    assert.equal($('#ob-editor').open, true)
    assert.match($('#ob-editor-error').textContent, /记录已被修改/)
    $('#ob-cancel').click(); state.conflict = false

    $('[data-delete="1"]').click()
    assert.equal($('#ob-delete-dialog').open, true)
    assert.match($('#ob-delete-key').textContent, /9007199254740994/)
    assert.equal(calls.some(call => call.action === 'delete'), false, 'opening the confirmation must not delete')
    $('#ob-delete-confirm').click(); await idle()
    assert.equal($('#ob-delete-dialog').open, false)
    assert.equal(calls.find(call => call.action === 'delete').body.confirm, true)

    $('#ob-add').click(); change('[data-field="1"] select', 'value'); $('#ob-field-1').value = '保存后刷新失败'
    state.failRefresh = true
    submit('#ob-editor-form'); await idle()
    assert.equal($('#ob-editor').open, false)
    assert.match($('#ob-message').textContent, /保存已成功，但刷新失败/)
    assert.equal($('#ob-add').disabled, true)
    $('#ob-refresh').click(); await idle()
    assert.match($('#ob-grid').textContent, /保存后刷新失败/)

    // 失败的查询不得让旧行继续可编辑。
    state.failRefresh = true
    submit('#ob-filter'); await idle()
    assert.equal($('#ob-add').disabled, true)
    assert.equal($('#ob-grid [data-edit]'), null)
    $('#ob-refresh').click(); await idle()

    // 请求进行中不允许切走菜单（共享状态竞态）。
    state.holdRows = true
    submit('#ob-filter')
    assert.equal(leavePage(), false)
    state.releaseRows(); await idle()
    assert.equal(leavePage(), true)

    // 中断的写入结果未知：关闭编辑框并要求重新查询。
    $('[data-edit="0"]').click(); $('#ob-field-1').value = '不确定的网络写入'
    state.uncertainWrite = true
    submit('#ob-editor-form'); await idle()
    assert.equal($('#ob-editor').open, false)
    assert.match($('#ob-message').textContent, /写入结果尚未确认/)
    assert.equal($('#ob-add').disabled, true)
    $('#ob-refresh').click(); await idle()

    // 改了连接参数就不能继续用旧连接。
    $('[name="host"]').value = 'new-host'
    $('[name="host"]').dispatchEvent(new window.Event('input', { bubbles: true }))
    assert.equal($('#ob-workspace').hidden, true)
    assert.match($('#ob-status').textContent, /重新连接/)
    $('[name="host"]').value = '10.0.0.9'
    submit('#ob-connect-form'); await idle()

    $('#ob-disconnect').click()
    assert.equal($('#ob-workspace').hidden, true)
    assert.equal($('[name="password"]').value, '')
    assert.equal(window.localStorage.length, 0)

    // 连接请求进行中重复提交不能抛异常（禁用控件会让 FormData 取不到字段）。
    await connect()
    submit('#ob-connect-form')
    submit('#ob-connect-form')
    await idle()
    assert.deepEqual(errors.map(String), [], 'no uncaught UI error is allowed')
  } finally { close() }
})

test('Oracle-mode UI: multiple databases are saved with environment aliases and switchable', async () => {
  const kit = harness({ columns: ORACLE_COLUMNS, records: [{ ID: '1', NAME: 'x', NOTE: null, CREATED_AT: null, SEQ: '1' }] })
  const { $, submit, idle, calls, close } = kit
  try {
    renderOceanBase(kit.root)
    await idle()
    const form = () => $('#ob-connect-form').elements

    // ① 保存第一套：测试环境
    form().profileName.value = '票据库 · 测试'; form().env.value = '测试'
    form().host.value = '10.0.0.10'; form().port.value = '2883'; form().cluster.value = 'OB_CLUSTER'
    form().tenant.value = 'obtenant_sit'; form().user.value = 'OB_USER'; form().password.value = 'pwd-test'
    $('#ob-profile-save').click(); await idle()
    assert.match($('#ob-profile-note').textContent, /共 1 套连接/)

    // ② 保存第二套：生产环境（不同地址/租户）
    form().profileName.value = '票据库 · 生产'; form().env.value = '生产'
    form().host.value = '10.9.9.9'; form().tenant.value = 'bps_prod'
    $('#ob-profile-save').click(); await idle()
    assert.match($('#ob-profile-note').textContent, /共 2 套连接/)
    const options = [...$('#ob-profile').options].map(option => option.textContent)
    assert.ok(options.some(text => text.includes('[测试]') && text.includes('票据库 · 测试')), `下拉应展示环境别名与名称：${options.join(' | ')}`)
    assert.ok(options.some(text => text.includes('[生产]') && text.includes('票据库 · 生产')))

    // ③ 切换到测试环境：点一下下拉里的那一项就回填表单
    const testOption = [...$('#ob-profile').options].find(option => option.textContent.includes('[测试]'))
    $('#ob-profile').value = testOption.value
    $('#ob-profile').dispatchEvent(new window.Event('change', { bubbles: true }))
    assert.equal(form().host.value, '10.0.0.10')
    assert.equal(form().tenant.value, 'obtenant_sit')
    assert.equal(form().env.value, '测试')

    // ④ 用该档案连接：payload 里带上环境别名，状态栏显示环境徽标
    $('#ob-profile-use').click()
    submit('#ob-connect-form'); await idle()
    const sent = calls.filter(call => call.action === 'connect').at(-1).body.connection
    assert.equal(sent.env, '测试')
    assert.equal(sent.profileName, '票据库 · 测试')
    assert.equal(sent.tenant, 'obtenant_sit')
    assert.match($('#ob-status').textContent, /票据库 · 测试/)
    assert.match($('#ob-status').textContent, /测试/)

    // ⑤ 密码绝不发给服务端的档案接口（只有连接请求里才有密码）
    const savedToServer = calls.filter(call => call.action === 'profiles' && call.body.op === 'save').map(call => call.body.profile)
    assert.ok(savedToServer.length >= 2)
    assert.ok(savedToServer.every(profile => !profile.password || profile.password === ''), '档案接口不得携带密码')

    // ⑥ 删除生产环境档案
    const prodOption = [...$('#ob-profile').options].find(option => option.textContent.includes('[生产]'))
    $('#ob-profile').value = prodOption.value
    window.confirm = () => true
    $('#ob-profile-remove').click(); await idle()
    assert.match($('#ob-profile-note').textContent, /共 1 套连接/)
  } finally { close() }
})

test('Oracle-mode UI: schema select keeps its options and the field structure opens in a dialog', async () => {
  // 回归：曾经把「模式下拉框」和「字段结构容器」用了同一个 id，导致下拉框被写成 table、
  // 结构视图永远为空——两个症状一起出现。这里锁住修复。
  const kit = harness({ columns: ORACLE_COLUMNS, records: [{ ID: '1', NAME: 'x', NOTE: null, CREATED_AT: null, SEQ: '1' }] })
  const { $, idle, connect, close } = kit
  try {
    renderOceanBase(kit.root)
    await connect()
    const select = $('#ob-schema')
    assert.equal(select.tagName, 'SELECT')
    assert.equal(select.options.length, 2, '模式下拉必须有选项（SYS + SANDBOX）')
    assert.deepEqual([...select.options].map(option => option.value), ['SYS', 'SANDBOX'])
    assert.equal(select.value, 'SANDBOX')
    assert.equal(select.textContent.includes('OB_USER'), false, '下拉框里不能混入字段结构表格')

    assert.equal($('#ob-structure-dialog').open, false)
    $('#ob-structure').click()
    assert.equal($('#ob-structure-dialog').open, true, '点「查看字段结构」必须弹出窗口')
    assert.match($('#ob-structure-table').textContent, /SANDBOX\.CUSTOMERS/)
    const body = $('#ob-structure-body').textContent
    for (const name of ['ID', 'NAME', 'CREATED_AT']) assert.ok(body.includes(name), `结构里应包含字段 ${name}`)
    assert.ok(body.includes('主键'), '结构里应标注主键')
    $('#ob-structure-close').click()
    assert.equal($('#ob-structure-dialog').open, false)
  } finally { close() }
})

test('Oracle-mode UI: heap table without a primary key is edited through ROWID', async () => {
  const columns = [
    { name: 'NAME', type: 'VARCHAR2(20)', dataType: 'VARCHAR2', nullable: true, defaultValue: null, primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '' },
    { name: 'wt_rowid', type: '', dataType: '', nullable: true, defaultValue: null, primary: false, identity: false, virtual: false, binary: false, lob: false, comment: '' },
  ]
  const kit = harness({ columns: columns.slice(0, 1), records: [{ NAME: '无主键行', wt_rowid: 'AAAQ9kAAMAAACX1AAA' }], key: { mode: 'rowid', columns: ['wt_rowid'], label: 'ROWID' } })
  const { $, submit, idle, connect, calls, close } = kit
  try {
    renderOceanBase(kit.root)
    await connect()
    assert.match($('#ob-table-note').textContent, /ROWID/)

    $('[data-edit="0"]').click()
    $('#ob-field-0').value = '改过的无主键行'
    submit('#ob-editor-form'); await idle()
    assert.deepEqual(calls.find(call => call.action === 'update').body.key, { wt_rowid: 'AAAQ9kAAMAAACX1AAA' })
    assert.deepEqual(calls.find(call => call.action === 'update').body.values, { NAME: '改过的无主键行' })

    $('[data-delete="0"]').click()
    assert.match($('#ob-delete-key').textContent, /AAAQ9kAAMAAACX1AAA/)
    $('#ob-delete-confirm').click(); await idle()
    assert.deepEqual(calls.find(call => call.action === 'delete').body.key, { wt_rowid: 'AAAQ9kAAMAAACX1AAA' })
  } finally { close() }
})

test('Oracle-mode UI: views are read-only, and a view without a key explains why', async () => {
  const kit = harness({ columns: [ORACLE_COLUMNS[0], ORACLE_COLUMNS[1]], records: [{ ID: '1', NAME: 'v' }], key: { mode: 'none', columns: [], label: '无' }, tableType: 'VIEW' })
  const { $, idle, connect, close } = kit
  try {
    renderOceanBase(kit.root)
    await connect()
    assert.match($('#ob-table-note').textContent, /视图只提供查询/)
    assert.equal($('#ob-add').disabled, true)
    assert.equal($('#ob-grid [data-edit]').disabled, true)
  } finally { close() }
})

test('DDL comparison page: reads environments from config and renders the diff', async () => {
  const dom = new JSDOM('<main id="root"></main>', { url: 'http://localhost/wangtie-os/' })
  const originalGlobals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document })
  const calls = []
  globalThis.fetch = async (url, options) => {
    const action = url.split('/').at(-1)
    const body = JSON.parse(options.body)
    calls.push({ action, body })
    if (action === 'ddl-environments') {
      return {
        ok: true,
        json: async () => ({
          path: '/srv/wangtie-os/config/ddl-environments.json', updatedAt: new Date().toISOString(),
          environments: [
            { key: 'SIT', name: '示例环境-sit', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_sit', user: 'OB_USER', schema: 'OB_USER', enabled: true, hasPassword: true },
            { key: 'UAT', name: '示例环境-uat', host: '10.0.0.10', port: 2883, cluster: 'OB_CLUSTER', tenant: 'obtenant_uat', user: 'OB_USER', schema: 'OB_USER', enabled: true, hasPassword: true },
          ],
        }),
      }
    }
    if (action === 'ddl-test') {
      return {
        ok: true,
        json: async () => ({
          path: '/srv/wangtie-os/config/ddl-environments.json',
          environments: [
            { key: 'SIT', name: '示例环境-sit', schema: 'OB_USER', ok: true, objectCount: 128 },
            { key: 'UAT', name: '示例环境-uat', schema: 'OB_USER_UAT', ok: false, error: '认证失败：账号、租户或密码不正确', code: 'ER_ACCESS_DENIED_ERROR' },
          ],
        }),
      }
    }
    if (action === 'ddl-compare') {
      return {
        ok: true,
        json: async () => ({
          left: { key: 'SIT', name: '示例环境-sit', schema: 'OB_USER', host: '10.0.0.10', objects: 2 },
          right: { key: 'UAT', name: '示例环境-uat', schema: 'OB_USER', host: '10.0.0.10', objects: 2 },
          filter: '', warnings: [],
          summary: { leftCount: 2, rightCount: 2, onlyLeft: 1, onlyRight: 0, changed: 1, identical: 0 },
          diffs: [
            { name: 'BILL_MAIN', type: 'TABLE', kind: 'changed', identical: false, lines: ['+ 字段 NEW_FLAG VARCHAR2(1)（右侧新增）', '- 字段 OLD_FLAG VARCHAR2(1)（右侧缺失）'], ddlLeft: 'CREATE TABLE "OB_USER"."BILL_MAIN" (\n  "ID" NUMBER(19) NOT NULL\n);', ddlRight: 'CREATE TABLE "OB_USER"."BILL_MAIN" (\n  "ID" NUMBER(19) NOT NULL,\n  "NEW_FLAG" VARCHAR2(1)\n);' },
            { name: 'ONLY_SIT', type: 'TABLE', kind: 'only-left', identical: false, lines: ['只在左侧（SIT（示例环境-sit））存在，右侧没有这个对象'], ddlLeft: 'CREATE TABLE "OB_USER"."ONLY_SIT" (\n  "A" NUMBER(10)\n);', ddlRight: '' },
          ],
        }),
      }
    }
    return { ok: false, json: async () => ({ error: `unexpected ${action}` }) }
  }
  try {
    const { renderDdlCompare } = await import('../ui/ddl-compare.js')
    const root = document.querySelector('#root')
    renderDdlCompare(root)
    await new Promise(resolve => setTimeout(resolve, 20))

    // 环境来自配置文件，且页面上不出现密码
    const text = root.textContent
    assert.match(text, /config\/ddl-environments\.json/, '要显示配置来源路径')
    assert.match(text, /示例环境-sit/)
    assert.match(text, /示例环境-uat/)
    assert.match(text, /已配置（不显示）/)
    assert.doesNotMatch(text, /test-only-password/, '页面不得出现密码')

    // 测试两套环境：失败的一侧要标出来并说明原因
    root.querySelector('#dc-test').click()
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.match(root.textContent, /✓ 连接正常 · 128 个对象/)
    assert.match(root.textContent, /✗ 连接失败/)
    assert.match(root.textContent, /认证失败：账号、租户或密码不正确/)
    assert.match(root.querySelector('#dc-message').textContent, /有 1 套环境连不上：UAT/)

    // 触发比较
    root.querySelector('#dc-filter').value = 'BILL'
    root.querySelector('#dc-run').click()
    await new Promise(resolve => setTimeout(resolve, 30))
    const compare = calls.find(call => call.action === 'ddl-compare')
    assert.deepEqual({ filter: compare.body.filter, includeViews: compare.body.includeViews }, { filter: 'BILL', includeViews: true })

    const after = root.textContent
    assert.match(after, /只在左侧\s*1/, '概览要显示仅左侧数量')
    assert.match(after, /结构不同\s*1/)
    assert.match(after, /BILL_MAIN/)
    assert.match(after, /\+ 字段 NEW_FLAG/)
    assert.match(after, /- 字段 OLD_FLAG/)
    assert.match(after, /CREATE TABLE "OB_USER"\."BILL_MAIN"/, '要给出左右 DDL 对照')
    assert.equal(root.querySelector('#dc-export').disabled, false, '差异导出应可用')
  } finally {
    Object.assign(globalThis, originalGlobals)
    dom.window.close()
  }
})
