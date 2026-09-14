/**
 * 王铁 OS — 全屏 SPA（原生 JS，无构建依赖）。
 * 页面骨架与各模块页。API 前缀 /wangtie-os/api/*，静态资源 /wangtie-os/ui/*。
 * 模块划分与视频中的「数币 OS」保持一致，方便逐模块替换为真实实现。
 */

// 知识库（票据 / 会计）内置演示文档（前端内置数据，本地检索，无需后端）
import { KNOWLEDGE, KNOWLEDGE_ACCOUNTING } from './knowledge-data.js'

const API = '/wangtie-os/api'
// 环境仅在「数据查询」模块内提供选择：SIT / UAT / 准生产（内部值 SIT / UAT1 / UAT2）
const ENV_OPTIONS = [['SIT', 'SIT'], ['UAT1', 'UAT'], ['UAT2', '准生产']]
const state = { env: 'SIT', instance: 'scb-online', page: 'dashboard' }

/* ------------------------------ 基础工具 ------------------------------ */

const $ = (el) => document.querySelector(el)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
async function api(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000) // 12s 超时，避免界面一直转圈
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      ...options,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    return data
  } finally {
    clearTimeout(timer)
  }
}

function rendered(node) {
  $('#app').replaceChildren(node)
}

function shell(page) {
  const nav = [
    ['dashboard', '工作台', '🏠'],
    ['__group__', '常用业务'],
    ['query', '数据查询', '🔍'],
    ['knowledge', '知识库', '📚'],
    ['dictionary', '数据字典工具', '📖'],
    ['__group__', '效率工具'],
    ['notes', '记事本', '📝'],
    ['devtools', '常用开发工具', '🧰'],
    ['__group__', '放松一下'],
    ['entertainment', '休息一下', '🎮'],
    ['health', '健康提醒', '⏰'],
  ]
  const el = document.createElement('div')
  el.className = 'layout'
  el.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">铁</div>
        <div>
          <div class="title">王铁 OS</div>
          <div class="subtitle">Wang Tie OS</div>
        </div>
      </div>
      <nav class="nav">
        ${nav.map(([id, label, ico]) =>
          id === '__group__'
            ? `<div class="nav-group">${label}</div>`
            : `<div class="nav-item ${state.page === id ? 'active' : ''}" data-page="${id}">
              <span class="ico">${ico}</span><span>${label}</span>
            </div>`).join('')}
      </nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="crumb">王铁 OS <span class="muted" id="crumb-sub"></span></div>
      </div>
      <div class="content" id="page"></div>
    </div>`
  el.querySelectorAll('.nav-item').forEach((item) => {
    item.onclick = () => { state.page = item.dataset.page; shellAndRender() }
  })
  // 环境切换仅在「数据查询」模块内提供（SIT / UAT / 准生产），全局不再展示
  const sub = el.querySelector('#crumb-sub')
  sub.textContent = `— ${nav.find(([id]) => id === state.page)?.[1] ?? ''}`
  return el
}

function shellAndRender() {
  const s = shell(state.page)
  rendered(s)
  const pageEl = s.querySelector('#page')
  // 兼容同步/异步页面函数：统一转为 Promise，避免同步页 return undefined 时 .catch 抛错
  Promise.resolve(PAGES[state.page]?.(pageEl)).catch((error) => { pageEl.innerHTML = `<div class="error-text">加载失败：${esc(String(error))}</div>` })
}

const PAGES = {}

function card(title, body, extra = '') {
  return `<div class="card"><h3>${title}<span class="muted">${extra}</span></h3>${body}</div>`
}

function table(columns, rows, emptyText = '暂无数据') {
  if (rows.length === 0) return `<div class="empty">${emptyText}</div>`
  return `<table><thead><tr>${columns.map((col) => `<th>${col}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

/* ------------------------------ 工作台 ---------------------------- */

PAGES.dashboard = async (el) => {
  el.innerHTML = `
    <div class="section-title">工作台</div>
    <div class="grid">
      ${[
        ['knowledge', '📚', '知识库', '票据 / 会计两级知识库：检索问答 + 知识投喂（RAG）'],
        ['query', '🔍', '数据查询', '自定义数据库连接（7 类）与 SQL 查询'],
        ['dictionary', '📖', '数据字典工具', '字典一键导入 / 搜索 / 分类'],
        ['health', '⏰', '健康提醒', '到点提醒喝水 / 运动 / 休息'],
        ['notes', '📝', '记事本', '记录开发常用命令 / 配置 / 笔记，自动保存'],
        ['devtools', '🧰', '常用开发工具', '12 个在线工具：JSON / 压缩 / 大小写等'],
        ['entertainment', '🎮', '休息一下', '雷霆战机等内置小游戏'],
      ].map(([page, ico, name, desc]) =>
        `<div class="card quick" data-page="${page}"><h3>${ico} ${name}</h3><div class="muted">${desc}</div></div>`).join('')}
    </div>
    <div class="card" id="sysinfo"><h3>系统信息 <span class="muted">模块概览</span></h3><div class="loading">加载中…</div></div>`
  // 快捷卡片：点击跳转到对应模块
  el.querySelectorAll('.card.quick').forEach((card) => {
    card.onclick = () => { state.page = card.dataset.page; shellAndRender() }
  })
  try {
    const info = await api('/api/app-info')
    // 防御式取值：接口字段缺失/变形时给出占位，避免整卡报错
    const name = esc(info && info.name ? info.name : '王铁 OS')
    const version = esc(info && info.version ? info.version : '-')
    const envText = Array.isArray(info && info.environments)
      ? info.environments.filter((env) => env !== 'DEV').map((env) => (ENV_OPTIONS.find(([v]) => v === env) ?? [env, env])[1]).join(' / ') || '-'
      : '-'
    const serviceText = Array.isArray(info && info.services)
      ? info.services.map((sv) => esc(sv && sv.name ? sv.name : '未知服务')).join('、') || '暂无'
      : '-'
    // —— 按当前功能集整理模块描述文案（与后端解耦，永不出错）——
    const MODULE_LINES = [
      ['数据查询', '自定义数据库连接与 SQL 查询'],
      ['知识库', '票据 / 会计知识检索与投喂'],
      ['数据字典', '字典检索与一键导入'],
      ['健康提醒', '到点提醒喝水 / 运动 / 休息'],
      ['记事本', 'Markdown 三栏笔记'],
      ['常用开发工具', '常用开发在线工具'],
      ['休息一下', '内置小游戏'],
    ]
    el.querySelector('#sysinfo').innerHTML = `<h3>系统信息 <span class="muted">Wang Tie OS · 模块概览</span></h3>
      <div class="kv">
        <div class="k">应用名称</div><div>${name}</div>
        <div class="k">版本</div><div>${version}</div>
        <div class="k">可用环境</div><div>${envText}</div>
        <div class="k">服务实例</div><div>${serviceText}</div>
      </div>
      <div style="margin-top:10px">
        ${MODULE_LINES.map(([m, d]) => `<div class="row" style="gap:8px;padding:3px 0"><span style="min-width:96px;font-weight:600;flex-shrink:0">${m}</span><span class="muted" style="flex:1">${d}</span></div>`).join('')}
      </div>`
  } catch (error) {
    // 概览接口不可用时：整卡回退为纯文字「系统信息 · 模块概览」（无可点击项，不展示任何报错）
    const FALLBACK_LINES = [
      ['数据查询', '自定义数据库连接与 SQL 查询'],
      ['知识库', '票据 / 会计知识检索与投喂'],
      ['数据字典', '字典检索与一键导入'],
      ['记事本', 'Markdown 三栏笔记'],
      ['常用开发工具', '常用开发在线工具'],
      ['休息一下', '内置小游戏'],
    ]
    el.querySelector('#sysinfo').innerHTML = `
      <h3>系统信息 <span class="muted">模块概览</span></h3>
      <div style="margin-top:8px">
        ${FALLBACK_LINES.map(([m, d]) => `<div class="row" style="gap:8px;padding:3px 0"><span style="min-width:96px;font-weight:600;flex-shrink:0">${m}</span><span class="muted" style="flex:1">${d}</span></div>`).join('')}
      </div>
      <div class="muted" style="margin-top:10px">以上为各功能模块的说明，仅供查看</div>`
  }
}

/* -------------------------------- 数据查询 ------------------------------ */

PAGES.query = async (el) => {
  // ── 主流工具式「数据查询」：连接档案 / SQL 模板·历史·收藏 / 结果过滤与导出 ──
  const DB_TYPES = [
    ['oracle', 'Oracle'], ['mysql', 'MySQL'], ['postgresql', 'PostgreSQL'],
    ['sqlserver', 'SQL Server'], ['dm', '达梦 DM'], ['kingbase', '人大金仓 Kingbase'], ['oceanbase', 'OceanBase'],
  ]
  const DB_DEFAULT_PORT = { oracle: 1521, mysql: 3306, postgresql: 5432, sqlserver: 1433, dm: 5236, kingbase: 54321, oceanbase: 2881 }
  const LS = { profile: 'wt-db-profiles', history: 'wt-sql-history', favs: 'wt-sql-favs', active: 'wt-db-active' }

  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } }
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { /* ignore */ } }

  let profiles = lsGet(LS.profile, [])
  let history = lsGet(LS.history, [])
  let favs = lsGet(LS.favs, [])
  let lastRes = null          // { columns, rows }
  let filterText = ''
  let limitRows = 200

  el.innerHTML = `
    <div class="section-title">数据查询 <span class="muted">连接管理 · SQL 编辑器 · 结果网格（当前为内置演示数据源）</span></div>

    <div class="card">
      <h3>🔌 数据库连接 <span class="muted" id="db-note"></span></h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:8px 18px;margin-bottom:10px">
        <div class="row"><span class="muted" style="width:130px">档案名称</span><input type="text" id="db-title" placeholder="如 生产票据库" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">数据库类型</span><select id="db-type" style="flex:1">${DB_TYPES.map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}</select></div>
        <div class="row"><span class="muted" style="width:130px">数据库地址</span><input type="text" id="db-host" placeholder="IP / 域名" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">端口</span><input type="text" id="db-port" placeholder="留空自动按类型填充" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">数据库 / SID</span><input type="text" id="db-name" placeholder="可留空" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">用户名</span><input type="text" id="db-user" placeholder="请输入用户名" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">密码</span><input type="password" id="db-pass" placeholder="请输入密码" style="flex:1">
          <button type="button" class="btn sm" id="db-pass-eye" title="显示 / 隐藏密码">👁</button></div>
      </div>
      <div class="row">
        <button class="btn sm" id="db-save">💾 另存为连接档案</button>
        <button class="btn sm danger" id="db-delete" title="删除当前档案">🗑</button>
        <button class="btn primary" id="db-test">🧪 测试连接</button>
        <span id="db-test-res" class="muted"></span>
      </div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px" id="qp-list"></div>
    </div>

    <div class="card">
      <h3 style="display:flex;align-items:center;gap:8px">
        SQL 编辑器
        <button class="btn sm" id="q-fav" title="收藏当前 SQL">★ 收藏</button>
        <span class="muted" style="font-size:12px">Ctrl/Cmd + Enter 执行</span>
      </h3>
      <div class="row" style="margin-bottom:8px;gap:6px;flex-wrap:wrap">
        <select id="sql-hist" style="max-width:230px"><option value="">🕘 历史记录…</option></select>
        <select id="sql-fav" style="max-width:230px"><option value="">★ 我的收藏…</option></select>
        <button class="btn sm" id="q-clear">清空</button>
      </div>
      <textarea id="sql-text" rows="7" placeholder="请输入您的SQL语句"></textarea>
      <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap">
        <button class="btn primary" id="sql-run">▶ 执行查询</button>
        <button class="btn" id="sql-export">导出 CSV</button>
        <button class="btn" id="sql-json">导出 JSON</button>
        <span class="muted">返回行数 ≤</span>
        <select id="sql-limit"><option>50</option><option selected>200</option><option>1000</option></select>
        <input type="text" id="res-filter" placeholder="🔍 过滤当前结果…" style="flex:1;min-width:140px">
        <span class="muted" id="sql-cost"></span>
      </div>
    </div>
    <div id="sql-result"></div>`

  const $id = (id) => el.querySelector('#' + id)

  /* ---------- 连接档案 ---------- */
  const readProfile = () => ({
    title: $id('db-title').value.trim(),
    type: $id('db-type').value,
    host: $id('db-host').value.trim(),
    port: $id('db-port').value.trim(),
    dbName: $id('db-name').value.trim(),
    username: $id('db-user').value.trim(),
    password: $id('db-pass').value,
  })
  const applyProfile = (p) => {
    $id('db-title').value = p.title || ''
    $id('db-type').value = p.type || 'mysql'
    $id('db-host').value = p.host || ''
    $id('db-port').value = p.port || ''
    $id('db-name').value = p.dbName || ''
    $id('db-user').value = p.username || ''
    $id('db-pass').value = p.password || ''
  }
  const renderProfiles = () => {
    const box = $id('qp-list')
    if (!profiles.length) { box.innerHTML = '<span class="muted">尚无连接档案，填写上方信息后点「另存为连接档案」</span>'; return }
    const active = lsGet(LS.active, '')
    box.innerHTML = profiles.map((p, i) => `
      <button class="btn sm tag-chip ${p.key === active ? 'active' : ''}" data-i="${i}">
        ${esc(p.title || p.host || ('档案' + (i + 1)))}${p.host ? ' · ' + esc(p.host) : ''}
      </button>`).join('')
    box.querySelectorAll('[data-i]').forEach((b) => {
      b.onclick = () => {
        const p = profiles[Number(b.dataset.i)]
        applyProfile(p)
        lsSet(LS.active, p.key)
        renderProfiles()
        $id('db-note').textContent = `已载入档案：${p.title || p.host}`
      }
    })
  }
  $id('db-save').onclick = () => {
    const p = readProfile()
    if (!p.host) { $id('db-note').textContent = '请至少填写数据库地址'; return }
    const key = (p.title || p.host || '档案').trim() + '|' + Date.now()
    p.key = key
    profiles = profiles.filter((x) => x.key !== key)
    profiles.unshift(p)
    lsSet(LS.profile, profiles)
    lsSet(LS.active, key)
    $id('db-note').textContent = '✓ 档案已保存并设为当前'
    renderProfiles()
  }
  $id('db-delete').onclick = () => {
    const p = readProfile()
    const hit = profiles.find((x) => x.key === lsGet(LS.active, '') || (x.title === p.title && x.host === p.host))
    if (!hit || !window.confirm('确定删除当前连接档案？')) return
    profiles = profiles.filter((x) => x.key !== hit.key)
    lsSet(LS.profile, profiles)
    renderProfiles()
    $id('db-note').textContent = '已删除档案'
  }
  $id('db-pass-eye').onclick = () => {
    const pass = $id('db-pass')
    const show = pass.type === 'password'
    pass.type = show ? 'text' : 'password'
    $id('db-pass-eye').textContent = show ? '🙈' : '👁'
  }
  const setTest = (html, ok) => {
    const node = $id('db-test-res')
    node.innerHTML = html
    node.style.color = ok === true ? 'var(--green)' : (ok === false ? 'var(--red)' : 'var(--text-2)')
  }
  $id('db-test').onclick = async () => {
    const profile = readProfile()
    if (!profile.host) { setTest('✗ 请先填写数据库地址', false); return }
    setTest('正在测试连接（后端 TCP 探测）…')
    try {
      const data = await api('/api/db/test', { method: 'POST', body: JSON.stringify(profile) })
      setTest(data.ok ? `✓ <b>连接成功</b> · ${esc(data.host)}:${data.port}（${data.ms}ms）` : `✗ 连接失败 · ${esc(data.code || '')} — ${esc(data.detail || '')}`, data.ok)
    } catch (error) {
      setTest(String(error).includes('404')
        ? '✗ 探测接口需重启 DSH Web 后启用（连接档案与 SQL 不受影响）'
        : `✗ 测试请求失败：${esc(String(error))}`, false)
    }
  }

  // 类型切换自动填端口
  $id('db-type').addEventListener('change', () => {
    const cur = $id('db-port').value.trim()
    const isDefault = Object.values(DB_DEFAULT_PORT).some((p) => String(p) === cur)
    if (cur === '' || isDefault) $id('db-port').value = DB_DEFAULT_PORT[$id('db-type').value] || ''
  })

  /* ---------- SQL 历史 / 收藏 / 模板 ---------- */
  const fillSelect = (sel, arr, labelField) => {
    sel.innerHTML = `<option value="">${sel === $id('sql-hist') ? '🕘 历史记录…' : '★ 我的收藏…'}</option>` +
      arr.map((it, i) => `<option value="${i}">${esc(it[labelField]).slice(0, 42)}</option>`).join('')
  }
  fillSelect($id('sql-hist'), history, 0)
  fillSelect($id('sql-fav'), favs, 'name')

  $id('sql-hist').onchange = () => {
    const v = Number($id('sql-hist').value)
    if (Number.isFinite(v) && history[v]) { $id('sql-text').value = history[v]; $id('sql-hist').value = '' }
  }
  $id('sql-fav').onchange = () => {
    const v = Number($id('sql-fav').value)
    if (Number.isFinite(v) && favs[v]) { $id('sql-text').value = favs[v].sql; $id('sql-fav').value = '' }
  }
  $id('q-fav').onclick = () => {
    const sql = $id('sql-text').value.trim()
    if (!sql) return
    const name = window.prompt('收藏名称：', sql.slice(0, 24))
    if (name === null) return
    favs.unshift({ name: name.trim() || sql.slice(0, 24), sql })
    favs = favs.slice(0, 50)
    lsSet(LS.favs, favs)
    fillSelect($id('sql-fav'), favs, 'name')
    $id('db-note').textContent = '✓ 已收藏'
  }
  $id('q-clear').onclick = () => { $id('sql-text').value = ''; $id('sql-result').innerHTML = ''; lastRes = null }

  /* ---------- 执行与结果 ---------- */
  const renderGrid = () => {
    const box = $id('sql-result')
    if (!lastRes) return
    const { columns, rows } = lastRes
    let list = rows
    const kw = filterText.trim().toLowerCase()
    if (kw) list = rows.filter((r) => columns.some((c) => String(r[c.name] ?? '').toLowerCase().includes(kw)))
    list = list.slice(0, limitRows)
    box.innerHTML = card(`查询结果（${columns.length} 列 × ${rows.length} 行${kw ? ' · 过滤后 ' + list.length + ' 行' : ''}${rows.length > limitRows ? ' · 仅显示前 ' + limitRows + ' 行' : ''}）`,
      list.length ? `<div style="overflow:auto;max-height:520px">${table(columns.map((c) => `${c.name} (${c.cn})`), list.map((r) => columns.map((c) => r[c.name] ?? '')))}</div>` : '<div class="empty">无匹配结果</div>')
  }
  const run = async () => {
    const sql = $id('sql-text').value
    const box = $id('sql-result')
    if (!sql.trim()) { box.innerHTML = '<div class="muted">请先输入或从模板选择一条 SQL</div>'; return }
    limitRows = Number($id('sql-limit').value) || 200
    filterText = ''
    if ($id('res-filter')) $id('res-filter').value = ''
    box.innerHTML = '<div class="loading">执行中…</div>'
    try {
      const data = await api('/api/sql/query', { method: 'POST', body: JSON.stringify({ sql }) })
      if (!data.table) {
        box.innerHTML = `<div class="card"><div class="muted">${esc(data.message)}</div>
          <div class="tip" style="margin-top:8px">💡 当前为内置演示数据源：请从上方「📋 模板」选择可运行示例，或在档案中配置真实数据库后由网关直连。</div></div>`
        return
      }
      lastRes = { columns: data.columns, rows: data.rows }
      $id('sql-cost').textContent = `cost ${data.costMs}ms · ${data.rows.length} 行 × ${data.columns.length} 列`
      renderGrid()
      // 记录历史
      history = history.filter((h) => h !== sql)
      history.unshift(sql)
      history = history.slice(0, 20)
      lsSet(LS.history, history)
      fillSelect($id('sql-hist'), history, 0)
    } catch (error) {
      box.innerHTML = `<div class="error-text">${esc(String(error))}</div>`
    }
  }
  $id('sql-run').onclick = run
  $id('sql-text').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run() }
  })
  $id('res-filter').addEventListener('input', (e) => { filterText = e.target.value; renderGrid() })
  $id('sql-limit').addEventListener('change', (e) => { limitRows = Number(e.target.value) || 200; renderGrid() })

  const exportRows = () => {
    if (!lastRes) return []
    const { columns, rows } = lastRes
    let list = rows
    const kw = filterText.trim().toLowerCase()
    if (kw) list = rows.filter((r) => columns.some((c) => String(r[c.name] ?? '').toLowerCase().includes(kw)))
    return { columns, rows: list.slice(0, limitRows) }
  }
  $id('sql-export').onclick = () => {
    const { columns, rows } = exportRows()
    const csv = [columns.map((c) => c.cn).join(',')].concat(rows.map((r) => columns.map((c) => `"${String(r[c.name] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'query-result.csv'
    a.click()
  }
  $id('sql-json').onclick = () => {
    const { columns, rows } = exportRows()
    const json = rows.map((r) => Object.fromEntries(columns.map((c) => [c.name, r[c.name] ?? null])))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }))
    a.download = 'query-result.json'
    a.click()
  }

  // 载入当前档案
  const activeKey = lsGet(LS.active, '')
  const activeProfile = profiles.find((p) => p.key === activeKey) || profiles[0]
  if (activeProfile) applyProfile(activeProfile)
  renderProfiles()
}

/* -------------------------------- 知识库 -------------------------------- */

// 知识库命名空间（二级）：bill=票据知识库，acc=会计知识库
const KB_LIVE = { bill: KNOWLEDGE, acc: KNOWLEDGE_ACCOUNTING }
const KB_NAMES = { bill: '票据知识库', acc: '会计知识库' }

// ---- 投喂知识存储：IndexedDB，按命名空间保存 { bill:[...], acc:[...] }，并兼容旧版 localStorage ----
const KB_DB_NAME = 'wangtie-os-kb'
const KB_DB_STORE = 'docs'
const KB_LEGACY_KEY = 'wangtie-kb-custom-docs'

function openKbDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KB_DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(KB_DB_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbReadKbMap() {
  try {
    const db = await openKbDb()
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(KB_DB_STORE, 'readonly')
      const rq = tx.objectStore(KB_DB_STORE).get('all')
      rq.onsuccess = () => resolve(rq.result)
      rq.onerror = () => reject(rq.error)
    })
    // 旧版数组格式 → 视为票据知识库的投喂文档
    if (Array.isArray(value)) return { bill: value, acc: [] }
    return { bill: [], acc: [], ...(value || {}) }
  } catch (error) {
    return { bill: [], acc: [] }
  }
}

async function idbWriteKbMap(map) {
  const db = await openKbDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(KB_DB_STORE, 'readwrite')
    const rq = tx.objectStore(KB_DB_STORE).put(map, 'all')
    rq.onsuccess = () => resolve()
    rq.onerror = () => reject(rq.error)
  })
}

function kbCustom(ns) {
  return (KB_LIVE[ns] || []).filter((doc) => doc.custom)
}

async function saveCustomDocs() {
  try {
    await idbWriteKbMap({ bill: kbCustom('bill'), acc: kbCustom('acc') })
  } catch (error) {
    /* IndexedDB 不可用时仅保留在内存中 */
  }
}

// 启动：恢复两个知识库的投喂文档；旧版 localStorage 数据迁移进票据知识库
async function hydrateKnowledge() {
  const map = await idbReadKbMap()
  try {
    const legacy = localStorage.getItem(KB_LEGACY_KEY)
    if (legacy) {
      if (map.bill.length === 0) {
        try { map.bill = JSON.parse(legacy) } catch (error) { /* ignore */ }
      }
      localStorage.removeItem(KB_LEGACY_KEY)
    }
  } catch (error) {
    /* 忽略旧数据 */
  }
  for (const ns of ['bill', 'acc']) {
    const live = KB_LIVE[ns]
    for (const doc of map[ns] || []) {
      if (doc && doc.title && !live.some((item) => item.id === doc.id)) live.push(doc)
    }
  }
}

// 合并新文档到指定知识库：按「标题 + 正文」去重，返回实际新增篇数
function addCustomDocs(ns, rawDocs) {
  const live = KB_LIVE[ns] || []
  const now = Date.now()
  let added = 0
  rawDocs.forEach((raw, i) => {
    const title = String(raw.title || '').trim()
    const paragraphs = (raw.paragraphs || []).map(String).map((p) => p.trim()).filter(Boolean)
    if (!title || paragraphs.length === 0) return
    const summary = (raw.summary && String(raw.summary).trim()) ||
      (paragraphs[0].length > 60 ? `${paragraphs[0].slice(0, 60)}…` : paragraphs[0])
    const duplicated = live.some((doc) => doc.title === title && JSON.stringify(doc.paragraphs) === JSON.stringify(paragraphs))
    if (duplicated) return
    live.push({
      id: `custom-${ns}-${now}-${i}`,
      title,
      category: String(raw.category || '业务规则').trim() || '业务规则',
      summary,
      paragraphs,
      custom: true,
      ...(raw.image ? { image: raw.image } : {}),
    })
    added += 1
  })
  return added
}

// 解析「多篇聚合文本」：每篇以【标题】开头，直到下一个【标题】结束
function parseDocBlocks(text) {
  const docs = []
  let cur = null
  const flush = () => {
    if (cur && cur.title && cur.paragraphs.length) docs.push({ ...cur })
    cur = null
  }
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('【标题】')) {
      flush()
      cur = { title: line.slice(4).trim(), category: '业务规则', paragraphs: [], summary: '' }
    } else if (cur) {
      if (line.startsWith('【类别】')) cur.category = line.slice(4).trim()
      else if (line.startsWith('【摘要】')) cur.summary = line.slice(4).trim()
      else cur.paragraphs.push(line)
    }
  }
  flush()
  return docs
}

// 解析 JSON 数组文件：[{"title","category","summary","paragraphs": [...] 或 "...多行文本..."}]
function parseJsonDocs(text) {
  let arr
  try {
    arr = JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON 解析失败：${error.message}`)
  }
  if (!Array.isArray(arr)) throw new Error('JSON 顶层必须是文档数组 [...]')
  return arr.map((item) => {
    const paragraphs = Array.isArray(item.paragraphs)
      ? item.paragraphs
      : (typeof item.paragraphs === 'string' ? item.paragraphs.split(/\r?\n/) : [])
    return {
      title: String(item.title || '').trim(),
      category: String(item.category || '').trim(),
      summary: item.summary ? String(item.summary).trim() : '',
      paragraphs: paragraphs.map(String),
    }
  })
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsText(file)
  })
}

function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

// 图片压缩后转 JPEG dataURL（控制投喂体积，gif/png 透明底补白）
async function downscaleImage(dataUrl, maxSide = 1024, quality = 0.85) {
  const img = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('图片解码失败（格式不支持）'))
    im.src = dataUrl
  })
  let w = img.naturalWidth || 800
  let h = img.naturalHeight || 600
  if (w > maxSide || h > maxSide) {
    const scale = Math.min(maxSide / w, maxSide / h)
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}


// —— Word（.docx）正文提取：.docx 本质是 ZIP，读取 word/document.xml 后按段取文本 ——
function docxEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = []
  let off = 0
  while (off + 30 <= bytes.length) {
    const sig = view.getUint32(off, true)
    if (sig === 0x04034b50) { // 本地文件头
      const method = view.getUint16(off + 8, true)
      const compSize = view.getUint32(off + 18, true)
      const nameLen = view.getUint16(off + 26, true)
      const extraLen = view.getUint16(off + 28, true)
      const name = new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen))
      const dataStart = off + 30 + nameLen + extraLen
      entries.push({ name, method, data: bytes.subarray(dataStart, dataStart + compSize) })
      off = dataStart + compSize
      continue
    }
    break // 中心目录或其他 → 结束
  }
  return entries
}

async function inflateRawDeflate(compressed) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 docx 解压（请使用新版 Chrome / Safari）')
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

async function extractDocxText(bytes) {
  const entry = docxEntries(bytes).find((e) => e.name === 'word/document.xml')
  if (!entry) throw new Error('未找到 word/document.xml（文件可能不是有效的 .docx）')
  let xmlBytes
  if (entry.method === 0) xmlBytes = entry.data                       // 未压缩
  else if (entry.method === 8) xmlBytes = await inflateRawDeflate(entry.data) // DEFLATE
  else throw new Error(`不支持的压缩方式（method=${entry.method}）`)
  const xml = new TextDecoder().decode(xmlBytes)
  const text = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
}

PAGES.knowledge = (el) => {
  const activeKb = () => (state.kb === 'acc' ? 'acc' : 'bill')
  const setActive = (ns) => { state.kb = ns }

  el.innerHTML = `
    <div class="section-title">知识库 <span class="muted">票据 / 会计两级知识库 · 检索问答 · 可粘贴/上传投喂</span></div>
    <div class="tool-tabs" id="kb-tabs"></div>
    <div id="kb-root"></div>`
  const tabs = el.querySelector('#kb-tabs')
  const root = el.querySelector('#kb-root')

  const renderTabs = () => {
    tabs.innerHTML = Object.keys(KB_NAMES).map((ns) =>
      `<button class="tool-tab ${activeKb() === ns ? 'active' : ''}" data-kb="${ns}">${KB_NAMES[ns]} <span class="muted">${(KB_LIVE[ns] || []).length} 篇</span></button>`).join('')
    tabs.querySelectorAll('.tool-tab').forEach((btn) => {
      btn.onclick = () => { setActive(btn.dataset.kb); renderTabs(); renderKb() }
    })
  }

  const renderKb = () => {
    const ns = activeKb()
    const name = KB_NAMES[ns]
    const live = () => KB_LIVE[ns] || []
    const customCount = () => live().filter((doc) => doc.custom).length

    root.innerHTML = `
      <div class="card" style="margin-bottom:0">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <h3 style="margin:0">${name} <span class="muted" id="kb-stats"></span></h3>
          <span class="muted">支持粘贴多篇投喂与 .txt/.md/.json 文件批量上传</span>
        </div>
        <div class="row" style="margin-top:10px">
          <input type="text" id="kb-q" placeholder="输入问题，例如：商业汇票到期托收的流程是什么" style="flex:1">
          <button class="btn primary" id="kb-search">检索</button>
          <button class="btn" id="kb-browse">浏览文档</button>
          <button class="btn" id="kb-import-toggle">📥 粘贴投喂</button>
          <button class="btn" id="kb-upload-toggle">⬆ 上传文件投喂</button>
        </div>
      </div>

      <div class="card" id="kb-import" style="display:none">
        <h3>📥 粘贴知识批量投喂 → ${name}</h3>
        <div class="muted" style="line-height:1.8;margin-bottom:8px">每篇以 <b>【标题】…</b> 开头、正文每行一段；可一次粘贴多篇。可选 <b>【类别】…</b>、<b>【摘要】…</b> 补充元信息。</div>
        <textarea id="kb-import-text" rows="6" placeholder="【标题】商业承兑汇票买方付息贴现实务&#10;【类别】业务规则&#10;买方付息贴现指买方（出票人/承兑人）承担贴现利息……&#10;&#10;【标题】会计凭证装订要求&#10;凭证按月装订成册……"></textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" id="kb-do-import">开始投喂</button>
          <button class="btn danger" id="kb-clear-custom">🗑 清空本库投喂</button>
          <span class="muted" id="kb-import-note"></span>
        </div>
      </div>

      <div class="card" id="kb-upload" style="display:none">
        <h3>⬆ 上传知识文件批量投喂 → ${name}</h3>
        <div class="kb-drop" id="kb-drop">点击选择或拖入知识文件（可多选）<br><span class="muted">支持 .txt / .md、.json、.docx（Word 自动提取正文）与 .png/.jpg/.webp/.gif（图片条目，自动压缩保存并可在列表预览）</span></div>
        <input type="file" id="kb-file" accept=".txt,.md,.markdown,.json,.docx,.png,.jpg,.jpeg,.webp,.gif,.bmp,text/plain,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" multiple hidden>
        <div class="muted" style="line-height:1.8;margin-top:8px">JSON 示例：<code>[{"title":"票据池业务要点","category":"业务规则","paragraphs":["…","…"]}]</code></div>
        <div class="row" style="margin-top:8px"><span class="muted" id="kb-upload-note"></span></div>
      </div>

      <div id="kb-result" style="margin-top:14px"></div>`

    const $id = (id) => root.querySelector('#' + id)
    const showResult = (html) => { $id('kb-result').innerHTML = html }
    const setNote = (id, text) => { const n = root.querySelector(id); if (n) n.textContent = text }
    const toggle = (id) => { const box = root.querySelector(id); box.style.display = box.style.display === 'none' ? 'block' : 'none' }
    const renderStats = () => { const n = $id('kb-stats'); if (n) n.textContent = `内置 ${live().length - customCount()} 篇 · 已投喂 ${customCount()} 篇` }

    const search = (q) => {
      const terms = q.split(/\s+/).filter(Boolean)
      const scored = live().map((doc) => {
        const corpus = [doc.title, doc.summary, ...doc.paragraphs].join('\n').toLowerCase()
        const score = terms.reduce((acc, term) => acc + (corpus.includes(term.toLowerCase()) ? 1 : 0), 0)
        return { doc, score }
      }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
      if (scored.length === 0) {
        return { answer: `${name}中未找到与「${q}」相关的文档，可尝试更换关键词，或点击「粘贴投喂 / 上传文件投喂」扩充知识。`, citations: [], tables: [] }
      }
      const best = scored[0].doc
      return {
        answer: best.paragraphs.join('\n\n'),
        citations: scored.map(({ doc, score }) => ({ id: doc.id, title: doc.title, category: doc.category, score, custom: !!doc.custom })),
        tables: best.tables ?? [],
        docId: best.id,
      }
    }

    const runSearch = () => {
      const q = $id('kb-q').value.trim()
      if (!q) return
      const data = search(q)
      showResult(`
        ${card('检索结果', `
          <div class="answer">${esc(data.answer)}</div>
          ${(data.tables ?? []).map((t) => `<div style="margin-top:12px"><div class="muted" style="margin-bottom:6px">${esc(t.caption)}</div>${table(t.headers, t.rows)}</div>`).join('')}
          <div style="margin-top:12px">${(data.citations ?? []).map((cite, i) => `<div class="cite">[${i + 1}] ${esc(cite.title)}${cite.custom ? '（已投喂）' : ''}<br><span class="muted">类别：${esc(cite.category)} · 相关度 ${cite.score}</span></div>`).join('')}</div>`)}
        ${data.citations?.length ? card('引用文档', table(['编号', '文档标题', '类别', '相关度'], data.citations.map((cite, i) => [i + 1, `${cite.title}${cite.custom ? '（已投喂）' : ''}`, cite.category, cite.score]))) : ''}`)
    }

    const browse = () => {
      const rowsHtml = live().map((doc) => {
        const imgCell = doc.image ? `<img class="kb-img" src="${doc.image}" alt="${esc(doc.title)}" loading="lazy">` : ''
        const preview = imgCell ? `<div class="row" style="gap:8px;align-items:center;min-width:220px">${imgCell}<span>${esc(doc.summary)}</span></div>` : esc(doc.summary)
        return `<tr><td>${esc(doc.id)}</td><td>${esc(doc.title)}${doc.image ? ' <span class="nt-cat">🖼 图片</span>' : ''}</td><td>${esc(doc.category)}${doc.custom ? '（已投喂）' : ''}</td><td>${preview}</td></tr>`
      }).join('')
      showResult(card(`${name}文档`, rowsHtml
        ? `<table><thead><tr><th>文档ID</th><th>标题</th><th>类别</th><th>摘要 / 预览</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
        : '<div class="empty">暂无文档</div>'))
      // 图片点击放大（轻量灯箱）
      root.querySelectorAll('.kb-img').forEach((img) => {
        img.onclick = () => {
          const layer = document.createElement('div')
          layer.className = 'kb-lite'
          layer.innerHTML = `<img src="${img.src}" alt="">`
          layer.onclick = () => layer.remove()
          document.body.append(layer)
        }
      })
    }

    const ingest = async (rawDocs) => {
      const added = addCustomDocs(ns, rawDocs)
      await saveCustomDocs()
      renderStats()
      renderTabs()
      return added
    }

    $id('kb-search').onclick = runSearch
    $id('kb-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch() })
    $id('kb-browse').onclick = browse

    // —— 粘贴投喂 ——
    $id('kb-import-toggle').onclick = () => toggle('#kb-import')
    $id('kb-do-import').onclick = async () => {
      const docs = parseDocBlocks($id('kb-import-text').value)
      if (docs.length === 0) {
        setNote('#kb-import-note', '未识别到文档：请用【标题】… 开头、至少一段正文')
        return
      }
      const added = await ingest(docs)
      setNote('#kb-import-note', `✓ 识别 ${docs.length} 篇，新增 ${added} 篇（重复自动跳过）`)
      if (added > 0) { $id('kb-import-text').value = ''; browse() }
    }
    $id('kb-clear-custom').onclick = async () => {
      const custom = kbCustom(ns)
      custom.forEach((doc) => {
        const index = live().indexOf(doc)
        if (index >= 0) live().splice(index, 1)
      })
      await saveCustomDocs()
      setNote('#kb-import-note', '已清空本知识库的全部投喂内容')
      renderStats()
      renderTabs()
      browse()
    }

    // —— 文件上传投喂 ——
    const uploadFiles = async (files) => {
      const list = Array.from(files || [])
      if (list.length === 0) return
      const note = root.querySelector('#kb-upload-note')
      note.textContent = '正在解析文件…'
      let recognized = 0
      let addedAll = 0
      const errors = []
      for (const file of list) {
        try {
          const lower = file.name.toLowerCase()
          let docs = []
          if (lower.endsWith('.docx')) {
            const lines = await extractDocxText(await readFileAsBuffer(file))
            if (!lines.length) throw new Error('Word 文档中未提取到正文')
            docs = [{ title: file.name.replace(/\.docx$/i, '').trim() || 'Word 文档', category: '业务规则', paragraphs: lines }]
          } else if (/^\.(png|jpe?g|webp|gif|bmp)$/.test(file.name.slice(file.name.lastIndexOf('.')))) {
            const dataUrl = await downscaleImage(await readFileAsDataURL(file))
            const base = file.name.replace(/\.[^.]+$/, '').trim() || '图片知识'
            docs = [{
              title: base,
              category: '图片知识',
              paragraphs: ['（图片条目：图片已保存并在浏览列表预览；建议修改标题说明内容以利检索。如需提取图中文字，可先 OCR/复制文字后粘贴投喂，或接入 OCR 能力。）'],
              image: dataUrl,
            }]
          } else {
            const text = await readFileAsText(file)
            docs = lower.endsWith('.json') ? parseJsonDocs(text) : parseDocBlocks(text)
          }
          if (docs.length === 0) {
            errors.push(`${file.name}：未识别到文档（.txt/.md 需以【标题】分篇，.json 需为文档数组，.docx 需为 Word 文档）`)
            continue
          }
          recognized += docs.length
          addedAll += addCustomDocs(ns, docs)
        } catch (error) {
          errors.push(`${file.name}：${String((error && error.message) || error)}`)
        }
      }
      await saveCustomDocs()
      renderStats()
      renderTabs()
      if (addedAll > 0) browse()
      note.textContent = `✓ 共识别 ${recognized} 篇、新增 ${addedAll} 篇` +
        (errors.length ? `；跳过 ${errors.length} 个文件：${errors.join('；')}` : '')
      const fileInput = root.querySelector('#kb-file')
      if (fileInput) fileInput.value = ''
    }

    const fileInput = $id('kb-file')
    const drop = $id('kb-drop')
    drop.onclick = () => fileInput.click()
    fileInput.onchange = () => uploadFiles(fileInput.files)
    ;['dragenter', 'dragover'].forEach((type) => {
      drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('dragover') })
    })
    ;['dragleave', 'drop'].forEach((type) => {
      drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.remove('dragover') })
    })
    drop.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
    })
    $id('kb-upload-toggle').onclick = () => toggle('#kb-upload')

    renderStats()
  }

  renderTabs()
  renderKb()
}


/* ------------------------------- 数据字典 ------------------------------ */

PAGES.dictionary = async (el) => {
  // 本地化数据字典：内置种子 + 文档导入 + 查询 + 状态管理（离线可用）
  const LS_KEY = 'wt-dict-entries'
  const LS_META = 'wt-dict-meta'

  const SEED = [
    { category: '票据', cn: '票据类型', en: 'Bill Type', code: 'BILL_TYPE', value: '银票' },
    { category: '票据', cn: '票据类型', en: 'Bill Type', code: 'BILL_TYPE', value: '商票' },
    { category: '票据', cn: '票据状态', en: 'Bill Status', code: 'BILL_ST', value: '出票已登记' },
    { category: '票据', cn: '票据状态', en: 'Bill Status', code: 'BILL_ST', value: '已承兑' },
    { category: '票据', cn: '票据状态', en: 'Bill Status', code: 'BILL_ST', value: '已贴现' },
    { category: '票据', cn: '票据状态', en: 'Bill Status', code: 'BILL_ST', value: '已结清' },
    { category: '票据', cn: '承兑方式', en: 'Acceptor Kind', code: 'ACPT_KIND', value: '银行承兑' },
    { category: '票据', cn: '承兑方式', en: 'Acceptor Kind', code: 'ACPT_KIND', value: '商业承兑' },
    { category: '票据', cn: '贴现方式', en: 'Discount Mode', code: 'DISC_MODE', value: '直贴' },
    { category: '票据', cn: '贴现方式', en: 'Discount Mode', code: 'DISC_MODE', value: '转贴现' },
    { category: '客户', cn: '客户类型', en: 'Customer Type', code: 'CUST_TYPE', value: '企业客户' },
    { category: '客户', cn: '客户类型', en: 'Customer Type', code: 'CUST_TYPE', value: '个人客户' },
    { category: '客户', cn: '客户状态', en: 'Customer Status', code: 'CUST_ST', value: '正常' },
    { category: '结算', cn: '币种', en: 'Currency', code: 'CUR', value: '人民币' },
    { category: '结算', cn: '结算方式', en: 'Settle Mode', code: 'SETTLE_MODE', value: '银企直连' },
    { category: '系统', cn: '数据状态', en: 'Data Status', code: 'DATA_ST', value: '有效' },
    { category: '系统', cn: '数据状态', en: 'Data Status', code: 'DATA_ST', value: '停用' },
  ]
  const norm = (x) => String(x ?? '').trim()
  const load = () => {
    try { const raw = JSON.parse(localStorage.getItem(LS_KEY)); if (Array.isArray(raw)) return raw } catch (e) { /* ignore */ }
    const seed = SEED.map((x, i) => ({ id: 'b' + (i + 1), source: '内置', active: true, updatedAt: 0, ...x }))
    try { localStorage.setItem(LS_KEY, JSON.stringify(seed)) } catch (e) { /* ignore */ }
    return seed
  }
  const save = (list) => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch (e) { /* ignore */ } }
  const metaLoad = () => { try { return JSON.parse(localStorage.getItem(LS_META)) || null } catch (e) { return null } }
  const metaSave = (m) => { try { localStorage.setItem(LS_META, JSON.stringify(m)) } catch (e) { /* ignore */ } }

  let entries = load()
  let meta = metaLoad()
  let filterCat = '全部'
  let filterStatus = '全部'
  let kw = ''

  el.innerHTML = `
    <div class="section-title">数据字典 <span class="muted">导入文档 · 查询 · 字典状态</span></div>

    <div class="card" style="margin-bottom:12px">
      <h3>📊 字典状态 <span class="muted" id="dd-meta"></span></h3>
      <div class="row" id="dd-stats" style="margin-bottom:6px"></div>
      <div class="row" style="gap:6px;flex-wrap:wrap" id="dd-cats"></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="row" style="margin-bottom:8px;gap:6px;flex-wrap:wrap">
        <input type="text" id="dict-q" placeholder="🔍 输入 中文名 / 英文名 / 编码 / 属性值 查询" style="flex:1;min-width:200px">
        <select id="dd-status" style="width:auto">
          <option value="全部">状态：全部</option><option value="启用">状态：启用</option><option value="停用">状态：停用</option>
        </select>
        <button class="btn" id="dict-import-toggle">⬆ 导入文档</button>
      </div>
      <div id="dict-import" style="display:none;margin-top:8px">
        <div class="muted" style="line-height:1.8;margin-bottom:6px">导入格式（.txt / .json / .csv）：每行 <b>中文名 | 英文名 | 编码 | 属性值 | 分类</b>；或 JSON 数组 [{"cn":"…","en":"…","code":"…","value":"…","category":"…"}]</div>
        <textarea id="dict-payload" rows="4" placeholder="票据状态 | Bill Status | BILL_ST | 已承兑 | 票据&#10;…或直接拖/选文件："></textarea>
        <div class="row" style="margin-top:8px">
          <button class="btn primary" id="dict-do-import">导入解析</button>
          <button class="btn" id="dict-file-btn">📁 选择文件</button>
          <input type="file" id="dict-file" accept=".txt,.json,.csv,text/plain,application/json" hidden>
          <span class="muted" id="dict-import-note"></span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>字典条目 <span class="muted" id="dict-total"></span></h3>
      <div id="dict-body"></div>
    </div>`

  const $id = (id) => el.querySelector('#' + id)

  const render = () => {
    const list = entries.filter((e) => {
      if (filterCat !== '全部' && e.category !== filterCat) return false
      if (filterStatus === '启用' && !e.active) return false
      if (filterStatus === '停用' && e.active) return false
      if (kw) {
        const hay = `${e.cn} ${e.en} ${e.code} ${e.value} ${e.category}`.toLowerCase()
        if (!hay.includes(kw.toLowerCase())) return false
      }
      return true
    })
    const activeTotal = entries.filter((e) => e.active).length
    const catSet = [...new Set(entries.map((e) => e.category))]
    const stat = {
      total: entries.length,
      builtin: entries.filter((e) => e.source === '内置').length,
      imported: entries.filter((e) => e.source === '导入').length,
      enabled: activeTotal,
    }
    $id('dd-stats').innerHTML = [
      `<span class="stat-chip">总条目 <b>${stat.total}</b></span>`,
      `<span class="stat-chip">内置 <b>${stat.builtin}</b></span>`,
      `<span class="stat-chip">已导入 <b style="color:var(--accent)">${stat.imported}</b></span>`,
      `<span class="stat-chip">启用 <b style="color:var(--green)">${stat.enabled}</b></span>`,
      `<span class="stat-chip">停用 <b style="color:var(--red)">${stat.total - stat.enabled}</b></span>`,
    ].join('')
    $id('dd-meta').textContent = meta ? `最近导入：${meta.name || '文档'} · ${new Date(meta.time).toLocaleString('zh-CN', { hour12: false })}（共 ${meta.count} 条）` : '暂无导入记录'
    $id('dd-cats').innerHTML = ['全部', ...catSet].map((c) => {
      const n = c === '全部' ? entries.length : entries.filter((e) => e.category === c).length
      return `<button class="btn sm tag-chip ${filterCat === c ? 'active' : ''}" data-c="${c}">${c} (${n})</button>`
    }).join('')
    $id('dict-total').textContent = `显示 ${list.length} / ${entries.length} 条`
    $id('dict-body').innerHTML = list.length
      ? list.map((e) => {
          const badge = e.source === '内置' ? '<span class="tag blue">内置</span>' : '<span class="tag green">已导入</span>'
          const stBadge = e.active ? '<span class="tag" style="background:#e8f7ee;color:var(--green)">启用</span>' : '<span class="tag" style="background:#fdeaea;color:var(--red)">停用</span>'
          const act = e.source === '导入' ? `
            <button class="btn sm" data-id="${e.id}" data-act="toggle">${e.active ? '停用' : '启用'}</button>
            <button class="btn sm danger" data-id="${e.id}" data-act="del">✕</button>` : ''
          return `
          <div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
            <div style="min-width:280px">
              <div><b>${esc(e.cn)}</b>${e.en ? ' <span class="muted">' + esc(e.en) + '</span>' : ''} ${badge} ${stBadge} <span class="nt-cat">${esc(e.category)}</span></div>
              <div class="muted" style="font-size:12px">${esc(e.code)}${e.value ? ' = ' + esc(e.value) : ''}${e.updatedAt ? ' · ' + new Date(e.updatedAt).toLocaleString('zh-CN', { hour12: false }) : ''}</div>
            </div>
            <div class="row" style="gap:4px">${act}</div>
          </div>`
        }).join('')
      : '<div class="empty">无匹配字典条目</div>'

    $id('dict-body').querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => {
        const e = entries.find((x) => x.id === b.dataset.id)
        if (!e) return
        if (b.dataset.act === 'toggle') e.active = !e.active
        else entries = entries.filter((x) => x.id !== e.id)
        e.updatedAt = Date.now()
        save(entries)
        render()
      }
    })
    $id('dd-cats').querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => { filterCat = b.dataset.c; render() }
    })
  }

  $id('dict-q').addEventListener('input', (e) => { kw = e.target.value; render() })
  $id('dd-status').addEventListener('change', (e) => { filterStatus = e.target.value; render() })

  const parsePayload = (text) => {
    const raw = String(text).trim()
    if (!raw) return { added: [], skipped: 0, error: '' }
    // JSON 数组
    if (raw.startsWith('[')) {
      try {
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) throw new Error('顶层应为数组')
        return arr.map((x) => ({ category: norm(x.category) || '其他', cn: norm(x.cn), en: norm(x.en), code: norm(x.code), value: norm(x.value) }))
      } catch (e) { return { added: [], skipped: 0, error: 'JSON 解析失败：' + e.message } }
    }
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[|,\t]+/).map(norm)
      return { cn: parts[0] || '', en: parts[1] || '', code: parts[2] || '', value: parts[3] || '', category: parts[4] || '其他' }
    })
  }

  const doImport = (rawDocs, name) => {
    let added = 0, skipped = 0, error = ''
    const existing = new Set(entries.map((e) => `${e.cn}|${e.code}|${e.value}`))
    for (const doc of rawDocs) {
      if (typeof doc === 'string') { error = doc; return { added, skipped, error } }
      if (!doc.cn || !doc.code) { skipped += 1; continue }
      const key = `${doc.cn}|${doc.code}|${doc.value}`
      if (existing.has(key)) { skipped += 1; continue }
      existing.add(key)
      entries.push({ id: 'i' + Date.now() + '-' + added, source: '导入', active: true, updatedAt: Date.now(), ...doc })
      added += 1
    }
    if (added) {
      meta = { name, time: Date.now(), count: added }
      metaSave(meta)
      save(entries)
    }
    return { added, skipped, error }
  }

  $id('dict-import-toggle').onclick = () => { const box = $id('dict-import'); box.style.display = box.style.display === 'none' ? 'block' : 'none' }
  $id('dict-do-import').onclick = () => {
    const docs = parsePayload($id('dict-payload').value)
    if (docs.error) { $id('dict-import-note').textContent = docs.error; return }
    const r = doImport(docs, '粘贴导入')
    $id('dict-import-note').textContent = r.error || `✓ 新增 ${r.added} 条，跳过 ${r.skipped} 条重复`
    if (r.added) { $id('dict-payload').value = ''; render() }
  }
  $id('dict-file-btn').onclick = () => $id('dict-file').click()
  $id('dict-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const docs = parsePayload(text)
      if (docs.error) { $id('dict-import-note').textContent = docs.error; return }
      const r = doImport(docs, file.name)
      $id('dict-import-note').textContent = r.error || `✓ 文件「${file.name}」新增 ${r.added} 条，跳过 ${r.skipped} 条重复`
      if (r.added) render()
    } catch (err) {
      $id('dict-import-note').textContent = '读取文件失败：' + String(err && err.message || err)
    }
  })

  render()
}


/* -------------------------------- 健康提醒 ------------------------------ */

// 健康提醒（参考喝水提醒 / 小日常 / Habitify：多时段自定义、打卡与连续、统计、通知+铃声）
const REM_KEY = 'wt-rem-cfg'
const REM_LOG = 'wt-rem-log'
function remDef() {
  return {
    water: { label: '喝水', icon: '💧', on: true, times: ['09:00', '10:30', '12:30', '14:00', '16:00', '18:00', '20:00', '22:00'] },
    move: { label: '运动', icon: '🏃', on: true, times: ['10:00', '15:30', '19:30'] },
    rest: { label: '休息', icon: '😴', on: true, times: ['11:00', '15:00', '17:30', '21:30'] },
  }
}
function remLoadCfg() { try { const c = JSON.parse(localStorage.getItem(REM_KEY)); if (c && c.water && c.move && c.rest) return c } catch (e) { /* ignore */ } const d = remDef(); remSaveCfg(d); return d }
function remSaveCfg(c) { try { localStorage.setItem(REM_KEY, JSON.stringify(c)) } catch (e) { /* ignore */ } }
function remLoadLog() { try { const l = JSON.parse(localStorage.getItem(REM_LOG)); return l && typeof l === 'object' ? l : {} } catch (e) { return {} } }
function remSaveLog(l) { try { localStorage.setItem(REM_LOG, JSON.stringify(l)) } catch (e) { /* ignore */ } }
function remNow() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` } }

let remRenderHook = null
let remCfg = remLoadCfg()
let remLog = remLoadLog()
const remAudio = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = remAudio.ctx || (remAudio.ctx = AC ? new AC() : null)
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    const t = ctx.currentTime
    o.type = 'sine'
    o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1100, t + 0.12)
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.start(t); o.stop(t + 0.5)
  } catch (e) { /* ignore */ }
}
const remToast = (text) => {
  try {
    const node = document.createElement('div')
    node.className = 'rem-toast'
    node.textContent = text
    document.body.appendChild(node)
    setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node) }, 4200)
  } catch (e) { /* ignore */ }
}
const remLogPush = (kind, source) => {
  const c = remCfg[kind]
  const now = remNow()
  const key = `${now.date} ${now.time} ${kind}`
  if (remLog[key]) return false
  remLog[key] = { kind, label: c.label, icon: c.icon, source: source || '自动', ts: Date.now() }
  remSaveLog(remLog)
  return true
}
function remFire(kind, source) {
  const c = remCfg[kind]
  if (!c) return
  const ok = remLogPush(kind, source)
  if (!ok) return
  const msg = `${c.icon} ${c.label}提醒：到点了，${c.label === '喝水' ? '喝杯水吧' : c.label === '运动' ? '起来活动一下吧' : '休息一下，放松眼睛与肩颈'}`
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`${c.label}提醒`, { body: msg })
    }
  } catch (e) { /* ignore */ }
  remAudio()
  remToast(`${c.label}提醒 · ${remNow().time}`)
  if (remRenderHook) remRenderHook()
}
function remTick() {
  if (document.hidden) return
  const now = remNow()
  for (const kind of Object.keys(remCfg)) {
    const c = remCfg[kind]
    if (!c.on || !c.times.includes(now.time)) continue
    remFire(kind, '自动')
  }
}
setInterval(remTick, 15000)

function remStreak() {
  const p = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  let n = 0
  const base = new Date()
  for (;;) {
    const keyDate = p(new Date(base.getTime() - n * 86400000))
    const hit = Object.keys(remLog).some((k) => k.startsWith(keyDate))
    if (hit) n += 1
    else break
  }
  return n
}

PAGES.health = (el) => {
  const today = remNow().date
  const render = () => {
    const logsToday = Object.entries(remLog).filter(([k]) => k.startsWith(today)).map(([, v]) => v)
    const byKind = {}
    for (const v of logsToday) byKind[v.kind] = (byKind[v.kind] || 0) + 1
    const order = ['water', 'move', 'rest']

    el.innerHTML = `
      <div class="section-title">健康提醒 <span class="muted">到点提醒喝水 / 运动 / 休息 · 可自定义时间</span></div>

      <div class="card" style="margin-bottom:12px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <span class="stat-chip">今日提醒 <b>${logsToday.length}</b> 次</span>
            ${order.map((k) => `<span class="stat-chip">${remCfg[k].icon} ${remCfg[k].label} <b>${byKind[k] || 0}</b></span>`).join('')}
            <span class="stat-chip">连续打卡 <b style="color:var(--green)">${remStreak()}</b> 天</span>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn" id="rem-notify">🔔 开启系统通知</button>
            <span class="muted" id="rem-notify-state">${typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '系统通知：已允许' : '系统通知：未开启'}</span>
          </div>
        </div>
        <div class="muted" style="margin-top:6px">页面打开时到点会响铃提示；开启系统通知后，即使不在本页也会收到系统通知。</div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
        ${order.map((kind) => {
          const c = remCfg[kind]
          const next = c.times.filter((t) => t >= remNow().time).sort()[0] || c.times[0] || '—'
          return `
          <div class="card" style="margin-bottom:0">
            <div class="row" style="justify-content:space-between;align-items:center">
              <h3 style="margin:0">${c.icon} ${c.label}提醒</h3>
              <label class="rem-switch"><input type="checkbox" data-k="${kind}" ${c.on ? 'checked' : ''}><span></span></label>
            </div>
            <div class="row" style="flex-wrap:wrap;gap:6px;margin:8px 0" data-times="${kind}">
              ${c.times.length ? c.times.map((t) => `<span class="rem-chip">${t} <b data-del="${kind}|${t}">✕</b></span>`).join('') : '<span class="muted">未设置时间</span>'}
            </div>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              <input type="time" id="rem-in-${kind}">
              <button class="btn sm" data-add="${kind}">添加</button>
              <button class="btn sm" data-now="${kind}" title="立即触发一次提醒/打卡">现在</button>
            </div>
            <div class="muted" style="font-size:12px;margin-top:6px">下次：${next}</div>
          </div>`
        }).join('')}
      </div>

      <div class="card" style="margin-top:12px">
        <h3>📖 今日提醒记录</h3>
        ${logsToday.length ? logsToday.sort((a, b) => a.ts - b.ts).map((v) => `<div class="row" style="justify-content:space-between;padding:6px 2px;border-bottom:1px solid var(--border)"><span>${v.icon} ${v.label}</span><span class="muted">${new Date(v.ts).toLocaleTimeString('zh-CN', { hour12: false })} · ${v.source === '手动' ? '手动打卡' : '自动提醒'}</span></div>`).join('') : '<div class="empty">今天还没有提醒/打卡记录</div>'}
      </div>`

    // 开关
    el.querySelectorAll('input[data-k]').forEach((sw) => {
      sw.onchange = () => { remCfg[sw.dataset.k].on = sw.checked; remSaveCfg(remCfg) }
    })
    // 添加 / 删除 / 立即
    el.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => {
        const kind = b.dataset.add
        const val = el.querySelector('#rem-in-' + kind).value
        if (!val) return
        if (!remCfg[kind].times.includes(val)) { remCfg[kind].times.push(val); remCfg[kind].times.sort(); remSaveCfg(remCfg) }
        render()
      }
    })
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = () => {
        const [kind, t] = b.dataset.del.split('|')
        remCfg[kind].times = remCfg[kind].times.filter((x) => x !== t)
        remSaveCfg(remCfg)
        render()
      }
    })
    el.querySelectorAll('[data-now]').forEach((b) => {
      b.onclick = () => remFire(b.dataset.now, '手动')
    })
    // 系统通知
    const notifyBtn = el.querySelector('#rem-notify')
    notifyBtn.onclick = async () => {
      if (typeof Notification === 'undefined') {
        el.querySelector('#rem-notify-state').textContent = '当前浏览器不支持系统通知'
        return
      }
      const st = await Notification.requestPermission()
      el.querySelector('#rem-notify-state').textContent = st === 'granted' ? '系统通知：已允许' : (st === 'denied' ? '系统通知：已拒绝（请在浏览器设置中允许）' : '系统通知：未开启')
    }
  }

  remRenderHook = () => { if (el.isConnected) render() }
  render()
}

/* -------------------------------- 记事本（印象笔记风） ------------------ */

// 存储：IndexedDB —— 笔记列表(键 all) + 笔记本列表(键 notebooks)
const NOTE_DB = 'wangtie-os-notes'
const NOTE_STORE = 'items'
const NOTE_DEFAULT_NB = ['默认笔记本', '开发速记', '票据业务', '会计']
let notesSeq = 0
// 会话级记忆：切换模块后再回来，仍停留原笔记本/选中笔记/模式
const NOTE_SESSION = { scope: 'all', nb: null, q: '', tag: '', sel: null, mode: 'edit' }

function openNotesDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOTE_DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(NOTE_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbNotesGet(key) {
  try {
    const db = await openNotesDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTE_STORE, 'readonly')
      const rq = tx.objectStore(NOTE_STORE).get(key)
      rq.onsuccess = () => resolve(rq.result)
      rq.onerror = () => reject(rq.error)
    })
  } catch (error) { return undefined }
}

async function idbNotesSet(key, value) {
  const db = await openNotesDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(NOTE_STORE, 'readwrite')
    const rq = tx.objectStore(NOTE_STORE).put(value, key)
    rq.onsuccess = () => resolve()
    rq.onerror = () => reject(rq.error)
  })
}

function freshNote(notebook) {
  const t = Date.now()
  return { id: `n${t}-${++notesSeq}`, title: '', notebook: notebook || '默认笔记本', tags: [], content: '', pinned: false, createdAt: t, updatedAt: t, deletedAt: null }
}

async function loadAllNotes() {
  const raw = await idbNotesGet('all')
  if (!Array.isArray(raw)) return []
  return raw.map((n) => {
    if (!n || typeof n !== 'object') return null
    // 兼容旧版笔记字段（category → notebook）
    if (n.notebook === undefined) {
      n.notebook = n.category && NOTE_DEFAULT_NB.includes(n.category) ? n.category : (n.category || '默认笔记本')
      n.tags = []; n.pinned = false; n.createdAt = n.updatedAt || Date.now(); n.deletedAt = null
    }
    n.tags = Array.isArray(n.tags) ? n.tags : String(n.tags || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    n.pinned = !!n.pinned
    return n
  }).filter(Boolean)
}

const saveAllNotes = (list) => idbNotesSet('all', list)

async function loadNotebooks() {
  const raw = await idbNotesGet('notebooks')
  const list = Array.isArray(raw) && raw.length ? raw : [...NOTE_DEFAULT_NB]
  if (!Array.isArray(raw) || !raw.length) await saveNotebooks(list)
  return list
}
const saveNotebooks = (list) => idbNotesSet('notebooks', list)

// 下载文件
function downloadFile(filename, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = filename
  a.click()
}

// ---------- 简易 Markdown 渲染（预览） ----------
function mdInline(str) {
  let s = esc(String(str || ''))
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return s
}

function mdToHtml(md) {
  const lines = String(md || '').split(/\n/)
  const out = []
  let para = []
  let codeLines = null
  let listKind = null

  const closeList = () => { if (listKind) { out.push(listKind === 'ul' ? '</ul>' : '</ol>'); listKind = null } }
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(mdInline).join('<br>') + '</p>'); para = [] } }

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (codeLines !== null) {
      if (/^\s*```/.test(line)) { out.push('<pre><code>' + codeLines.join('\n') + '</code></pre>'); codeLines = null }
      else codeLines.push(esc(line))
      continue
    }
    if (/^\s*```/.test(line)) { flushPara(); closeList(); codeLines = []; continue }
    const t = line.trim()
    if (t === '') { flushPara(); closeList(); continue }

    const mH = /^(#{1,6})\s+(.*)$/.exec(t)
    if (mH) { flushPara(); closeList(); out.push(`<h${mH[1].length}>${mdInline(mH[2])}</h${mH[1].length}>`); continue }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); out.push('<hr>'); continue }
    if (/^>\s?/.test(t)) { flushPara(); closeList(); out.push(`<blockquote>${mdInline(t.replace(/^>\s?/, ''))}</blockquote>`); continue }

    const mUL = /^\s*[-*+]\s+(.*)$/.exec(line)
    const mOL = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (mUL || mOL) {
      flushPara()
      const kind = mUL ? 'ul' : 'ol'
      if (listKind !== kind) { closeList(); out.push(kind === 'ul' ? '<ul>' : '<ol>'); listKind = kind }
      out.push('<li>' + mdInline((mUL ? mUL[1] : mOL[1])) + '</li>')
      continue
    }
    closeList()
    para.push(line)
  }
  flushPara()
  closeList()
  if (codeLines !== null) out.push('<pre><code>' + codeLines.join('\n') + '</code></pre>')
  return out.join('\n')
}

function notePlainText(content) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`/g, '')
    .replace(/[*_#>-]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- 页面 ----------
PAGES.notes = async (el) => {
  const notes = await loadAllNotes()
  const notebooks = await loadNotebooks()
  // 兼容旧笔记：把笔记中出现的笔记本名并入列表
  let changed = false
  for (const n of notes) {
    if (n.notebook && !notebooks.includes(n.notebook)) { notebooks.push(n.notebook); changed = true }
  }
  if (changed) void saveNotebooks(notebooks)

  // 视图状态（模块级变量，保留在本次会话内多次进出）
  const V = {
    scope: NOTE_SESSION.scope,
    nb: NOTE_SESSION.nb,
    q: NOTE_SESSION.q,
    tag: NOTE_SESSION.tag,
    sel: NOTE_SESSION.sel,
    mode: NOTE_SESSION.mode,
    timer: null,
  }

  const fmtTime = (ts) => {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const byId = (id) => notes.find((n) => n.id === id) || null
  const current = () => (V.sel ? byId(V.sel) : null)
  const activeNotes = () => notes.filter((n) => (V.scope === 'trash' ? n.deletedAt != null
    : V.scope === 'nb' ? n.deletedAt == null && n.notebook === V.nb
    : n.deletedAt == null))

  const allTags = () => [...new Set(activeNotes().flatMap((n) => n.tags))].sort()

  el.innerHTML = `
    <div class="section-title">记事本 <span class="muted" id="en-stats"></span></div>
    <div class="en-wrap">
      <aside class="en-side card">
        <div class="en-side-head">📒 笔记本
          <button class="btn sm" id="nb-add" title="新建笔记本">＋</button>
        </div>
        <div id="nb-tree"></div>
        <div class="en-side-foot">
          <button class="btn sm" id="nb-export">⬇ 导出备份</button>
          <button class="btn sm" id="nb-import">⬆ 导入备份</button>
          <input type="file" id="nb-file" accept=".json,application/json" hidden>
        </div>
      </aside>

      <section class="en-mid card">
        <div class="en-mid-head">
          <input type="text" id="en-search" placeholder="搜索笔记…">
          <button class="btn primary sm" id="en-new">＋ 新建</button>
        </div>
        <div id="en-tags" class="en-tags"></div>
        <div id="en-list"></div>
      </section>

      <section class="en-editor card" id="en-editor"></section>
    </div>`

  const $id = (id) => el.querySelector('#' + id)
  const showStats = () => {
    const total = notes.filter((n) => n.deletedAt == null).length
    const trash = notes.length - total
    const node = $id('en-stats')
    if (node) node.textContent = `${total} 篇笔记${trash ? ' · 回收站 ' + trash : ''} · 数据保存在本机`
  }

  const persist = async () => {
    try { await saveAllNotes(notes) } catch (error) { /* ignore */ }
  }

  // ============ 左侧：笔记本树 ============
  const renderSide = () => {
    const activeTotal = notes.filter((n) => n.deletedAt == null).length
    const trashTotal = notes.length - activeTotal
    const rows = [
      { key: 'all', name: '📂 全部笔记', count: activeTotal, cls: V.scope === 'all' },
      { key: 'trash', name: '🗑 回收站', count: trashTotal, cls: V.scope === 'trash' },
    ]
    const nbRows = notebooks.map((nb) => {
      const count = notes.filter((n) => n.deletedAt == null && n.notebook === nb).length
      return { key: 'nb:' + nb, name: nb, count, cls: V.scope === 'nb' && V.nb === nb }
    })
    let html = rows.map((r) => `
      <div class="en-nb-item ${r.cls ? 'active' : ''}" data-scope="${r.key}">
        <span class="en-nb-name">${esc(r.name)}</span><span class="en-nb-count">${r.count}</span>
      </div>`).join('')
    html += '<div class="en-nb-group">笔记本</div>'
    html += nbRows.map((r) => `
      <div class="en-nb-item ${r.cls ? 'active' : ''}" data-scope="${r.key}">
        <span class="en-nb-name">${esc(r.name)}</span><span class="en-nb-count">${r.count}</span>
      </div>`).join('')
    $id('nb-tree').innerHTML = html
    $id('nb-tree').querySelectorAll('.en-nb-item').forEach((item) => {
      item.onclick = () => {
        const scope = item.dataset.scope
        if (scope === 'all') { V.scope = 'all'; V.nb = null }
        else if (scope === 'trash') { V.scope = 'trash'; V.nb = null }
        else { V.scope = 'nb'; V.nb = scope.slice(3) }
        V.tag = ''
        V.sel = null
        renderSide(); renderTags(); renderList(); renderEditor()
      }
    })
  }

  // ============ 标签过滤 ============
  const renderTags = () => {
    const tags = allTags()
    const box = $id('en-tags')
    if (!tags.length) { box.style.display = 'none'; return }
    box.style.display = 'flex'
    box.innerHTML = (V.tag ? `<button class="btn sm tag-chip active" data-tag="">✕ 清空</button>` : '') +
      tags.map((t) => `<button class="btn sm tag-chip ${V.tag === t ? 'active' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')
    box.querySelectorAll('.tag-chip').forEach((b) => {
      b.onclick = () => { V.tag = b.dataset.tag; renderTags(); renderList() }
    })
  }

  // ============ 中间：笔记列表 ============
    NOTE_SESSION.scope = V.scope
    NOTE_SESSION.nb = V.nb
    NOTE_SESSION.q = V.q
    NOTE_SESSION.tag = V.tag
    NOTE_SESSION.sel = V.sel
    NOTE_SESSION.mode = V.mode
  const renderList = () => {
    const kw = V.q.trim().toLowerCase()
    let list = activeNotes()
    if (V.tag) list = list.filter((n) => n.tags.includes(V.tag))
    if (kw) list = list.filter((n) => (n.title + ' ' + notePlainText(n.content)).toLowerCase().includes(kw))
    list.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt))

    const box = $id('en-list')
    if (!list.length) {
      box.innerHTML = `<div class="empty">${V.scope === 'trash' ? '回收站是空的' : (kw || V.tag ? '无匹配笔记' : '还没有笔记，点「＋ 新建」开始记录')}</div>`
      return
    }
    box.innerHTML = list.map((n) => {
      const snippet = notePlainText(n.content)
      const tagHtml = n.tags.length ? `<div class="en-card-tags">${n.tags.map((t) => `<span class="nt-cat">#${esc(t)}</span>`).join('')}</div>` : ''
      return `
      <div class="en-note ${V.sel === n.id ? 'active' : ''}" data-id="${n.id}">
        <div class="en-card-top">
          <span class="en-card-title">${n.pinned ? '📌 ' : ''}${esc(n.title || '未命名笔记')}</span>
          <span class="muted en-card-time">${n.pinned ? '置顶' : fmtTime(n.updatedAt)}</span>
        </div>
        <div class="en-card-snippet">${esc(snippet.slice(0, 48) || '（空笔记）')}</div>
        ${tagHtml}
      </div>`
    }).join('')
    box.querySelectorAll('.en-note').forEach((item) => {
      item.onclick = () => { V.sel = item.dataset.id; renderList(); renderEditor() }
    })
  }

  // ============ 右侧：编辑器 ============
    NOTE_SESSION.scope = V.scope
    NOTE_SESSION.nb = V.nb
    NOTE_SESSION.q = V.q
    NOTE_SESSION.tag = V.tag
    NOTE_SESSION.sel = V.sel
    NOTE_SESSION.mode = V.mode
  const renderEditor = () => {
    const note = current()
    const box = $id('en-editor')
    if (!note) {
      box.innerHTML = `<div class="empty" style="min-height:420px">${V.scope === 'trash' ? '在回收站中选择笔记可恢复或彻底删除' : '在左侧笔记本或中间列表选择笔记，或点击「＋ 新建」'}</div>`
      return
    }
    const titleHtml = esc(note.title)
    box.innerHTML = `
      <div class="en-editor-head">
        <input type="text" class="en-title" id="en-title" value="${titleHtml}" placeholder="笔记标题">
        <div class="row" style="gap:6px">
          <select id="en-notebook" style="width:auto">
            ${notebooks.map((nb) => `<option ${nb === note.notebook ? 'selected' : ''}>${esc(nb)}</option>`).join('')}
          </select>
          <button class="btn sm" id="en-pin" title="置顶">${note.pinned ? '📌 已置顶' : '置顶'}</button>
          ${note.deletedAt != null
            ? `<button class="btn primary sm" id="en-restore">恢复</button>
               <button class="btn danger sm" id="en-del-forever">彻底删除</button>`
            : `<button class="btn danger sm" id="en-del">删除（回收站）</button>`}
        </div>
      </div>
      <div class="en-meta muted">
        ${note.deletedAt != null ? '回收站 · ' : ''}创建 ${fmtTime(note.createdAt)} · 更新 ${fmtTime(note.updatedAt)} · ${note.content.length} 字符
        <span id="en-save-state"></span>
      </div>
      <div class="row en-toolbar">
        <div class="tool-tabs" style="margin:0">
          <button class="tool-tab ${V.mode === 'edit' ? 'active' : ''}" id="en-mode-edit">编辑</button>
          <button class="tool-tab ${V.mode === 'preview' ? 'active' : ''}" id="en-mode-preview">预览</button>
        </div>
        ${note.deletedAt == null && V.mode === 'edit' ? `
        <span class="row" style="gap:4px;flex:1">
          <button class="btn sm" data-md="h">H</button>
          <button class="btn sm" data-md="b">B</button>
          <button class="btn sm" data-md="i">I</button>
          <button class="btn sm" data-md="code">{}代码</button>
          <button class="btn sm" data-md="ul">• 列表</button>
          <button class="btn sm" data-md="ol">1. 列表</button>
          <button class="btn sm" data-md="link">🔗链接</button>
        </span>` : ''}
        <button class="btn sm" id="en-export">⬇ 导出 .md</button>
      </div>
      ${V.mode === 'preview' ? `<div class="md-preview" id="en-preview"></div>` : `<textarea id="en-content" rows="16" placeholder="写点什么…（支持 Markdown：标题/加粗/列表/代码块/链接）"${note.deletedAt != null ? ' readonly' : ''}>${esc(note.content)}</textarea>`}
      <div class="muted en-foot">支持 Markdown 写作 · 自动保存 · 删除进回收站 · 可导出 .md / 备份 .json</div>`

    const saveState = (text) => { const n = $id('en-save-state'); if (n) n.textContent = text || '' }

    const commit = (flush) => {
      if (!current()) return
      const t = $id('en-title')
      const c = $id('en-content')
      const nb = $id('en-notebook')
      const note0 = current()
      if (t) note0.title = t.value.trim() || '未命名笔记'
      if (nb) note0.notebook = nb.value
      if (c) note0.content = c.value
      note0.updatedAt = Date.now()
      if (flush) { void persist(); saveState('✓ 已保存 ' + fmtTime(Date.now())) }
    }

    const schedule = () => {
      const cur = current()
      if (!cur || cur.deletedAt != null) return
      if (V.timer) clearTimeout(V.timer)
      commit(false)
      saveState('输入中…（自动保存）')
      V.timer = setTimeout(() => { commit(true); renderList(); renderTags() }, 700)
    }

    // 编辑/预览切换
    $id('en-mode-edit').onclick = () => { commit(true); V.mode = 'edit'; renderEditor(); focusContent() }
    $id('en-mode-preview').onclick = () => { commit(true); V.mode = 'preview'; renderEditor() }
    if (V.mode === 'preview') {
      $id('en-preview').innerHTML = mdToHtml(note.content)
    }
    if (V.mode === 'edit') {
      const textarea = $id('en-content')
      textarea.addEventListener('input', schedule)
      textarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); commit(true); saveState('✓ 已保存 ' + fmtTime(Date.now())) }
      })
    }
    const titleInput = $id('en-title')
    if (titleInput) titleInput.addEventListener('input', schedule)
    const nbSel = $id('en-notebook')
    if (nbSel) nbSel.addEventListener('change', () => { commit(true); renderList(); renderEditor() })

    // Markdown 快捷插入
    const insert = (before, after) => {
      const ta = $id('en-content')
      if (!ta) return
      const s0 = ta.selectionStart, s1 = ta.selectionEnd
      const selText = ta.value.slice(s0, s1)
      ta.value = ta.value.slice(0, s0) + before + selText + after + ta.value.slice(s1)
      const pos = s0 + before.length + selText.length
      ta.focus(); ta.setSelectionRange(pos, pos + after.length)
      ta.dispatchEvent(new Event('input'))
    }
    box.querySelectorAll('[data-md]').forEach((b) => {
      b.onclick = () => {
        const map = {
          h: ['## ', ''], b: ['**', '**'], i: ['*', '*'],
          code: ['```\n', '\n```'], ul: ['- ', ''], ol: ['1. ', ''], link: ['[', '](https://)'],
        }
        const [p, s] = map[b.dataset.md]
        insert(p, s)
      }
    })

    $id('en-pin').onclick = () => { note.pinned = !note.pinned; void persist(); renderList(); renderEditor() }
    if ($id('en-del')) $id('en-del').onclick = () => { note.deletedAt = Date.now(); V.sel = null; void persist(); renderList(); renderEditor() }
    if ($id('en-restore')) $id('en-restore').onclick = () => { note.deletedAt = null; note.updatedAt = Date.now(); void persist(); renderList(); renderEditor() }
    if ($id('en-del-forever')) $id('en-del-forever').onclick = async () => {
      if (!window.confirm(`彻底删除「${note.title}」？此操作不可恢复。`)) return
      const idx = notes.indexOf(note)
      if (idx >= 0) notes.splice(idx, 1)
      V.sel = null
      await persist()
      renderSide(); renderList(); renderEditor()
    }
    $id('en-export').onclick = () => downloadFile(`${note.title || 'note'}.md`, note.content, 'text/markdown;charset=utf-8')
  }

  const focusContent = () => { const c = $id('en-content'); if (c) c.focus() }

  // 新建 / 搜索
  $id('en-new').onclick = () => {
    if (V.scope === 'trash') return
    const nb = V.scope === 'nb' ? V.nb : '默认笔记本'
    const note = freshNote(nb)
    notes.unshift(note)
    V.sel = note.id
    V.mode = 'edit'
    void persist()
    renderSide(); renderList(); renderTags(); renderEditor()
    const t = $id('en-title')
    if (t) t.focus()
  }
  $id('en-search').addEventListener('input', (e) => { V.q = e.target.value; renderList() })

  // 笔记本：新建
  $id('nb-add').onclick = () => {
    const name = window.prompt('新笔记本名称：', '')
    if (!name || !name.trim()) return
    const nb = name.trim()
    if (notebooks.includes(nb)) return
    notebooks.push(nb)
    void saveNotebooks(notebooks)
    renderSide()
  }

  // 导出 / 导入备份
  $id('nb-export').onclick = () => {
    downloadFile('记事本备份.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notebooks, notes }, null, 2), 'application/json')
  }
  $id('nb-import').onclick = () => { $id('nb-file').click() }
  $id('nb-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const data = JSON.parse(text)
      const list = Array.isArray(data) ? data : (Array.isArray(data.notes) ? data.notes : null)
      if (!list) throw new Error('备份格式不正确（应为笔记数组或 {notes:[...]}）')
      let added = 0
      for (const item of list) {
        if (!item || !item.title) continue
        const dup = notes.some((n) => n.id === item.id)
        const n = dup ? byId(item.id) : freshNote(item.notebook || '默认笔记本')
        n.title = String(item.title || '未命名')
        n.notebook = String(item.notebook || '默认笔记本')
        n.tags = Array.isArray(item.tags) ? item.tags.map(String) : []
        n.content = String(item.content || '')
        n.pinned = !!item.pinned
        n.createdAt = Number(item.createdAt) || n.createdAt
        n.updatedAt = Number(item.updatedAt) || n.updatedAt
        n.deletedAt = item.deletedAt ? Number(item.deletedAt) : null
        if (!dup) { notes.push(n); added += 1 }
      }
      const nbIn = Array.isArray(data.notebooks) ? data.notebooks : []
      nbIn.forEach((nb) => { if (!notebooks.includes(nb)) notebooks.push(nb) })
      await persist()
      await saveNotebooks(notebooks)
      renderSide(); renderTags(); renderList(); renderEditor()
      alert(`导入完成：新增 ${added} 篇${nbIn.length ? '，合并笔记本 ' + nbIn.length + ' 个' : ''}`)
    } catch (error) {
      alert('导入失败：' + (error && error.message || error))
    }
  })

  renderSide()
  renderTags()
  renderList()
  renderEditor()
  showStats()
}

/* -------------------------------- 常用开发工具 -------------------------- */

// 复制文本到剪贴板（兼容无权限时的降级方案）
function copyToClipboard(text) {
  const legacy = () => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (error) { /* ignore */ }
    ta.remove()
    return ok
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => legacy())
  }
  return Promise.resolve(legacy())
}

// ---------- 程序员常用算法函数（哈希/进制/颜色/UUID） ----------
function crc32Hex(str) {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  const bytes = new TextEncoder().encode(str)
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return ('00000000' + ((crc ^ 0xffffffff) >>> 0).toString(16)).slice(-8).toUpperCase()
}
async function shaHex(algo, str) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('当前环境不支持 WebCrypto（需 https 或 localhost）')
  const buf = await window.crypto.subtle.digest(algo, new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const RADIX_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function parseRadixBig(text, radix) {
  let t = String(text).trim()
  let sign = 1n
  if (t.startsWith('-')) { sign = -1n; t = t.slice(1) }
  t = t.replace(/^0[xX]/, '').replace(/^0[oO]/, '').replace(/^0[bB]/, '')
  if (t === '') return null
  let n = 0n
  for (const ch of t.toUpperCase()) {
    const d = RADIX_DIGITS.indexOf(ch)
    if (d < 0 || d >= radix) return null
    n = n * BigInt(radix) + BigInt(d)
  }
  return sign * n
}
function formatRadixBig(value, radix) {
  let v = value < 0n ? -value : value
  if (v === 0n) return '0'
  let out = ''
  while (v > 0n) { out = RADIX_DIGITS[Number(v % BigInt(radix))] + out; v = v / BigInt(radix) }
  return (value < 0n ? '-' : '') + out
}
function uuidV4() {
  if (window.crypto && window.crypto.getRandomValues) {
    const b = window.crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
// ---- 颜色转换 ----
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)))
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('HEX 格式应为 #RGB 或 #RRGGBB')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s = Math.max(0, Math.min(1, s / 100)); l = Math.max(0, Math.min(1, l / 100))
  if (s === 0) { const g = Math.round(l * 255); return [g, g, g] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const fn = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [clampByte(fn(h + 1 / 3) * 255), clampByte(fn(h) * 255), clampByte(fn(h - 1 / 3) * 255)]
}


// ---------- 压缩工具底层（ZIP / 分卷，纯前端） ----------
function crc32ForBytes(bytes) {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRawBytes(data) {
  if (typeof CompressionStream === 'undefined') throw new Error('当前浏览器不支持压缩（需新版 Chrome / Safari）')
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function dosDateTime() {
  const d = new Date()
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  return { date: date & 0xffff, time: time & 0xffff }
}

async function buildZipBytes(entries) {
  // entries: [{ name: string, data: Uint8Array }]
  const items = []
  let localTotal = 0
  let centralTotal = 0
  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name)
    const raw = e.data
    const deflated = await deflateRawBytes(raw)
    const crc = crc32ForBytes(raw)
    items.push({ nameBytes, raw, deflated, crc, method: 8, localSize: 30 + nameBytes.length + deflated.length, centralSize: 46 + nameBytes.length, offset: 0 })
    localTotal += 30 + nameBytes.length + deflated.length
    centralTotal += 46 + nameBytes.length
  }
  const total = localTotal + centralTotal + 22
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const u8 = new Uint8Array(buf)
  let pos = 0
  const putU16 = (v) => { view.setUint16(pos, v, true); pos += 2 }
  const putU32 = (v) => { view.setUint32(pos, v, true); pos += 4 }
  const putBytes = (b) => { u8.set(b, pos); pos += b.length }

  let offset = 0
  for (const it of items) {
    it.offset = offset
    putU32(0x04034b50); putU16(20); putU16(0x0800); putU16(it.method)
    const dt = dosDateTime()
    putU16(dt.time); putU16(dt.date)
    putU32(it.crc); putU32(it.deflated.length); putU32(it.raw.length)
    putU16(it.nameBytes.length); putU16(0)
    putBytes(it.nameBytes); putBytes(it.deflated)
    offset += it.localSize
  }
  const centralStart = pos
  for (const it of items) {
    putU32(0x02014b50); putU16(20); putU16(20); putU16(0x0800); putU16(it.method)
    const dt = dosDateTime()
    putU16(dt.time); putU16(dt.date)
    putU32(it.crc); putU32(it.deflated.length); putU32(it.raw.length)
    putU16(it.nameBytes.length); putU16(0); putU16(0)
    putU16(0); putU16(0); putU32(0)
    putU32(it.offset); putBytes(it.nameBytes)
  }
  putU32(0x06054b50); putU16(0); putU16(0)
  putU16(items.length); putU16(items.length)
  putU32(centralTotal); putU32(centralStart)
  putU16(0)
  return u8
}

function splitBuffer(bytes, partSize) {
  const parts = []
  for (let i = 0; i < bytes.length; i += partSize) {
    parts.push(bytes.subarray(i, Math.min(i + partSize, bytes.length)))
  }
  return parts
}

function joinBuffers(list) {
  const total = list.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const b of list) { out.set(b, pos); pos += b.length }
  return out
}

function humanSize(n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

async function zipInflateEntry(entry) {
  if (entry.method === 0) return entry.data
  if (entry.method === 8) return inflateRawDeflate(entry.data)
  throw new Error(`不支持的压缩方式 method=${entry.method}`)
}
function downloadBytes(filename, bytes, type = 'application/octet-stream') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes], { type }))
  a.download = filename
  a.click()
}

// ---------- 代码体检（本地启发式静态检查） ----------
function ccAnalyze(code, lang) {
  const mode = (lang || 'js').toLowerCase()
  const lines = String(code || '').split(/\r?\n/)
  const blank = lines.map((l) => l.replace(/\s+/g, ' '))
  const out = []
  const push = (line, type, msg) => out.push({ line, type, msg })
  for (let i = 0; i < lines.length; i++) {
    const t = blank[i]
    if (/TODO|FIXME|HACK/.test(t)) push(i + 1, 'style', '存在 TODO/FIXME 待办标记')
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(t)) push(i + 1, 'bug', '空的 catch 会静默吞掉错误，建议记录或处理')
    if (/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(t)) push(i + 1, 'opt', '死循环风险：while(true)/for(;;) 请确保有可靠的退出条件')
    if (mode === 'js') {
      if (/\bvar\s+/.test(t)) push(i + 1, 'style', '建议使用 let/const 代替 var')
      if (/==/.test(t) && !/===|=>/.test(t)) push(i + 1, 'bug', '使用了 ==，建议改用 === 以避免隐式类型转换')
      if (/console\.(log|debug|warn|error)\(/.test(t)) push(i + 1, 'style', '发现 console.* 输出（生产前建议移除或按规范保留 error 级）')
      if (/document\.write\(/.test(t)) push(i + 1, 'bug', 'document.write 会阻塞解析，建议改用 DOM API')
      if (/\beval\s*\(/.test(t)) push(i + 1, 'bug', 'eval 存在安全风险，请避免')
      if (/\.innerHTML\s*=/.test(t)) push(i + 1, 'opt', 'innerHTML 赋值前请转义，避免 XSS')
      if (/async\s+function|async\s+[A-Za-z_$]/.test(t) && !/await/.test(lines.slice(i, i + 5).join(' '))) push(i + 1, 'opt', 'async 函数内未见 await（检查是否遗漏）')
    }
    if (mode === 'java') {
      if (/System\.out\.(print|println)\(|e\.printStackTrace\(|printStackTrace\(\)/.test(t)) push(i + 1, 'style', '发现 System.out / printStackTrace 输出（建议改用日志框架）')
      if (/==/.test(t) && /".*"/.test(t)) push(i + 1, 'bug', '字符串与字面量用 == 只比较引用，应使用 equals() 比较内容')
      if (/\bnew\s+String\s*\(\s*"/.test(t)) push(i + 1, 'opt', 'new String("…") 多余，直接用字符串字面量即可')
      if (/(new\s+(FileInputStream|FileOutputStream|BufferedReader|Connection|Statement|ResultSet|FileReader)|\.createStatement\s*\(|\.getConnection\s*\()/.test(t)) push(i + 1, 'opt', '涉及流/连接资源：确认使用 try-with-resources 或 finally 中正确关闭')
      if (/catch\s*\(\s*Exception\s+\w+\s*\)/.test(t) && !/log|logger|printStackTrace/.test(lines.slice(i, i + 6).join(' '))) push(i + 1, 'bug', '捕获 Exception 但未见记录/抛出，建议记录日志避免吞错')
      if (/public\s+static\s+void\s+main/.test(t)) push(i + 1, 'style', 'main 入口方法：建议将业务逻辑拆分到方法/类')
    }
    if (/\b(?!var\b)new\s+(?!String\b)/.test(t) && /\bif\b|\bfor\b|\bwhile\b/.test(t)) {
      // 循环/条件内大量对象创建可能是低效点（弱提示）
      if (/\bfor\s*\(/.test(t) && /new\s+/.test(t)) push(i + 1, 'opt', '循环内频繁 new 对象可能影响性能，考虑复用或改用 StringBuilder 等')
    }
  }
  // 结构：嵌套峰值
  let depth = 0, maxD = 0
  for (let i = 0; i < lines.length; i++) {
    const open = (blank[i].match(/\{/g) || []).length
    const close = (blank[i].match(/\}/g) || []).length
    depth += open - close
    if (depth > 0) maxD = Math.max(maxD, depth)
  }
  if (lines.length > 80) push(1, 'style', '单个代码块行数偏多（' + lines.length + ' 行），建议拆分为方法')
  if (maxD > 6) push(1, 'opt', '存在深层嵌套（峰值 ' + maxD + ' 层），建议拆分方法提升可读性')
  return { issues: out, maxDepth: maxD, lines: lines.length, lang: mode }
}

PAGES.devtools = (el) => {
  const TOOL_TABS = [
    ['json', 'JSON'],
    ['base64', 'Base64'],
    ['url', 'URL 编解码'],
    ['ts', '时间戳'],
    ['text', '文本统计'],
    ['case', '大小写转换'],
    ['hash', '哈希'],
    ['radix', '进制转换'],
    ['regex', '正则测试'],
    ['color', '颜色转换'],
    ['uuid', 'UUID 生成'],
    ['zip', '压缩工具'],
    ['code', '代码体检'],
  ]
  let active = (state.devtool && TOOL_TABS.some(([id]) => id === state.devtool)) ? state.devtool : 'json'

  const sampleJson = {
    id: 'SCB202609050001',
    name: '王铁',
    role: '票据平台开发者',
    tags: ['票据', '会计', 'DSH'],
    config: { env: 'SIT', debug: false },
  }

  // 各工具视图
  const VIEWS = {
    json: `
      <div class="row" style="margin-bottom:8px">
        <button class="btn sm" id="tj-sample">载入示例</button>
        <button class="btn primary sm" id="tj-fmt">格式化</button>
        <button class="btn sm" id="tj-min">压缩</button>
        <button class="btn sm" id="tj-check">校验</button>
      </div>
      <textarea id="tj-in" rows="9" placeholder="在此粘贴 JSON 文本…"></textarea>
      <div class="row" style="margin:6px 0">
        <span class="muted" id="tj-status"></span>
      </div>
      <textarea id="tj-out" rows="9" readonly placeholder="输出结果…"></textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" id="tj-copy">📋 复制输出</button>
      </div>`,
    base64: `
      <div class="row" style="margin-bottom:8px">
        <button class="btn primary sm" id="tb-enc">文本 → Base64（编码）</button>
        <button class="btn sm" id="tb-dec">Base64 → 文本（解码）</button>
      </div>
      <textarea id="tb-in" rows="7" placeholder="粘贴要编码的文本，或要解码的 Base64 字符串…"></textarea>
      <div class="muted" style="margin:6px 0" id="tb-status">支持中文等 UTF-8 内容；解码失败会提示错误。</div>
      <textarea id="tb-out" rows="7" readonly placeholder="输出结果…"></textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" id="tb-copy">📋 复制输出</button>
      </div>`,
    url: `
      <div class="row" style="margin-bottom:8px">
        <button class="btn primary sm" id="tu-enc">全量编码（encodeURIComponent）</button>
        <button class="btn sm" id="tu-dec">解码（decodeURIComponent）</button>
      </div>
      <textarea id="tu-in" rows="6" placeholder="粘贴需要编码/解码的文本或 URL…"></textarea>
      <div class="muted" style="margin:6px 0" id="tu-status"></div>
      <textarea id="tu-out" rows="6" readonly placeholder="输出结果…"></textarea>
      <div class="row" style="margin-top:6px">
        <button class="btn sm" id="tu-copy">📋 复制输出</button>
      </div>`,
    ts: `
      <div class="kv" style="margin-bottom:10px">
        <div class="k">时间戳（秒/毫秒自动识别）</div>
        <div class="row">
          <input type="text" id="tt-in" placeholder="如 1725513600 或 1725513600123">
          <button class="btn primary sm" id="tt-now">填入当前时间</button>
          <button class="btn sm" id="tt-go">转日期</button>
        </div>
        <div class="k">日期时间（本地）</div>
        <div class="row">
          <input type="text" id="tt-date" placeholder="如 2026-09-05 12:30:00">
          <button class="btn sm" id="tt-rev">转时间戳</button>
        </div>
      </div>
      <pre class="log" id="tt-result">输入时间戳或日期后点击转换…</pre>`,
    text: `
      <textarea id="tx-in" rows="10" placeholder="粘贴文本，右侧实时统计…"></textarea>
      <div class="row" style="margin-top:8px" id="tx-stats"></div>`,
    case: `
      <div class="row" style="margin-bottom:8px;flex-wrap:wrap">
        <button class="btn sm" data-c="upper">大写 A-Z</button>
        <button class="btn sm" data-c="lower">小写 a-z</button>
        <button class="btn sm" data-c="capw">单词首字母大写</button>
        <button class="btn sm" data-c="caps">句子首字母大写</button>
        <button class="btn sm" data-c="invert">大小写反转</button>
      </div>
      <div class="row" style="margin-bottom:8px;flex-wrap:wrap">
        <span class="muted">变量风格：</span>
        <button class="btn sm" data-s="camel">camelCase</button>
        <button class="btn sm" data-s="pascal">PascalCase</button>
        <button class="btn sm" data-s="snake">snake_case</button>
        <button class="btn sm" data-s="kebab">kebab-case</button>
      </div>
      <textarea id="cc-in" rows="7" placeholder="输入需要转换的文本…"></textarea>
      <div class="row" style="margin:6px 0"><span class="muted" id="cc-status"></span></div>
      <textarea id="cc-out" rows="7" readonly placeholder="转换结果…"></textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="cc-copy">📋 复制输出</button></div>`,
    hash: `
      <div class="row" style="margin-bottom:8px">
        <select id="th-algo">
          <option value="sha1">SHA-1</option>
          <option value="sha256" selected>SHA-256</option>
          <option value="sha384">SHA-384</option>
          <option value="sha512">SHA-512</option>
          <option value="crc32">CRC32</option>
        </select>
        <button class="btn primary sm" id="th-run">计算摘要</button>
      </div>
      <textarea id="th-in" rows="6" placeholder="输入要计算摘要的文本…"></textarea>
      <div class="row" style="margin:6px 0"><span class="muted" id="th-status"></span></div>
      <textarea id="th-out" rows="6" readonly placeholder="摘要结果…"></textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="th-copy">📋 复制输出</button></div>`,
    radix: `
      <div class="row" style="margin-bottom:8px">
        <span class="muted">输入数值：</span><input type="text" id="tr-num" placeholder="如 255 / ff / 11111111" style="flex:1">
        <span class="muted">输入进制：</span>
        <select id="tr-base">
          <option value="10">十进制</option><option value="16">十六进制</option>
          <option value="8">八进制</option><option value="2">二进制</option>
        </select>
        <button class="btn primary sm" id="tr-go">转换</button>
      </div>
      <div class="muted" style="margin-bottom:6px">支持超大整数（BigInt），可带 0x/0o/0b 前缀。</div>
      <pre class="log" id="tr-out">转换结果…</pre>
      <div class="muted" style="margin:6px 0" id="tr-status"></div>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="tr-copy">📋 复制输出</button></div>`,
    regex: `
      <div class="row" style="margin-bottom:8px">
        <input type="text" id="tp-pat" placeholder="正则表达式，如 [0-9]{3}-[0-9]{4}" style="flex:1">
        <span class="muted">flags</span><input type="text" id="tp-flag" placeholder="如 gim" style="width:90px">
        <button class="btn primary sm" id="tp-run">匹配测试</button>
      </div>
      <textarea id="tp-text" rows="8" placeholder="粘贴要匹配的文本…"></textarea>
      <div class="row" style="margin:6px 0"><span class="muted" id="tp-status"></span></div>
      <pre class="log" id="tp-out" style="max-height:240px">匹配结果…</pre>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="tp-copy">📋 复制输出</button></div>`,
    color: `
      <div class="row" style="margin-bottom:8px">
        <span class="muted">格式：</span>
        <select id="tc-mode">
          <option value="hex">HEX（#rrggbb）</option>
          <option value="rgb">RGB（如 255,0,0）</option>
          <option value="hsl">HSL（如 0,100%,50%）</option>
        </select>
        <input type="text" id="tc-in" placeholder="输入颜色…" style="flex:1">
        <button class="btn primary sm" id="tc-run">转换</button>
      </div>
      <pre class="log" id="tc-out">转换结果…</pre>
      <div class="tc-preview" id="tc-preview"></div>`,
    uuid: `
      <div class="row" style="margin-bottom:8px">
        <span class="muted">生成数量：</span>
        <input type="number" id="tg-count" value="5" min="1" max="200" style="width:110px">
        <button class="btn primary sm" id="tg-gen">生成 UUID v4</button>
      </div>
      <textarea id="tg-out" rows="8" readonly placeholder="生成的 UUID 列表…"></textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="tg-copy">📋 复制输出</button></div>`,
    zip: `
      <div class="tool-tabs" style="margin:0 0 10px" id="zz-mode">
        <button class="tool-tab active" data-zm="pack">打包压缩</button>
        <button class="tool-tab" data-zm="split">分段压缩</button>
        <button class="tool-tab" data-zm="unzip">解压</button>
      </div>
      <div id="zz-body"></div>
      <div class="muted" style="margin-top:8px">纯前端本地处理，文件不上传。分段产物命名为 .zip.001/.002…，解压时选择全部分段或单个 .zip 均可。</div>`,
    code: `
      <div class="row" style="margin-bottom:8px;gap:6px;flex-wrap:wrap">
        <select id="cc-lang" style="width:auto">
          <option value="js">语言：JavaScript</option>
          <option value="java">语言：Java</option>
        </select>
        <button class="btn primary" id="cc-run">🧪 本地静态检查</button>
        <button class="btn" id="cc-ai">🤖 AI 深度评审（可选）</button>
        <span class="muted">本地检查可离线用；AI 评审需配置接口与 Key。</span>
      </div>
      <div id="cc-config" style="display:none" class="card" style="padding:10px">
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <input type="text" id="cc-url" placeholder="API 地址，默认 https://api.deepseek.com/v1/chat/completions" style="flex:2;min-width:220px">
          <input type="password" id="cc-key" placeholder="API Key" style="flex:1;min-width:160px">
          <input type="text" id="cc-model" value="deepseek-chat" style="width:140px">
          <button class="btn sm" id="cc-savecfg">保存配置</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:4px">Key 仅保存在本机浏览器 localStorage；直连第三方 API 属自担风险（可改为经自有服务端代理）。</div>
      </div>
      <textarea id="cc-in" rows="12" placeholder="粘贴你要检查的 JS / 代码…&#10;function add(a, b) { return a == b; }&#10;var x = 1;"></textarea>
      <div class="muted" id="cc-status" style="margin:6px 0"></div>
      <div id="cc-out"></div>`,
  }

  el.innerHTML = `
    <div class="section-title">常用开发工具 <span class="muted">纯前端在线工具 · 数据不出浏览器</span></div>
    <div class="tool-tabs" id="dt-tabs"></div>
    <div class="card" id="dt-body" style="margin-bottom:0"></div>`

  const tabsBox = el.querySelector('#dt-tabs')
  const body = el.querySelector('#dt-body')

  const renderTabs = () => {
    tabsBox.innerHTML = TOOL_TABS.map(([id, label]) =>
      `<button class="tool-tab ${active === id ? 'active' : ''}" data-tool="${id}">${label}</button>`).join('')
    tabsBox.querySelectorAll('.tool-tab').forEach((btn) => {
      btn.onclick = () => { active = btn.dataset.tool; state.devtool = btn.dataset.tool; renderTabs(); renderBody() }
    })
  }

  const showStatus = (id, text, ok = true) => {
    const node = body.querySelector(id)
    if (node) { node.textContent = text; node.className = ok ? 'muted' : 'error-text' }
  }

  const wireCopy = (btnId, getText) => {
    const btn = body.querySelector(btnId)
    if (btn) btn.onclick = async () => {
      const text = getText()
      if (!text) { showStatus(btnId.replace('copy', 'status'), '没有可复制的内容', false); return }
      const ok = await copyToClipboard(text)
      const note = body.querySelector(btnId.replace('copy', 'status'))
      if (note) note.textContent = ok ? '✓ 已复制到剪贴板' : '复制失败，请手动选择复制'
    }
  }

  const renderBody = () => {
    body.innerHTML = `<h3>${TOOL_TABS.find(([id]) => id === active)[1]} 工具</h3>` + VIEWS[active]
    const set = (id, value) => { const n = body.querySelector(id); if (n) n.value = value }
    const val = (id) => (body.querySelector(id) || {}).value || ''
    const status = (id) => body.querySelector(id)

    if (active === 'json') {
      const tryParse = () => {
        const raw = val('#tj-in').trim()
        if (!raw) { showStatus('#tj-status', '请先输入 JSON 文本', false); return null }
        try { return JSON.parse(raw) } catch (error) { showStatus('#tj-status', `JSON 解析失败：${error.message}`, false); return undefined }
      }
      body.querySelector('#tj-sample').onclick = () => {
        set('#tj-in', JSON.stringify(sampleJson, null, 2))
        showStatus('#tj-status', '已载入示例，可点击「格式化/压缩/校验」', true)
      }
      body.querySelector('#tj-fmt').onclick = () => {
        const obj = tryParse()
        if (obj !== undefined && obj !== null) { set('#tj-out', JSON.stringify(obj, null, 2)); showStatus('#tj-status', '✓ 已格式化（2 空格缩进）', true) }
      }
      body.querySelector('#tj-min').onclick = () => {
        const obj = tryParse()
        if (obj !== undefined && obj !== null) { set('#tj-out', JSON.stringify(obj)); showStatus('#tj-status', '✓ 已压缩', true) }
      }
      body.querySelector('#tj-check').onclick = () => {
        const obj = tryParse()
        if (obj !== undefined && obj !== null) {
          const type = Array.isArray(obj) ? '数组' : obj === null ? 'null' : typeof obj
          const keys = obj && typeof obj === 'object' ? Object.keys(obj).length : 0
          showStatus('#tj-status', `✓ 合法 JSON · 顶层类型：${type}${keys ? ` · 顶层键/元素数：${keys}` : ''}`, true)
        }
      }
      wireCopy('#tj-copy', () => val('#tj-out'))
    } else if (active === 'base64') {
      const enc = () => {
        const raw = val('#tb-in')
        if (!raw) { showStatus('#tb-status', '请先输入要编码的文本', false); return }
        try { set('#tb-out', btoa(unescape(encodeURIComponent(raw)))); showStatus('#tb-status', '✓ 已编码（UTF-8 安全）', true) } catch (error) { showStatus('#tb-status', `编码失败：${error.message}`, false) }
      }
      const dec = () => {
        const raw = val('#tb-in').trim()
        if (!raw) { showStatus('#tb-status', '请先输入要解码的 Base64', false); return }
        try { set('#tb-out', decodeURIComponent(escape(atob(raw)))); showStatus('#tb-status', '✓ 已解码', true) } catch (error) { showStatus('#tb-status', `解码失败：${error.message}（请确认是合法 Base64）`, false) }
      }
      body.querySelector('#tb-enc').onclick = enc
      body.querySelector('#tb-dec').onclick = dec
      wireCopy('#tb-copy', () => val('#tb-out'))
    } else if (active === 'url') {
      body.querySelector('#tu-enc').onclick = () => {
        const raw = val('#tu-in')
        if (!raw) { showStatus('#tu-status', '请先输入内容', false); return }
        try { set('#tu-out', encodeURIComponent(raw)); showStatus('#tu-status', '✓ 已编码（encodeURIComponent）', true) } catch (error) { showStatus('#tu-status', `编码失败：${error.message}`, false) }
      }
      body.querySelector('#tu-dec').onclick = () => {
        const raw = val('#tu-in').trim()
        if (!raw) { showStatus('#tu-status', '请先输入内容', false); return }
        try { set('#tu-out', decodeURIComponent(raw)); showStatus('#tu-status', '✓ 已解码（decodeURIComponent）', true) } catch (error) { showStatus('#tu-status', `解码失败：${error.message}`, false) }
      }
      wireCopy('#tu-copy', () => val('#tu-out'))
    } else if (active === 'ts') {
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      body.querySelector('#tt-now').onclick = () => { set('#tt-in', String(Date.now())) }
      body.querySelector('#tt-go').onclick = () => {
        const raw = val('#tt-in').trim()
        const box = status('#tt-result')
        if (!raw) { box.textContent = '请先输入时间戳'; return }
        const num = Number(raw)
        if (!Number.isFinite(num)) { box.textContent = '时间戳格式不正确（应为数字）'; return }
        const ms = Math.abs(num) < 1e12 ? num * 1000 : num   // 10 位秒级 / 13 位毫秒级
        const d = new Date(ms)
        if (Number.isNaN(d.getTime())) { box.textContent = '超出合法时间范围'; return }
        box.textContent = `本地时间：${fmt(d)}\nUTC 时间：${d.toUTCString()}\n毫秒时间戳：${d.getTime()}\n秒级时间戳：${Math.floor(d.getTime() / 1000)}`
      }
      body.querySelector('#tt-rev').onclick = () => {
        const raw = val('#tt-date').trim()
        const box = status('#tt-result')
        if (!raw) { box.textContent = '请先输入日期时间（如 2026-09-05 12:30:00）'; return }
        const t = new Date(raw.replace(' ', 'T'))
        if (Number.isNaN(t.getTime())) { box.textContent = '日期格式无法解析，请使用 2026-09-05 12:30:00'; return }
        box.textContent = `解析为本地时间：${fmt(t)}\n毫秒时间戳：${t.getTime()}\n秒级时间戳：${Math.floor(t.getTime() / 1000)}`
      }
    } else if (active === 'text') {
      const statBox = status('#tx-stats')
      const update = () => {
        const raw = val('#tx-in')
        const noSpace = raw.replace(/\s+/g, '')
        const words = raw.trim() ? raw.trim().split(/\s+/).length : 0
        const lines = raw === '' ? 0 : raw.split('\n').length
        const bytes = new TextEncoder().encode(raw).length
        statBox.innerHTML = `
          <span class="stat-chip">字符（含空白）<b>${raw.length}</b></span>
          <span class="stat-chip">字符（不含空白）<b>${noSpace.length}</b></span>
          <span class="stat-chip">行数<b>${lines}</b></span>
          <span class="stat-chip">词数<b>${words}</b></span>
          <span class="stat-chip">UTF-8 字节<b>${bytes}</b></span>`
      }
      body.querySelector('#tx-in').addEventListener('input', update)
      update()
    } else if (active === 'case') {
      const toTokens = (str) => {
        const parts = String(str).trim().split(/[\s_\-\.]+/)
        const out = []
        for (const part of parts) {
          const humps = part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z0-9]+/g)
          if (humps) out.push(...humps)
          else if (part) out.push(part)
        }
        return out.map((w) => w.toLowerCase())
      }
      const run = (fn) => {
        set('#cc-out', fn(val('#cc-in')))
        showStatus('#cc-status', '✓ 转换完成', true)
      }
      body.querySelectorAll('[data-c]').forEach((b) => {
        b.onclick = () => run((s0) => {
          const kind = b.dataset.c
          if (kind === 'upper') return s0.toUpperCase()
          if (kind === 'lower') return s0.toLowerCase()
          if (kind === 'capw') return s0.replace(/(^|[^\p{L}\p{N}])(\p{Ll})/gu, (m, p1, p2) => p1 + p2.toUpperCase())
          if (kind === 'caps') return s0.replace(/(^|[.!?。！？…]\s+)(\p{Ll})/gu, (m, p1, p2) => p1 + p2.toUpperCase())
          if (kind === 'invert') return [...s0].map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('')
          return s0
        })
      })
      body.querySelectorAll('[data-s]').forEach((b) => {
        b.onclick = () => run((s0) => {
          const tokens = toTokens(s0)
          const style = b.dataset.s
          if (style === 'camel') return tokens.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('')
          if (style === 'pascal') return tokens.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
          if (style === 'snake') return tokens.join('_')
          if (style === 'kebab') return tokens.join('-')
          return s0
        })
      })
      wireCopy('#cc-copy', () => val('#cc-out'))
    } else if (active === 'hash') {
      const run = async () => {
        const text = val('#th-in')
        const algo = val('#th-algo')
        if (!text) { showStatus('#th-status', '请先输入要计算的文本', false); return }
        showStatus('#th-status', '计算中…')
        try {
          if (algo === 'crc32') { set('#th-out', crc32Hex(text)); showStatus('#th-status', '✓ CRC32 完成', true) }
          else {
            const map = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }
            set('#th-out', await shaHex(map[algo], text))
            showStatus('#th-status', '✓ ' + (map[algo] || algo) + ' 完成', true)
          }
        } catch (error) {
          showStatus('#th-status', String(error && error.message || error), false)
        }
      }
      body.querySelector('#th-run').onclick = run
      wireCopy('#th-copy', () => val('#th-out'))
    } else if (active === 'radix') {
      body.querySelector('#tr-go').onclick = () => {
        const value = parseRadixBig(val('#tr-num'), Number(val('#tr-base')))
        if (value === null) { showStatus('#tr-status', '数值无法按当前进制解析', false); return }
        set('#tr-out', ['十进制', '十六进制', '八进制', '二进制'].map((name, i) => {
          const r = [10, 16, 8, 2][i]
          return `${name.padEnd(6)} ${formatRadixBig(value, r)}`
        }).join('\n'))
        showStatus('#tr-status', '✓ 转换完成（BigInt 精确计算）', true)
      }
      wireCopy('#tr-copy', () => val('#tr-out'))
    } else if (active === 'regex') {
      body.querySelector('#tp-run').onclick = () => {
        const pat = val('#tp-pat')
        const flags = val('#tp-flag')
        const text = val('#tp-text')
        const out = status('#tp-out')
        if (!pat) { showStatus('#tp-status', '请输入正则表达式', false); return }
        try {
          const re = new RegExp(pat, flags)
          const global = re.global
          const lines = []
          let count = 0
          if (global) {
            let m
            while ((m = re.exec(text)) !== null) {
              count += 1
              const groups = m.length > 1 ? ` → 分组 [${m.slice(1).join(' | ')}]` : ''
              lines.push(`[${m.index}] ${JSON.stringify(m[0])}${groups}`)
              if (m[0] === '') re.lastIndex += 1
            }
            out.textContent = count ? `共命中 ${count} 处：\n` + lines.join('\n') : '未命中任何内容'
          } else {
            const m = re.exec(text)
            out.textContent = m
              ? `命中：index=${m.index} · 匹配串 ${JSON.stringify(m[0])}` + (m.length > 1 ? '\n分组：' + m.slice(1).map((g, i) => `$ ${i + 1} = ${g ?? 'undefined'}`).join('；') : '')
              : '未命中'
          }
          showStatus('#tp-status', '✓ 正则执行成功', true)
        } catch (error) {
          out.textContent = ''
          showStatus('#tp-status', `正则错误：${error.message}`, false)
        }
      }
      wireCopy('#tp-copy', () => val('#tp-out'))
    } else if (active === 'color') {
      body.querySelector('#tc-run').onclick = () => {
        const mode = val('#tc-mode')
        const input = val('#tc-in').trim()
        const out = status('#tc-out')
        const preview = status('#tc-preview')
        try {
          let rgb
          if (mode === 'hex') rgb = hexToRgb(input)
          else if (mode === 'rgb') {
            const parts = input.replace(/[()rgba]/gi, '').split(/[,\s]+/).filter(Boolean).map(Number)
            if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) throw new Error('RGB 格式应为 r,g,b')
            rgb = parts.slice(0, 3).map(clampByte)
          } else {
            const m = input.match(/([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%/)
            if (!m) throw new Error('HSL 格式应为 h,s%,l%（如 0,100%,50%）')
            rgb = hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]))
          }
          const [r, g, b] = rgb
          const hex = rgbToHex(r, g, b)
          const [h, s2, l] = rgbToHsl(r, g, b)
          out.textContent = `HEX：${hex}\nRGB：rgb(${r}, ${g}, ${b})\nHSL：hsl(${h}, ${s2}%, ${l}%)`
          preview.style.background = hex
          preview.innerHTML = '<span style="color:#fff;mix-blend-mode:difference">预览 ' + hex + '</span>'
        } catch (error) {
          out.textContent = '错误：' + (error.message || error)
          preview.style.background = ''
          preview.innerHTML = ''
        }
      }
    } else if (active === 'uuid') {
      body.querySelector('#tg-gen').onclick = () => {
        let count = parseInt(val('#tg-count'), 10)
        if (!Number.isFinite(count)) count = 5
        count = Math.max(1, Math.min(200, count))
        const list = []
        for (let i = 0; i < count; i++) list.push(uuidV4())
        set('#tg-out', list.join('\n'))
      }
      wireCopy('#tg-copy', () => val('#tg-out'))
    } else if (active === 'zip') {
      const zipBody = body.querySelector('#zz-body')
      const modeTabs = body.querySelector('#zz-mode')

      const renderPack = () => {
        zipBody.innerHTML = `
          <div class="row" style="margin-bottom:8px">
            <input type="file" id="zf-files" multiple>
            <input type="text" id="zf-name" placeholder="压缩包名（默认 archive）" style="flex:1">
            <button class="btn primary sm" id="zf-run">打包压缩</button>
          </div>
          <div class="muted" id="zf-status"></div>
          <div id="zf-list"></div>`
        const note = zipBody.querySelector('#zf-status')
        zipBody.querySelector('#zf-run').onclick = async () => {
          const files = Array.from(zipBody.querySelector('#zf-files').files || [])
          if (!files.length) { note.textContent = '请先选择文件'; return }
          note.textContent = '压缩中…'
          try {
            const entries = []
            for (const file of files) entries.push({ name: file.name, data: await readFileAsBuffer(file) })
            const zip = await buildZipBytes(entries)
            const name = (zipBody.querySelector('#zf-name').value.trim() || 'archive').replace(/\.zip$/i, '') + '.zip'
            downloadBytes(name, zip)
            const raw = entries.reduce((a, e) => a + e.data.length, 0)
            note.textContent = `✓ 已生成 ${name}（原 ${humanSize(raw)} → 压缩 ${humanSize(zip.length)}，节省 ${Math.round((1 - zip.length / raw) * 100)}%）`
            zipBody.querySelector('#zf-list').innerHTML = '<div class="muted">' + entries.map((e) => esc(e.name) + ' · ' + humanSize(e.data.length)).join('<br>') + '</div>'
          } catch (err) { note.textContent = '压缩失败：' + String(err && err.message || err) }
        }
      }

      const renderSplit = () => {
        zipBody.innerHTML = `
          <div class="row" style="margin-bottom:8px">
            <input type="file" id="zs-files" multiple>
            <span class="muted">每段 ≤</span>
            <select id="zs-size">
              <option value="1">1 MB</option>
              <option value="2">2 MB</option>
              <option value="5" selected>5 MB</option>
              <option value="10">10 MB</option>
              <option value="20">20 MB</option>
            </select>
            <button class="btn primary sm" id="zs-run">分段压缩</button>
          </div>
          <div class="muted" id="zs-status"></div>
          <div id="zs-list"></div>`
        const note = zipBody.querySelector('#zs-status')
        zipBody.querySelector('#zs-run').onclick = async () => {
          const files = Array.from(zipBody.querySelector('#zs-files').files || [])
          if (!files.length) { note.textContent = '请先选择文件'; return }
          note.textContent = '压缩并分段中…'
          try {
            const entries = []
            for (const file of files) entries.push({ name: file.name, data: await readFileAsBuffer(file) })
            const zip = await buildZipBytes(entries)
            const mb = Number(zipBody.querySelector('#zs-size').value) || 5
            const parts = splitBuffer(zip, mb * 1024 * 1024)
            const base = 'archive'
            note.textContent = `✓ 共 ${parts.length} 段（合计 ${humanSize(zip.length)}，每段 ≤${mb}MB），下载全部后合并即可`
            zipBody.querySelector('#zs-list').innerHTML = parts.map((p, i) => {
              const idx = String(i + 1).padStart(3, '0')
              return `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${base}.zip.${idx} · ${humanSize(p.length)}</span><button class="btn sm" data-idx="${i}">⬇ 下载</button></div>`
            }).join('') + `
              <div class="row" style="margin-top:8px"><button class="btn sm" id="zs-cmd-copy">📋 复制合并命令</button></div>
              <pre class="log" id="zs-cmd" style="max-height:120px">cat ${base}.zip.001 ${parts.slice(1).map((_, i) => base + '.zip.' + String(i + 2).padStart(3, '0')).join(' ')} > ${base}.zip</pre>`
            zipBody.querySelectorAll('#zs-list [data-idx]').forEach((b) => {
              b.onclick = () => downloadBytes(base + '.zip.' + String(Number(b.dataset.idx) + 1).padStart(3, '0'), parts[Number(b.dataset.idx)])
            })
            zipBody.querySelector('#zs-cmd-copy').onclick = async () => {
              const ok = await copyToClipboard(zipBody.querySelector('#zs-cmd').textContent)
              if (ok) note.textContent = '✓ 已复制合并命令'
            }
          } catch (err) { note.textContent = '分段压缩失败：' + String(err && err.message || err) }
        }
      }

      const renderUnzip = () => {
        zipBody.innerHTML = `
          <div class="row" style="margin-bottom:8px">
            <input type="file" id="zu-files" multiple accept=".zip,.001,.002,.003,.004,.005,.006,.007,.008,.009,.010,application/zip,application/octet-stream">
            <button class="btn primary sm" id="zu-run">解压</button>
          </div>
          <div class="muted" id="zu-status">支持单个 .zip，或选择分段的全部 .001/.002/…（自动按序号合并后解压）</div>
          <div id="zu-list"></div>`
        const note = zipBody.querySelector('#zu-status')
        zipBody.querySelector('#zu-run').onclick = async () => {
          const files = Array.from(zipBody.querySelector('#zu-files').files || [])
          if (!files.length) { note.textContent = '请先选择文件'; return }
          note.textContent = '解析中…'
          try {
            let zipBytes
            if (files.length > 1 || /\.\d+$/.test(files[0].name)) {
              const bufs = []
              for (const f of files) bufs.push({ name: f.name, data: await readFileAsBuffer(f) })
              bufs.sort((a, b) => {
                const na = Number((a.name.match(/\.(\d+)$/) || [0, '0'])[1])
                const nb = Number((b.name.match(/\.(\d+)$/) || [0, '0'])[1])
                return na - nb
              })
              zipBytes = joinBuffers(bufs.map((b) => b.data))
              note.textContent = `✓ 已合并 ${files.length} 个分段（${humanSize(zipBytes.length)}）`
            } else {
              zipBytes = await readFileAsBuffer(files[0])
            }
            const entries = docxEntries(zipBytes)
            if (!entries.length) throw new Error('不是有效的 ZIP 压缩包')
            const realEntries = entries.filter((e) => !/\/$/.test(e.name))
            const rows = realEntries.length
              ? realEntries.map((e, i) => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(e.name)}<span class="muted"> · ${e.method === 0 ? '存储' : '压缩'} · ${humanSize(e.data.length)}</span></span><button class="btn sm" data-i="${i}">⬇ 提取</button></div>`).join('')
              : '<div class="empty">压缩包内没有文件</div>'
            zipBody.querySelector('#zu-list').innerHTML = rows
            zipBody.querySelectorAll('#zu-list [data-i]').forEach((b) => {
              b.onclick = async () => {
                const entry = realEntries[Number(b.dataset.i)]
                try {
                  downloadBytes(entry.name.replace(/^.*\//, ''), await zipInflateEntry(entry))
                } catch (err) { note.textContent = '提取失败：' + String(err && err.message || err) }
              }
            })
            note.textContent = `✓ 共 ${realEntries.length} 个文件${entries.length - realEntries.length ? '（含 ' + (entries.length - realEntries.length) + ' 个目录）' : ''}${files.length > 1 ? '；分段已自动合并' : ''}`
          } catch (err) { note.textContent = '解压失败：' + String(err && err.message || err) }
        }
      }

      const setMode = (mode) => {
        modeTabs.querySelectorAll('.tool-tab').forEach((b) => b.classList.toggle('active', b.dataset.zm === mode))
        if (mode === 'pack') renderPack()
        else if (mode === 'split') renderSplit()
        else renderUnzip()
      }
      modeTabs.querySelectorAll('.tool-tab').forEach((b) => { b.onclick = () => setMode(b.dataset.zm) })
      setMode('pack')
    } else if (active === 'code') {
      const codeBox = status('#cc-out')
      const codeStatus = status('#cc-status')
      const CC_AI_KEY = 'wt-code-ai'
      let aiCfg = (function () { try { return JSON.parse(localStorage.getItem(CC_AI_KEY)) || {} } catch (e) { return {} } })()

      const showIssues = (issues, summary) => {
        const colors = { bug: 'var(--red)', opt: 'var(--amber)', style: 'var(--text-2)' }
        codeBox.innerHTML = summary ? `<div class="muted" style="margin-bottom:6px">${esc(summary)}</div>` : ''
        codeBox.innerHTML += issues.length
          ? issues.map((it) => `<div class="row" style="justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="flex:1">${esc(it.msg)}</span><span style="color:${colors[it.type] || '#888'};flex-shrink:0">${it.type === 'bug' ? '风险' : it.type === 'opt' ? '优化' : '规范'} · L${it.line}</span></div>`).join('')
          : '<div class="empty">未发现明显问题（启发式检查结果，建议再结合 AI 深度评审）</div>'
      }

      body.querySelector('#cc-run').onclick = () => {
        const code = val('#cc-in')
        if (!code.trim()) { codeStatus.textContent = '请先粘贴代码'; return }
        const r = ccAnalyze(code, val('#cc-lang'))
        const bugs = r.issues.filter((i) => i.type === 'bug').length
        const opts = r.issues.filter((i) => i.type === 'opt').length
        const styles = r.issues.length - bugs - opts
        codeStatus.textContent = `检查完成：共 ${r.lines} 行 · 疑似风险 ${bugs} / 优化点 ${opts} / 规范 ${styles} · 最大嵌套 ${r.maxDepth}`
        showIssues(r.issues)
      }

      const cfgVisible = () => {
        const node = body.querySelector('#cc-config')
        if (node) node.style.display = node.style.display === 'none' ? 'block' : 'none'
      }
      const loadCfg = () => {
        const u = body.querySelector('#cc-url'); const k = body.querySelector('#cc-key'); const m = body.querySelector('#cc-model')
        if (aiCfg && aiCfg.url) u.value = aiCfg.url
        if (aiCfg && aiCfg.key) k.value = aiCfg.key
        if (aiCfg && aiCfg.model) m.value = aiCfg.model
      }
      body.querySelector('#cc-savecfg').onclick = () => {
        const u = val('#cc-url').trim() || 'https://api.deepseek.com/v1/chat/completions'
        const k = val('#cc-key').trim()
        const m = val('#cc-model').trim() || 'deepseek-chat'
        if (!k) { codeStatus.textContent = '请填写 API Key'; return }
        aiCfg = { url: u, key: k, model: m }
        try { localStorage.setItem(CC_AI_KEY, JSON.stringify(aiCfg)) } catch (e) { /* ignore */ }
        codeStatus.textContent = '✓ AI 配置已保存（仅存本机）'
        void runAi()
      }
      const runAi = async () => {
        const code = val('#cc-in')
        if (!code.trim()) { codeStatus.textContent = '请先粘贴代码'; return }
        if (!aiCfg || !aiCfg.key) { codeStatus.textContent = '请先配置 AI 接口与 Key'; return }
        codeStatus.textContent = 'AI 深度评审中…（可能耗时 10-30s）'
        codeBox.innerHTML = '<div class="loading">分析中…</div>'
        try {
          const res = await fetch(aiCfg.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + aiCfg.key },
            body: JSON.stringify({
              model: aiCfg.model || 'deepseek-chat',
              messages: [
                { role: 'system', content: '你是一名资深代码评审专家。请用中文给出：1) 疑似 Bug；2) 优化点；3) 规范/安全建议。每条简短标注行号/片段。' },
                { role: 'user', content: '请评审以下代码：\n\n```\n' + code + '\n```' },
              ],
              stream: false,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status))
          const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
          codeStatus.textContent = '✓ AI 评审完成'
          codeBox.innerHTML = `<div class="answer" style="white-space:pre-wrap">${esc(text || '（无返回内容）')}</div>`
        } catch (error) {
          codeStatus.textContent = 'AI 评审失败：' + String(error && error.message || error)
        }
      }
      // 配置按钮点击后可直接触发评审
      // AI 按钮：已配置 Key 则直接评审；否则展开配置
      const aiBtn = body.querySelector('#cc-ai')
      aiBtn.onclick = () => {
        cfgVisible()
        loadCfg()
        if (aiCfg && aiCfg.key) void runAi()
      }
    }
  }

  renderTabs()
  renderBody()
}

/* -------------------------------- 休息一下 ------------------------------ */

// 内置游戏清单：新增游戏时把独立单文件 HTML 放到 ui/games/ 下，并在下面登记即可
const GAMES = [
  {
    title: '雷霆战机',
    tag: '射击',
    ico: '🚀',
    color: '#0ea5e9',
    desc: '经典纵版射击：闪避弹幕、连击敌机、挑战 Boss，冲击最高分。',
    hint: '←→ / WASD 移动 · 空格连射 · P 暂停',
    src: '/wangtie-os/ui/games/thunder-force.html',
  },
  {
    title: '贪吃蛇',
    tag: '休闲',
    ico: '🐍',
    color: '#22c55e',
    desc: '经典贪吃蛇：吃食物变长加速，撞墙或咬到自己即结束，冲击更高分。',
    hint: '←↑↓→ / WASD 转向 · 空格/P 暂停 · Enter 开始',
    src: '/wangtie-os/ui/games/snake.html',
  },
  {
    title: '植物大战僵尸',
    tag: '塔防',
    ico: '🌻',
    color: '#f0a11c',
    desc: '昼夜三关塔防：种植物挡僵尸，收集阳光，扛过 10 波进攻守住你的草坪。',
    hint: '1–8 选植物 · S 铲子 · P 暂停 · 点击阳光收集 · Enter 开始',
    src: '/wangtie-os/ui/games/plants-vs-zombies.html',
  },
  {
    title: '英雄联盟',
    tag: 'MOBA',
    ico: '⚔️',
    color: '#1f8fff',
    desc: '大型多人在线竞技网游：5v5 峡谷对决、排位上分。需网络与游戏客户端，点击后在新窗口打开国服官网。',
    hint: '外链游戏 · 打开 lol.qq.com（国服）',
    external: true,
    url: 'https://lol.qq.com/',
  },
]

// 十六进制颜色 → rgba()，用于生成游戏卡缩略图渐变（兼容旧版 Safari）
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

PAGES.entertainment = async (el) => {
  el.innerHTML = `
    <div class="section-title">休息一下 <span class="muted">内置小游戏 · 工作之余放松一下</span></div>
    <div class="game-grid">
      ${GAMES.map((g) => `
        <div class="game-card" data-src="${g.src ? esc(g.src) : ''}" data-url="${g.url ? esc(g.url) : ''}" data-title="${esc(g.title)}">
          <div class="game-thumb" style="background:radial-gradient(circle at 50% 120%, ${hexToRgba(g.color, 0.45)}, transparent 62%), linear-gradient(180deg, ${hexToRgba(g.color, 0.16)}, #eef4ff);box-shadow:inset 0 0 26px ${hexToRgba(g.color, 0.3)}">${g.ico || '🎮'}</div>
          <div class="game-info">
            <div class="game-name">${esc(g.title)} <span class="tag blue">${esc(g.tag)}</span>${g.external ? ' <span class="tag green">外链</span>' : ''}</div>
            <div class="game-desc">${esc(g.desc)}</div>
            <div class="muted">${esc(g.hint)}</div>
          </div>
          <button class="btn primary game-play">${g.external ? '🌐 打开' : '▶ 开始游戏'}</button>
        </div>`).join('')}
    </div>
    <div class="muted" style="margin:4px 2px 0">内置小游戏：进入后先点击游戏画面激活键盘，再按 Enter 开始，P 暂停，Esc/「返回」退出；外链游戏（英雄联盟等）将直接在新窗口打开官网。</div>`
  el.querySelectorAll('.game-play').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.game-card')
      if (card.dataset.url) {
        window.open(card.dataset.url, '_blank', 'noopener')
      } else {
        launchGame(card.dataset.src, card.dataset.title)
      }
    }
  })
}

// 全屏游戏启动层：覆盖整个 OS 界面，返回后不影响下层页面状态
function launchGame(src, title) {
  const layer = document.createElement('div')
  layer.className = 'game-layer'
  layer.innerHTML = `
    <div class="game-layer-bar">
      <button class="btn" data-act="back">← 返回王铁 OS</button>
      <div class="game-layer-title">🎮 ${esc(title)}</div>
      <div class="muted" style="flex:1">点击画面激活键盘 · 游戏内可点「⛶ 全屏」或按 F 拉满画面 · Esc 返回王铁 OS</div>
    </div>
    <div class="game-layer-stage"><iframe src="${esc(src)}" title="${esc(title)}" allow="autoplay; fullscreen"></iframe></div>`
  const close = () => { window.removeEventListener('keydown', onKey); layer.remove() }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  window.addEventListener('keydown', onKey)
  layer.querySelector('[data-act="back"]').onclick = close
  // 顶部工具条自动隐藏：鼠标移到窗口最上方时再出现，平时把整屏让给游戏
  const bar = layer.querySelector('.game-layer-bar')
  layer.classList.add('game-layer--auto')
  layer.addEventListener('mousemove', (e) => {
    layer.classList.toggle('game-layer--peek', e.clientY <= 74)
  })
  document.body.append(layer)
  // 自动聚焦游戏画面，让键盘事件直接进入 iframe（同源可聚焦）
  const frame = layer.querySelector('iframe')
  const focusFrame = () => { try { frame.contentWindow.focus() } catch (err) { /* 忽略聚焦限制 */ } }
  frame.addEventListener('load', focusFrame)
  setTimeout(focusFrame, 350)
}

/* --------------------------------- 启动 -------------------------------- */

// 先从 IndexedDB 恢复历史投喂文档，再渲染首屏
;(async () => {
  await hydrateKnowledge()
  shellAndRender()
})()
