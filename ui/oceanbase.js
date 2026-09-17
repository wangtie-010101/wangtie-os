/**
 * 王铁 OS — 「OceanBase 管理」前端（OceanBase Oracle 兼容模式租户）。
 * 服务端契约见 src/oceanbase-routes.ts：connect / tables / rows / insert / update / delete。
 *
 * 关键事实：Oracle **兼容模式**指的是租户的 SQL 方言，线协议仍是 **MySQL 协议**
 * （OceanBase Connector/J 即 MariaDB Connector/J 分支）；ODP 2883 不回应 Oracle 协议（TNS）。
 * 因此服务端用 mysql2 连接、SQL 全写 Oracle 方言，页面上的语义仍然是 Oracle 的：
 *   - 账号要写成 用户名@租户名#集群名，默认端口 ODP 2883；
 *   - 一级对象叫「模式（Schema）」，不是「数据库」；
 *   - 没有主键的堆表用 ROWID 定位记录；视图只读；
 *   - 空字符串等同于 NULL，日期按 YYYY-MM-DD [HH24:MI:SS] 填写。
 */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const memory = { connection: null, schemas: [], schema: '', table: '' }
const ROWID_FIELD = 'wt_rowid'
/** 系统模式默认不选：正常业务操作不会碰到它们。 */
const SYSTEM_SCHEMAS = ['SYS', 'SYSTEM', 'LBACSYS', 'ORAAUDITOR', 'OCEANBASE', 'PUBLIC', 'MDSYS', 'CTXSYS', 'XDB', '__RECYCLEBIN']
const display = value => value === null ? 'NULL'
  : value === undefined ? ''
    : typeof value === 'object' ? (value.binaryHex !== undefined ? `0x${value.binaryHex}${value.truncated ? '…' : ''}` : JSON.stringify(value))
      : String(value)

export function oceanBaseCsvCell(value) {
  const text = display(value)
  return '"' + (/^\s*[=+@-]|^[\t\r\n]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'
}

/** 把数据库用户名拆成 OceanBase 客户端那样的三段：用户名 / 租户名 / 集群名。 */
export function splitUser(input) {
  const [bare = '', rest = ''] = String(input ?? '').split('@')
  const [tenant = '', cluster = ''] = rest.split('#')
  return { user: bare.trim(), tenant: tenant.trim(), cluster: cluster.trim() }
}

/**
 * 智能解析一段连接信息（obclient / mysql 命令行或连接串），只返回解析到的字段，
 * 方便直接把 OceanBase 客户端里的连接信息粘进来。
 * 例：obclient -h 10.210.2.51 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'0bPassw0rd'
 */
export function parseConnectString(text) {
  const raw = String(text ?? '')
  const pick = patterns => {
    for (const pattern of patterns) {
      const match = pattern.exec(raw)
      if (match && match[1] !== undefined && match[1] !== '') return match[1]
    }
    return ''
  }
  const host = pick([/(?:^|\s)-h\s*['"]?([^\s'"]+)/, /--host[=\s]+['"]?([^\s'"]+)/])
  const port = pick([/(?:^|\s)-P\s*(\d{1,5})/, /--port[=\s]+(\d{1,5})/])
  const account = pick([/(?:^|\s)-u\s*([^\s'"]+)/, /(?:^|\s)-u([^\s'"]+)/, /--user[=\s]+([^\s'"]+)/])
  const password = pick([/-p'([^']*)'/, /-p"([^"]*)"/, /(?:^|\s)-p([^\s'"]+)/, /--password[=\s]+['"]?([^\s'"]+)/])
  // 没有任何参数时，退一步认 host:port 或 user/password@host:port 这种连接串写法
  const bare = host ? null : /([\w.-]+):(\d{1,5})/.exec(raw)
  const found = {}
  if (host) found.host = host
  else if (bare) found.host = bare[1]
  const resolvedPort = port || (bare ? bare[2] : '')
  if (resolvedPort) found.port = resolvedPort
  if (account) Object.assign(found, splitUser(account))
  if (password) found.password = password
  return found
}

export function renderOceanBase(el) {
  const cached = memory.connection || { mode: 'oracle', host: '', port: 2883, cluster: '', tenant: '', database: '', user: '', password: '', tls: false, profileName: '', env: '', remember: false }
  let connected = Boolean(memory.connection)
  let tables = [], result = null, offset = 0, busy = false
  let activeFilter = null, activeSort = '', activeDirection = 'asc', activeLimit = 50
  el.innerHTML = `
    <div class="section-title">OceanBase 管理 <span class="muted">Oracle 兼容模式 · 直连数据字典</span></div>
    <div class="card">
      <h3>数据库连接 <span class="muted" id="ob-status">${connected ? '已连接 · 密码仅保留在本次页面会话' : '连接后浏览模式、表结构并管理表数据'}</span></h3>
      <div class="ob-profiles">
        <div class="row ob-toolbar">
          <label>连接档案<select id="ob-profile" aria-label="连接档案"><option value="">— 新建连接 —</option></select></label>
          <button class="btn" type="button" id="ob-profile-use" title="用选中的档案填充下方连接信息">📥 载入</button>
          <button class="btn primary" type="button" id="ob-profile-save" title="把当前填写的连接保存为档案（服务端不保存密码）">💾 保存为档案</button>
          <button class="btn danger" type="button" id="ob-profile-remove" title="删除选中的档案">🗑 删除</button>
          <span class="muted" id="ob-profile-note"></span>
        </div>
        <form id="ob-connect-form" class="ob-connection" autocomplete="off">
        <div class="ob-grid2">
          <label>档案名称<input type="text" name="profileName" value="${esc(cached.profileName || '')}" placeholder="如 票据库 · 测试"></label>
          <label>环境别名<input type="text" name="env" id="ob-env" value="${esc(cached.env || '')}" placeholder="测试 / 准生产 / 生产" list="ob-env-list"><datalist id="ob-env-list"><option value="测试"></option><option value="准生产"></option><option value="生产"></option></datalist></label>
        </div>
        <div class="ob-parse">
          <label for="ob-parse-text">智能解析（可选）<small>粘贴 OceanBase 客户端或 obclient 的连接信息，自动填下面的字段</small></label>
          <div class="row">
            <input type="text" id="ob-parse-text" placeholder="obclient -h 10.210.2.51 -P2883 -uOB_USER@obtenant_sit#OB_CLUSTER -p'密码'">
            <button class="btn" type="button" id="ob-parse">智能解析</button>
          </div>
        </div>
        <div class="muted ob-hint">连接地址</div>
        <div class="ob-grid2">
          <label>主机 IP/域名<input type="text" name="host" value="${esc(cached.host)}" required placeholder="数据库 IP 或域名"></label>
          <label>端口<input name="port" type="number" min="1" max="65535" value="${esc(cached.port)}" required></label>
          <label>集群名（可选）<input type="text" name="cluster" value="${esc(cached.cluster || '')}" placeholder="如 OB_CLUSTER"></label>
          <label>租户名<input type="text" name="tenant" value="${esc(cached.tenant || '')}" placeholder="如 obtenant_sit（Oracle 模式的服务名就是它）"></label>
        </div>
        <div class="muted ob-hint">数据库账号</div>
        <div class="ob-grid2">
          <label>数据库用户名<input type="text" name="user" value="${esc(cached.user)}" required placeholder="如 OB_USER"></label>
          <label>数据库密码<input name="password" type="password" value="${esc(cached.password)}" autocomplete="new-password" placeholder="请输入密码"></label>
        </div>
        <label class="ob-check"><input name="remember" type="checkbox" ${cached.remember ? 'checked' : ''}>在本浏览器记住密码（localStorage，仅本机）</label>
        <details class="ob-advanced">
          <summary>高级设置</summary>
          <div class="ob-grid2">
            <label>默认模式（可选）<input type="text" name="database" value="${esc(cached.database || '')}" placeholder="留空即用账号同名模式"></label>
            <label class="ob-check"><input name="tls" type="checkbox" ${cached.tls ? 'checked' : ''}>使用 TLS/SSL</label>
          </div>
          <div class="muted ob-hint">「默认模式」等价于 JDBC 连接串里 <code>host:port/</code> 后面那一段（通常就是用户名）。ODP 的 2883 默认明文，不要勾选 TLS；只有服务端确实开了 TLS 才勾。</div>
        </details>
        <div class="row"><button class="btn primary" type="submit">连接数据库</button><button class="btn" type="button" id="ob-disconnect">断开</button></div>
      </form>
      <div class="muted ob-hint">连的是 <b>OceanBase 的 Oracle 兼容模式租户</b>：服务端把「用户名 + 租户名 + 集群名」拼成 <code>用户名@租户名#集群名</code>，经 MySQL 线协议访问（与 OceanBase Connector/J 一致），SQL 全部使用 Oracle 方言（数据字典、ROWNUM、TO_DATE、ROWID）。</div>
    </div>
    <div id="ob-message" role="status" aria-live="polite"></div>
    <div id="ob-workspace" ${connected ? '' : 'hidden'}>
      <div class="card">
        <div class="row ob-toolbar">
          <label>模式（Schema）<select id="ob-schema" aria-label="模式"></select></label>
          <label>数据表 <select id="ob-table" aria-label="数据表"></select></label>
          <button class="btn" id="ob-refresh">刷新表列表</button>
          <button class="btn" id="ob-verify" title="逐条检查数据字典与查询链路，定位是哪个版本的字典缺了什么">🩺 自检</button>
          <button class="btn" id="ob-structure" title="查看当前表的字段结构（类型/可空/默认值/主键/注释）">🧬 查看字段结构</button>
          <button class="btn primary" id="ob-add">新增记录</button>
          <button class="btn" id="ob-export">导出当前页 CSV</button>
        </div>
        <form id="ob-filter" class="row ob-toolbar">
          <select id="ob-column" aria-label="筛选字段"><option value="">全部记录</option></select>
          <select id="ob-op" aria-label="筛选方式"><option value="contains">包含</option><option value="eq">等于</option><option value="ne">不等于</option><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option><option value="null">为 NULL</option><option value="notnull">不为 NULL</option></select>
          <input type="text" id="ob-value" aria-label="筛选值" placeholder="筛选值">
          <select id="ob-sort" aria-label="排序字段"><option value="">默认排序</option></select>
          <select id="ob-direction" aria-label="排序方向"><option value="asc">升序</option><option value="desc">降序</option></select>
          <select id="ob-limit" aria-label="每页条数"><option value="20">20 条/页</option><option value="50" selected>50 条/页</option><option value="100">100 条/页</option><option value="200">200 条/页</option></select>
          <button class="btn primary">查询</button><button class="btn" type="button" id="ob-reset">重置</button>
        </form>
        <div id="ob-table-note" class="muted ob-hint"></div>
      </div>
      <div class="card"><h3>表数据 <span id="ob-count" class="muted"></span></h3><div id="ob-grid" class="ob-grid"><div class="empty">请选择数据表</div></div>
        <div class="row ob-pagination"><button class="btn" id="ob-prev">上一页</button><span id="ob-page">第 1 页</span><button class="btn" id="ob-next">下一页</button></div>
      </div>
    </div>
    <dialog id="ob-structure-dialog" class="ob-editor"><h3>字段结构 · <span id="ob-structure-table"></span></h3><div id="ob-structure-body" class="ob-grid"></div><div class="row ob-toolbar"><button class="btn" id="ob-structure-close">关闭</button></div></dialog>
    <dialog id="ob-editor" class="ob-editor"><form id="ob-editor-form"><h3 id="ob-editor-title"></h3><div class="muted ob-hint">Oracle 模式下空字符串按 NULL 存储；日期填 YYYY-MM-DD，时间填 YYYY-MM-DD HH24:MI:SS。</div><div id="ob-fields"></div><div id="ob-editor-error" class="error-text" role="alert"></div><div class="row ob-toolbar"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" id="ob-cancel">取消</button></div></form></dialog>
    <dialog id="ob-delete-dialog" class="ob-editor"><h3>删除记录</h3><p>确认删除以下定位条件对应的记录？此操作将写入数据库。</p><pre id="ob-delete-key"></pre><div id="ob-delete-error" class="error-text" role="alert"></div><div class="row"><button class="btn danger" id="ob-delete-confirm">确认删除</button><button class="btn" id="ob-delete-cancel">取消</button></div></dialog>`
  const $ = id => el.querySelector('#' + id)
  const notify = (message = '', error = false) => { $('ob-message').textContent = message; $('ob-message').className = error ? 'error-text' : 'ob-success' }
  function updateControls() {
    $('ob-workspace').hidden = !connected
    const hasTable = Boolean(result)
    $('ob-prev').disabled = busy || !hasTable || offset === 0
    $('ob-next').disabled = busy || !result?.hasMore
    $('ob-add').disabled = busy || !hasTable || !result.permissions.insert
    $('ob-export').disabled = busy || !result?.rows.length
    $('ob-disconnect').disabled = busy || !connected
  }
  /* ---------------------------- 连接档案（多库切换） --------------------------- */
  const PASSWORD_KEY = 'wangtie-ob-passwords'      // 仅存本浏览器，服务端不落盘
  let profiles = []
  const readPasswords = () => { try { const raw = JSON.parse(localStorage.getItem(PASSWORD_KEY) ?? '{}'); return raw && typeof raw === 'object' ? raw : {} } catch { return {} } }
  const writePasswords = map => { try { localStorage.setItem(PASSWORD_KEY, JSON.stringify(map)) } catch { /* 忽略配额错误 */ } }
  const profileKey = profile => `${profile.host}:${profile.port}/${profile.user}@${profile.tenant}${profile.cluster ? '#' + profile.cluster : ''}`
  /** 勾了「记住密码」才把密码存到本浏览器；取消勾选会清掉已存的。 */
  function savePasswordIfRequested(connection) {
    if (!connection.remember || !connection.host || !connection.tenant) return
    const map = readPasswords()
    map[profileKey({ host: connection.host, port: connection.port, user: connection.user, tenant: connection.tenant, cluster: connection.cluster })] = connection.password
    writePasswords(map)
  }
  function fillProfile(profile) {
    const form = $('ob-connect-form').elements
    form.host.value = profile.host
    form.port.value = profile.port
    form.cluster.value = profile.cluster || ''
    form.tenant.value = profile.tenant || ''
    form.user.value = profile.user || ''
    form.database.value = profile.database || ''
    form.tls.checked = profile.tls === true
    form.profileName.value = profile.name || ''
    form.env.value = profile.env || ''
    const remembered = readPasswords()[profileKey(profile)]
    form.password.value = remembered ?? ''
    form.remember.checked = typeof remembered === 'string' && remembered !== ''
  }
  function renderProfiles(selectedId = '') {
    const select = $('ob-profile')
    select.innerHTML = '<option value="">— 新建连接 —</option>' + profiles.map(profile =>
      `<option value="${esc(profile.id)}"${profile.id === selectedId ? ' selected' : ''}>${esc([profile.env && `[${profile.env}]`, profile.name || profile.host, profile.host + ':' + profile.port].filter(Boolean).join(' · '))}</option>`).join('')
    $('ob-profile-note').textContent = profiles.length ? `共 ${profiles.length} 套连接；服务端只保存地址与账号，密码不落盘` : '还没有保存的连接档案'
  }
  const selectedProfile = () => profiles.find(profile => profile.id === $('ob-profile').value) ?? null
  async function loadProfiles(selectedId = '') {
    try {
      const data = await request('profiles', { op: 'list' })
      profiles = data.profiles || []
      renderProfiles(selectedId)
    } catch (error) {
      $('ob-profile-note').textContent = `读取连接档案失败：${error.message}`
    }
  }
  $('ob-profile-use').onclick = () => {
    const profile = selectedProfile()
    if (!profile) { notify('请先在下拉里选择一个连接档案', true); return }
    fillProfile(profile)
    notify(`已载入档案「${profile.name}」${profile.env ? `（${profile.env}）` : ''}${$('ob-connect-form').elements.password.value ? '' : '；未记住密码，请填写后连接'}`)
  }
  $('ob-profile').onchange = () => {
    const profile = selectedProfile()
    if (profile) fillProfile(profile)
  }
  $('ob-profile-save').onclick = () => void run(async () => {
    const form = $('ob-connect-form').elements
    const data = await request('profiles', {
      op: 'save',
      profile: {
        name: form.profileName.value, env: form.env.value, host: form.host.value, port: Number(form.port.value),
        cluster: form.cluster.value, tenant: form.tenant.value, user: form.user.value,
        database: form.database.value, tls: form.tls.checked,
        // 密码不发给档案接口：服务端只保存地址与账号，密码要么现填、要么只存在本浏览器
        password: '',
      },
    })
    await loadProfiles(data.profile?.id ?? '')
    form.profileName.value = data.profile?.name ?? ''
    if (form.remember.checked) savePasswordIfRequested({ ...memory.connection, ...{ host: form.host.value, port: Number(form.port.value), user: form.user.value, tenant: form.tenant.value, cluster: form.cluster.value, password: form.password.value, remember: true } })
    notify(`已保存档案「${data.profile?.name}」${form.remember.checked ? '（密码已存在本浏览器）' : '（服务端未保存密码）'}`)
  })
  $('ob-profile-remove').onclick = () => void run(async () => {
    const profile = selectedProfile()
    if (!profile) { notify('请先选择要删除的档案', true); return }
    if (!window.confirm(`确定删除档案「${profile.name}」（${profile.host}:${profile.port}）？`)) return
    await request('profiles', { op: 'remove', profile: { id: profile.id } })
    const map = readPasswords(); delete map[profileKey(profile)]; writePasswords(map)
    await loadProfiles()
    notify('档案已删除')
  })

  async function request(action, body = {}, connection = memory.connection) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 28_000)
    try {
      const base = new URL('./', import.meta.url).pathname.replace(/\/ui\/$/, '')
      const response = await fetch(`${base}/api/oceanbase/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ connection, schema: memory.schema, table: memory.table, ...body }),
      })
      let data
      try { data = await response.json() } catch { throw Object.assign(new Error('服务器返回了无效响应，请重新连接'), { uncertain: ['insert', 'update', 'delete'].includes(action) }) }
      if (!response.ok) throw Object.assign(new Error(data.error ? `${data.error}${data.code ? `（${data.code}）` : ''}` : '请求失败'), { uncertain: data.uncertain === true })
      return data
    } catch (error) {
      // AbortError = 浏览器端 28 秒超时；TypeError = 请求没能送到服务端（服务重启/网络中断）。
      if (error.name === 'AbortError') {
        throw Object.assign(new Error('请求超时（28 秒）：服务端没有及时响应。若卡在连接阶段，请检查主机、端口、租户名，并确认「使用 TLS」没有误勾。'), { uncertain: ['insert', 'update', 'delete'].includes(action) })
      }
      if (error instanceof TypeError) {
        throw Object.assign(new Error('请求没有送达服务端（服务可能正在重启，或浏览器与服务的连接中断），请重试。'), { uncertain: ['insert', 'update', 'delete'].includes(action) })
      }
      throw error
    } finally { clearTimeout(timer) }
  }
  async function run(task, errorTarget) {
    if (busy) return
    busy = true
    const controls = [...el.querySelectorAll('button, input, select, textarea')]
    const old = controls.map(control => control.disabled)
    controls.forEach(control => { control.disabled = true })
    el.setAttribute('aria-busy', 'true')
    notify()
    if (errorTarget) errorTarget.textContent = ''
    try { await task() } catch (error) {
      if (error.uncertain) {
        $('ob-editor').close(); $('ob-delete-dialog').close(); resetData()
        notify('写入结果尚未确认，请重新查询核实记录，勿重复提交。', true)
      } else if (errorTarget) errorTarget.textContent = error.message
      else notify(error.message, true)
    } finally {
      busy = false
      controls.forEach((control, i) => { control.disabled = old[i] })
      el.removeAttribute('aria-busy')
      updateControls()
    }
  }
  function resetData() {
    result = null; offset = 0
    $('ob-grid').innerHTML = '<div class="empty">请选择数据表</div>'
    $('ob-structure-body').innerHTML = ''; $('ob-count').textContent = ''; $('ob-table-note').textContent = ''
    $('ob-page').textContent = '第 1 页'
  }
  function fillSchemas() {
    $('ob-schema').innerHTML = memory.schemas.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')
    if (!memory.schemas.includes(memory.schema)) memory.schema = memory.schemas.find(name => !SYSTEM_SCHEMAS.includes(name.toUpperCase())) || memory.schemas[0] || ''
    $('ob-schema').value = memory.schema
  }
  function resetFilter() {
    activeFilter = null; activeSort = ''; activeDirection = 'asc'; activeLimit = Number($('ob-limit').value)
    $('ob-column').value = ''; $('ob-value').value = ''; $('ob-sort').value = ''; $('ob-direction').value = 'asc'; offset = 0
  }
  async function loadTables() {
    resetData(); resetFilter()
    $('ob-table').innerHTML = ''
    $('ob-column').innerHTML = '<option value="">全部记录</option>'
    $('ob-sort').innerHTML = '<option value="">默认排序</option>'
    if (!memory.schema) { notify('当前账号没有可访问的模式（Schema）'); return }
    const data = await request('tables')
    tables = data.tables
    $('ob-table').innerHTML = tables.map(table => `<option value="${esc(table.name)}">${esc(table.name)}${table.type === 'VIEW' ? '（视图）' : ''}</option>`).join('')
    if (!tables.some(table => table.name === memory.table)) memory.table = tables[0]?.name || ''
    $('ob-table').value = memory.table
    if (memory.table) await loadRows(true)
    else notify('当前模式中没有可访问的表或视图')
  }
  async function loadRows(resetColumns = false) {
    const data = await request('rows', { offset, limit: activeLimit, filter: activeFilter, sort: activeSort, direction: activeDirection })
    result = data
    const editable = data.permissions.edit
    if (resetColumns) {
      $('ob-column').innerHTML = '<option value="">全部记录</option>' + data.columns.filter(c => !c.binary).map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')
      $('ob-sort').innerHTML = '<option value="">默认排序</option>' + data.columns.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')
      $('ob-column').value = activeFilter?.column || ''
      $('ob-sort').value = activeSort
    }
    const keyLabel = data.key.mode === 'rowid' ? 'ROWID' : data.key.mode === 'primary' ? `主键（${data.key.columns.join('、')}）` : '无'
    $('ob-table-note').textContent = editable
      ? `按 ${keyLabel} 定位记录；保存时校验原值，避免覆盖他人的修改。`
      : (data.tableType === 'VIEW' ? '视图只提供查询。' : '该对象没有可编辑的主键，也不支持 ROWID 定位，不提供行编辑和删除。')
    $('ob-count').textContent = `${memory.schema}.${memory.table} · 本页 ${data.rows.length} 条`
    $('ob-grid').innerHTML = data.rows.length
      ? `<table><thead><tr><th>操作</th>${data.columns.map(c => `<th>${esc(c.name)}${c.primary ? ' 🔑' : ''}</th>`).join('')}</tr></thead><tbody>${data.rows.map((row, i) => `<tr><td class="ob-actions"><button class="btn sm" data-edit="${i}" ${editable ? '' : 'disabled'}>编辑</button><button class="btn sm danger" data-delete="${i}" ${editable ? '' : 'disabled'}>删除</button></td>${data.columns.map(c => `<td class="${row[c.name] === null ? 'ob-null' : ''}" title="${esc(display(row[c.name]))}">${esc(display(row[c.name]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<div class="empty">没有符合条件的记录，可调整筛选或新增记录</div>'
    $('ob-grid').querySelectorAll('[data-edit]').forEach(button => { button.onclick = () => openEditor(data.rows[Number(button.dataset.edit)]) })
    $('ob-grid').querySelectorAll('[data-delete]').forEach(button => { button.onclick = () => openDelete(data.rows[Number(button.dataset.delete)]) })
    $('ob-structure-body').innerHTML = `<table><thead><tr><th>字段</th><th>类型</th><th>允许空值</th><th>默认值</th><th>主键 / 属性</th><th>说明</th></tr></thead><tbody>${data.columns.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td>${c.nullable ? '是' : '否'}</td><td>${esc(display(c.defaultValue))}</td><td>${c.primary ? '主键 ' : ''}${c.identity ? '标识列 ' : ''}${c.virtual ? '虚拟列 ' : ''}${c.binary ? '二进制' : ''}</td><td>${esc(c.comment)}</td></tr>`).join('')}</tbody></table>`
    $('ob-page').textContent = `第 ${Math.floor(offset / activeLimit) + 1} 页`
    updateControls()
  }
  /** 定位键：有主键用主键，否则用服务端附加的 ROWID。 */
  function keyOf(row) {
    if (result.key.mode === 'rowid') return { [ROWID_FIELD]: row[ROWID_FIELD] }
    return Object.fromEntries(result.key.columns.map(name => [name, row[name]]))
  }
  let editingRow = null, deletingRow = null
  function openEditor(row = null) {
    if (busy || !result) return
    editingRow = row
    $('ob-editor-title').textContent = `${row ? '编辑' : '新增'}记录 · ${memory.table}`
    $('ob-editor-error').textContent = ''
    $('ob-fields').innerHTML = result.columns.map((column, i) => {
      const locked = column.identity || column.virtual || column.binary || (row && column.primary)
      const required = !column.nullable && column.defaultValue == null && !column.identity && !locked
      const initial = row ? (row[column.name] === null ? 'null' : 'value') : required ? 'value' : 'default'
      const hint = column.identity ? '标识列，自动生成' : column.virtual ? '虚拟列，由表达式计算' : column.binary ? '二进制字段只读' : column.primary ? '主键只读' : ''
      const placeholder = /^DATE/.test(column.dataType) ? 'YYYY-MM-DD 或 YYYY-MM-DD HH24:MI:SS' : /^TIMESTAMP/.test(column.dataType) ? 'YYYY-MM-DD HH24:MI:SS[.FF]' : ''
      return `<div class="ob-field" data-field="${i}"><label for="ob-field-${i}">${esc(column.name)} ${column.primary ? '🔑' : ''}<small>${esc(column.type)}${column.nullable ? '' : ' · 必填'}${column.comment ? ' · ' + esc(column.comment) : ''}</small></label><select aria-label="${esc(column.name)} 值类型" ${locked ? 'disabled' : ''}>${!row ? '<option value="default">使用默认值 / 自动生成</option>' : ''}<option value="value" ${initial === 'value' ? 'selected' : ''}>填写值</option>${column.nullable ? `<option value="null" ${initial === 'null' ? 'selected' : ''}>NULL</option>` : ''}</select><textarea id="ob-field-${i}" rows="2" placeholder="${esc(placeholder)}" ${locked || initial !== 'value' ? 'disabled' : ''}>${row && row[column.name] !== null ? esc(display(row[column.name])) : ''}</textarea>${hint ? `<small class="muted">${hint}</small>` : ''}</div>`
    }).join('')
    $('ob-fields').querySelectorAll('.ob-field').forEach(field => {
      field.querySelector('select').onchange = event => { field.querySelector('textarea').disabled = event.target.value !== 'value' }
    })
    $('ob-editor').showModal()
  }
  $('ob-cancel').onclick = () => { if (!busy) $('ob-editor').close() }
  $('ob-editor').addEventListener('cancel', event => { if (busy) event.preventDefault() })
  $('ob-delete-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault() })
  $('ob-editor-form').onsubmit = event => {
    event.preventDefault()
    const values = Object.create(null)
    $('ob-fields').querySelectorAll('.ob-field').forEach(field => {
      const column = result.columns[Number(field.dataset.field)]
      if (column.identity || column.virtual || column.binary || (editingRow && column.primary)) return
      const mode = field.querySelector('select').value
      if (mode === 'default') return
      const value = mode === 'null' ? null : field.querySelector('textarea').value
      if (editingRow && (value === editingRow[column.name] || (value !== null && editingRow[column.name] !== null && value === String(editingRow[column.name])))) return
      values[column.name] = value
    })
    if (editingRow && !Object.keys(values).length) { $('ob-editor-error').textContent = '没有修改任何字段'; return }
    void run(async () => {
      await request(editingRow ? 'update' : 'insert', { values, ...(editingRow ? { key: keyOf(editingRow), original: editingRow } : {}) })
      $('ob-editor').close()
      try { await loadRows() } catch { resetData(); notify('保存已成功，但刷新失败，请重新查询', true); return }
      notify(editingRow ? '记录已更新' : '记录已新增；若当前有筛选条件，新记录可能不在本页')
    }, $('ob-editor-error'))
  }
  function openDelete(row) {
    if (busy) return
    deletingRow = row
    $('ob-delete-key').textContent = JSON.stringify(keyOf(row), null, 2)
    $('ob-delete-error').textContent = ''
    $('ob-delete-dialog').showModal()
  }
  $('ob-delete-cancel').onclick = () => { if (!busy) $('ob-delete-dialog').close() }
  $('ob-delete-confirm').onclick = () => void run(async () => {
    await request('delete', { key: keyOf(deletingRow), original: deletingRow, confirm: true })
    $('ob-delete-dialog').close()
    if (result.rows.length === 1 && offset > 0) offset = Math.max(0, offset - activeLimit)
    try { await loadRows() } catch { resetData(); notify('删除已成功，但刷新失败，请重新查询', true); return }
    notify('记录已删除')
  }, $('ob-delete-error'))
  // 智能解析：把粘贴进来的连接信息回填到各字段（与 OceanBase 客户端一致的使用方式）
  $('ob-parse').onclick = () => {
    if (busy) return
    const parsed = parseConnectString($('ob-parse-text').value)
    const fields = Object.keys(parsed)
    if (!fields.length) { notify('没有解析到连接信息，请粘贴形如 obclient -h 主机 -P2883 -u用户@租户#集群 -p密码 的内容', true); return }
    for (const [name, value] of Object.entries(parsed)) {
      const control = $('ob-connect-form').elements[name]
      if (control && value) control.value = value
    }
    if (!parsed.port) $('ob-connect-form').elements.port.value = '2883'
    $('ob-parse-text').value = ''
    notify(`已解析：${['host', 'port', 'user', 'tenant', 'cluster', 'password'].filter(key => parsed[key]).map(key => ({ host: '主机', port: '端口', user: '用户名', tenant: '租户', cluster: '集群', password: '密码' })[key]).join('、')}`)
  }
  $('ob-connect-form').onsubmit = event => {
    event.preventDefault()
    if (busy) return // 请求进行中控件被禁用，FormData 会取不到值，直接忽略重复提交
    const form = new FormData(event.target)
    const text = name => String(form.get(name) ?? '').trim()
    const connection = {
      mode: 'oracle',
      host: text('host'),
      port: Number(form.get('port') ?? 0),
      cluster: text('cluster'),
      tenant: text('tenant'),
      user: text('user'),
      password: String(form.get('password') ?? ''),
      database: text('database'),
      tls: form.get('tls') === 'on',
      profileName: text('profileName'),
      env: text('env'),
      remember: form.get('remember') === 'on',
    }
    if (!connection.tenant && !connection.user.includes('@')) {
      notify('请填写租户名（OceanBase Oracle 模式的服务名就是租户名），或把用户名写成 用户名@租户#集群', true)
      return
    }
    void run(async () => {
      connected = false; memory.connection = null; resetData(); updateControls()
      $('ob-status').textContent = '正在连接…'
      const data = await request('connect', {}, connection)
      memory.connection = connection; memory.schemas = data.schemas; memory.schema = ''; memory.table = ''
      connected = true
      const info = data.info || {}
      // 明确展示「连的是 OceanBase 的哪个租户」，避免与 Oracle 数据库混淆。
      const tenant = data.tenant ? `租户 ${data.tenant}${data.cluster ? '#' + data.cluster : ''}` : '未识别租户'
      const alias = [connection.profileName, connection.env].filter(Boolean).join(' · ')
      const badge = connection.env ? `<b class="ob-env-badge${/生产|prod/i.test(connection.env) ? ' danger' : ''}">${esc(connection.env)}</b> ` : ''
      $('ob-status').innerHTML = `${badge}已连接${alias ? ' · ' + esc(alias) : ''} · ${tenant} · ${info.currentUser || '未知账号'}${info.version ? ' · ' + esc(info.version) : ''}（OceanBase Oracle 兼容模式 · MySQL 线协议）`
      savePasswordIfRequested(connection)
      fillSchemas(); await loadTables(); notify('连接成功')
    }).finally(() => { if (!connected) $('ob-status').textContent = '未连接，请检查连接参数后重试' })
  }
  $('ob-connect-form').addEventListener('input', () => {
    if (!connected || busy) return
    connected = false; memory.connection = null; resetData(); updateControls()
    $('ob-status').textContent = '连接参数已修改，请重新连接'
  })
  $('ob-disconnect').onclick = () => {
    memory.connection = null; memory.schemas = []; memory.schema = ''; memory.table = ''; connected = false
    $('ob-connect-form').elements.password.value = ''
    $('ob-status').textContent = '已断开，连接密码已清除'
    resetData(); updateControls(); notify()
  }
  $('ob-schema').onchange = () => { memory.schema = $('ob-schema').value; memory.table = ''; void run(loadTables) }
  $('ob-table').onchange = () => { memory.table = $('ob-table').value; resetData(); resetFilter(); void run(() => loadRows(true)) }
  $('ob-refresh').onclick = () => void run(loadTables)
  $('ob-structure').onclick = () => {
    if (!result) { notify('请先选择数据表并查询', true); return }
    $('ob-structure-table').textContent = `${memory.schema}.${memory.table}`
    $('ob-structure-dialog').showModal()
  }
  $('ob-structure-close').onclick = () => $('ob-structure-dialog').close()
  $('ob-structure-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault() })
  $('ob-verify').onclick = () => void run(async () => {
    const data = await request('verify', { schema: memory.schema })
    const lines = (data.checks || []).map(check => `${check.ok ? '✅' : '❌'} ${check.name}：${check.detail}`)
    notify()
    $('ob-table-note').innerHTML = `数据字典自检（字段结构档位 ${data.columnTier}）<br>${lines.map(line => esc(line)).join('<br>')}`
    const failed = (data.checks || []).filter(check => !check.ok).length
    notify(failed ? `自检完成：${failed} 项失败，详见下方明细` : '自检完成：全部通过', failed > 0)
  })
  $('ob-add').onclick = () => openEditor()
  $('ob-filter').onsubmit = event => {
    event.preventDefault()
    if (!memory.table) return
    offset = 0; activeLimit = Number($('ob-limit').value); activeSort = $('ob-sort').value; activeDirection = $('ob-direction').value
    activeFilter = $('ob-column').value ? { column: $('ob-column').value, op: $('ob-op').value, value: $('ob-value').value } : null
    resetData()
    void run(() => loadRows(true))
  }
  $('ob-reset').onclick = () => { resetFilter(); resetData(); if (memory.table) void run(() => loadRows(true)) }
  $('ob-prev').onclick = () => void run(async () => { const previous = offset; offset = Math.max(0, offset - activeLimit); try { await loadRows() } catch (error) { offset = previous; throw error } })
  $('ob-next').onclick = () => void run(async () => { const previous = offset; offset += activeLimit; try { await loadRows() } catch (error) { offset = previous; throw error } })
  $('ob-export').onclick = () => {
    if (!result) return
    const cell = oceanBaseCsvCell
    const lines = [result.columns.map(c => cell(c.name)).join(','), ...result.rows.map(row => result.columns.map(c => cell(row[c.name])).join(','))]
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${memory.table}-page-${Math.floor(offset / activeLimit) + 1}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  updateControls()
  void loadProfiles()
  if (connected) { fillSchemas(); void run(loadTables) }
  return () => {
    if (busy) { notify('数据库操作正在进行，请等待完成后再切换菜单', true); return false }
    return true
  }
}
