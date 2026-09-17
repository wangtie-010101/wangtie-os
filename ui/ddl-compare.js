/**
 * 王铁 OS — 「DDL 比较」页面。
 *
 * 连接信息来自服务端配置文件（页面不填账号密码，也拿不到密码）：
 *   config/ddl-environments.json（或 config/ddl-environments.local.json / DDL_ENV_CONFIG 指定路径）
 * 页面做的事：读环境清单 → 触发比较 → 展示「只在某侧 / 结构不同」的差异与左右 DDL 对照。
 */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const memory = { filter: '', includeViews: true, includeIdentical: false, result: null }

/** 差异行的着色：+ 新增 / - 缺失 / ~ 变更。 */
const lineClass = line => line.startsWith('+') ? 'ddl-add' : line.startsWith('-') ? 'ddl-del' : line.startsWith('~') ? 'ddl-mod' : 'muted'

export function renderDdlCompare(el) {
  let busy = false
  let environments = []
  let filePath = ''
  let updatedAt = ''
  el.innerHTML = `
    <div class="section-title">DDL 比较 <span class="muted">SIT ↔ UAT 表结构差异 · 连接信息读配置文件</span></div>
    <div class="card">
      <h3>比较环境 <span class="muted" id="dc-source"></span></h3>
      <div id="dc-envs" class="dc-envs"></div>
      <div class="row ob-toolbar" style="margin-top:10px">
        <label>对象名包含<input type="text" id="dc-filter" value="${esc(memory.filter)}" placeholder="留空＝全部对象，例如 BILL"></label>
        <label class="ob-check"><input type="checkbox" id="dc-views" ${memory.includeViews ? 'checked' : ''}>包含视图</label>
        <label class="ob-check"><input type="checkbox" id="dc-identical" ${memory.includeIdentical ? 'checked' : ''}>同时列出结构一致的对象</label>
        <button class="btn" id="dc-test" title="分别连接两套环境，检查账号/租户/密码与模式是否可用">🔌 测试两个环境</button>
        <button class="btn primary" id="dc-run">🔍 开始比较</button>
        <button class="btn" id="dc-export" disabled>导出差异 CSV</button>
      </div>
      <div class="muted ob-hint">比较内容：对象（表/视图）增删、字段增删与类型/可空/默认值/注释变化、主键、索引、表与字段注释。
        结果为只读比较，不会对任何数据库执行 DDL。</div>
    </div>
    <div id="dc-message" role="status" aria-live="polite"></div>
    <div id="dc-result"></div>`

  const $ = id => el.querySelector('#' + id)
  const notify = (message = '', error = false) => { $('dc-message').textContent = message; $('dc-message').className = error ? 'error-text' : 'ob-success' }

  async function request(action, body = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000) // 比较要连两个库并拉全量字典，超时给足
    try {
      const base = new URL('./', import.meta.url).pathname.replace(/\/ui\/$/, '')
      const response = await fetch(`${base}/api/oceanbase/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const failure = new Error(data.error ? `${data.error}${data.code ? `（${data.code}）` : ''}` : `HTTP ${response.status}`)
        failure.details = data.details
        throw failure
      }
      return data
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求超时（120 秒）：对象很多或网络较慢，可先用「对象名包含」缩小范围')
      throw error
    } finally { clearTimeout(timer) }
  }

  const statuses = {}                                  // key → { ok, error, objectCount }
  function renderEnvironments() {
    const source = filePath
      ? `配置文件：${filePath}${updatedAt ? `（${new Date(updatedAt).toLocaleString('zh-CN', { hour12: false })} 更新）` : ''}`
      : '没有找到配置文件'
    $('dc-source').textContent = source
    $('dc-envs').innerHTML = environments.length
      ? environments.map((env, index) => `
        <div class="dc-env ${env.enabled ? '' : 'off'}">
          <div class="dc-env-head"><b>${esc(env.key)}</b> · ${esc(env.name)}${env.enabled ? '' : '（未启用）'}${statuses[env.key] ? (statuses[env.key].ok ? ` <span class="dc-ok">✓ 连接正常 · ${statuses[env.key].objectCount ?? '?'} 个对象</span>` : ' <span class="dc-bad">✗ 连接失败</span>') : ''}</div>
          <div class="muted">${index === 0 ? '左侧' : index === 1 ? '右侧' : '其他'} · ${esc(env.host)}:${esc(env.port)}</div>
          <div class="muted">租户 ${esc(env.tenant)}${env.cluster ? '#' + esc(env.cluster) : ''} · 账号 ${esc(env.user)}</div>
          <div class="muted">比较模式 ${esc(env.schema)} · 密码 ${env.hasPassword ? '已配置（不显示）' : '⚠ 未配置'}</div>
          ${statuses[env.key] && !statuses[env.key].ok ? `<div class="error-text">${esc(statuses[env.key].error || '连接失败')}</div>` : ''}
        </div>`).join('')
      : '<div class="empty">配置文件里没有可用的环境</div>'
  }

  function renderResult() {
    const result = memory.result
    const box = $('dc-result')
    if (!result) { box.innerHTML = ''; $('dc-export').disabled = true; return }
    const { summary, diffs } = result
    const chips = [
      ['只在左侧', summary.onlyLeft, 'dc-badge-left'],
      ['只在右侧', summary.onlyRight, 'dc-badge-right'],
      ['结构不同', summary.changed, 'dc-badge-changed'],
      ['完全一致', summary.identical, 'dc-badge-same'],
    ].map(([label, count, cls]) => `<span class="stat-chip ${cls}">${label} <b>${count}</b></span>`).join('')
    const header = `<div class="card"><h3>比较结果 <span class="muted">${esc(result.left.key)}（${esc(result.left.schema)}）↔ ${esc(result.right.key)}（${esc(result.right.schema)}）${result.filter ? ` · 过滤「${esc(result.filter)}」` : ''}</span></h3>
      <div class="row" style="flex-wrap:wrap;gap:8px">${chips}
      <span class="muted">左侧对象 ${summary.leftCount} 个 · 右侧对象 ${summary.rightCount} 个</span></div>
      ${(result.warnings || []).length ? `<div class="muted ob-hint">⚠ ${esc(result.warnings.join('；'))}</div>` : ''}</div>`
    if (!diffs.length) {
      box.innerHTML = header + '<div class="card"><div class="empty">两侧在比较范围内没有差异 🎉</div></div>'
      $('dc-export').disabled = true
      return
    }
    const items = diffs.map((diff, index) => `
      <details class="dc-item">
        <summary>
          <span class="dc-kind ${diff.kind}">${diff.kind === 'only-left' ? '仅左侧' : diff.kind === 'only-right' ? '仅右侧' : diff.identical ? '一致' : '有差异'}</span>
          <b>${esc(diff.name)}</b> <span class="muted">${diff.type === 'VIEW' ? '视图' : '表'}${diff.identical ? '' : ` · ${diff.lines.length} 处`}</span>
        </summary>
        <ul class="dc-lines">${diff.lines.map(line => `<li class="${lineClass(line)}">${esc(line)}</li>`).join('')}</ul>
        <div class="dc-ddl">
          <div><div class="muted">左侧 DDL${result.left.key ? `（${esc(result.left.key)}）` : ''}</div><pre>${esc(diff.ddlLeft || '（不存在）')}</pre></div>
          <div><div class="muted">右侧 DDL${result.right.key ? `（${esc(result.right.key)}）` : ''}</div><pre>${esc(diff.ddlRight || '（不存在）')}</pre></div>
        </div>
      </details>`).join('')
    box.innerHTML = header + `<div class="card"><h3>差异明细 <span class="muted">共 ${diffs.length} 个对象，点开看差异与 DDL 对照</span></h3>${items}</div>`
    $('dc-export').disabled = false
  }

  $('dc-test').onclick = () => {
    if (busy) return
    busy = true
    $('dc-test').disabled = true
    $('dc-run').disabled = true
    notify('正在分别测试两套环境的连接…')
    void request('ddl-test')
      .then((data) => {
        for (const status of data.environments || []) statuses[status.key] = status
        renderEnvironments()
        const failed = (data.environments || []).filter(status => !status.ok)
        if (failed.length) notify(`有 ${failed.length} 套环境连不上：${failed.map(status => `${status.key} → ${status.error}`).join('；')}`, true)
        else notify(`两套环境都能连上：${(data.environments || []).map(status => `${status.key} ${status.objectCount} 个对象`).join('、')}`)
      })
      .catch((error) => notify(`测试失败：${error.message}`, true))
      .finally(() => { busy = false; $('dc-test').disabled = false; $('dc-run').disabled = false })
  }

  $('dc-run').onclick = () => {
    if (busy) return
    busy = true
    $('dc-run').disabled = true
    notify('正在连接两台库并读取数据字典…')
    memory.filter = $('dc-filter').value.trim()
    memory.includeViews = $('dc-views').checked
    memory.includeIdentical = $('dc-identical').checked
    void request('ddl-compare', { filter: memory.filter, includeViews: memory.includeViews, includeIdentical: memory.includeIdentical })
      .then((data) => {
        memory.result = data
        for (const [side, status] of Object.entries(data.statuses || {})) if (status) statuses[status.key] = status
        renderEnvironments()
        renderResult()
        notify('比较完成')
      })
      .catch((error) => {
        // 服务端会带回「哪一侧失败、什么原因」，直接标到对应环境卡片上
        for (const status of Object.values(error.details || {})) if (status && status.key) statuses[status.key] = status
        renderEnvironments()
        notify(`比较失败：${error.message}`, true)
      })
      .finally(() => { busy = false; $('dc-run').disabled = false })
  }

  $('dc-export').onclick = () => {
    const result = memory.result
    if (!result) return
    const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const lines = [['对象', '类型', '差异类别', '差异内容'].map(cell).join(',')]
    for (const diff of result.diffs) {
      const kind = diff.kind === 'only-left' ? '仅左侧' : diff.kind === 'only-right' ? '仅右侧' : diff.identical ? '一致' : '有差异'
      for (const line of diff.lines) lines.push([diff.name, diff.type === 'VIEW' ? '视图' : '表', kind, line].map(cell).join(','))
    }
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ddl-diff-${result.left.key}-${result.right.key}.csv`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  void request('ddl-environments')
    .then((data) => { filePath = data.path || ''; updatedAt = data.updatedAt || ''; environments = data.environments || []; renderEnvironments() })
    .catch((error) => { $('dc-source').textContent = `读取配置失败：${error.message}` })

  renderResult()
  return () => !busy
}
