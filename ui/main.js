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
  const res = await fetch(`${API}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

function rendered(node) {
  $('#app').replaceChildren(node)
}

function shell(page) {
  const nav = [
    ['dashboard', '工作台', '🏠'],
    ['query', '数据查询', '🔍'],
    ['knowledge', '知识库', '📚'],
    ['agent', '王铁 Agent', '🤖'],
    ['dictionary', '数据字典工具', '📖'],
    ['metadata', '元数据管理', '🗂️'],
    ['notes', '记事本', '📝'],
    ['devtools', '常用开发工具', '🧰'],
    ['entertainment', '休息一下', '🎮'],
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
        ${nav.map(([id, label, ico]) => `
          <div class="nav-item ${state.page === id ? 'active' : ''}" data-page="${id}">
            <span class="ico">${ico}</span><span>${label}</span>
          </div>`).join('')}
      </nav>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="crumb">王铁 OS <span class="muted" id="crumb-sub"></span></div>
        <div class="right" id="top-right"></div>
      </div>
      <div class="content" id="page"></div>
    </div>`
  el.querySelectorAll('.nav-item').forEach((item) => {
    item.onclick = () => { state.page = item.dataset.page; shellAndRender() }
  })
  // 环境切换仅在「数据查询」模块内提供（SIT / UAT / 准生产），全局不再展示
  const sub = el.querySelector('#crumb-sub')
  sub.textContent = `— ${nav.find(([id]) => id === state.page)?.[1] ?? ''}`
  initWeatherWidget(el.querySelector('#top-right'))
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

// ---------- 右上角天气（默认查询；Open-Meteo，无需 Key） ----------
const WEATHER_DEFAULT_CITY = '北京'
const WEATHER_KEY = 'wt-weather-city'
const WEATHER_AUTO_KEY = 'wt-weather-auto'
const WEATHER_S = { city: '', data: null, ts: 0, busy: false }

const WMO = {
  0: ['☀️', '晴'], 1: ['🌤️', '晴间多云'], 2: ['⛅', '多云'], 3: ['☁️', '阴'],
  45: ['🌫️', '雾'], 48: ['🌫️', '雾凇'], 51: ['🌦️', '毛毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌦️', '毛毛雨'],
  61: ['🌧️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'], 66: ['🌧️', '冻雨'], 67: ['🌧️', '冻雨'],
  71: ['🌨️', '小雪'], 73: ['🌨️', '中雪'], 75: ['❄️', '大雪'], 77: ['❄️', '雪粒'],
  80: ['🌦️', '阵雨'], 81: ['🌧️', '强阵雨'], 82: ['⛈️', '暴雨'],
  85: ['🌨️', '阵雪'], 86: ['❄️', '强阵雪'], 95: ['⛈️', '雷阵雨'], 96: ['⛈️', '雷雨伴冰雹'], 99: ['⛈️', '强雷雨伴冰雹'],
}
const wmoInfo = (code) => WMO[code] || ['🌡️', '未知']

const CITY_COORDS = {
  '北京': [39.9042, 116.4074], '上海': [31.2304, 121.4737], '广州': [23.1291, 113.2644],
  '深圳': [22.5431, 114.0579], '杭州': [30.2741, 120.1551], '成都': [30.5728, 104.0668],
  '武汉': [30.5928, 114.3055], '西安': [34.3416, 108.9398], '南京': [32.0603, 118.7969],
  '重庆': [29.5630, 106.5516], '天津': [39.3434, 117.3616], '苏州': [31.2989, 120.5853],
  '长沙': [28.2282, 112.9388], '郑州': [34.7466, 113.6254], '济南': [36.6512, 117.1201],
  '青岛': [36.0671, 120.3826], '厦门': [24.4798, 118.0894], '福州': [26.0745, 119.2965],
  '沈阳': [41.8057, 123.4315], '大连': [38.9140, 121.6147], '昆明': [24.8801, 102.8329],
  '乌鲁木齐': [43.8256, 87.6168], '拉萨': [29.6520, 91.1721], '哈尔滨': [45.8038, 126.5349],
}
async function weatherGeocode(name) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=1&language=zh&format=json'
  const res = await fetch(url)
  if (!res.ok) throw new Error('地理编码服务不可用')
  const json = await res.json()
  const g = json && json.results && json.results[0]
  if (!g) throw new Error('未找到城市：' + name)
  return g
}

async function weatherFetch(city) {
  const key = String(city || '').trim().replace(/市$/, '')
  let lat, lon, geoName
  const coords = CITY_COORDS[key]
  if (coords) { lat = coords[0]; lon = coords[1]; geoName = key + '市' }
  else {
    // 坐标表未命中：尝试在线地理编码
    let g
    try { g = await weatherGeocode(city) } catch (error) { throw new Error('未收录该城市，可尝试：' + Object.keys(CITY_COORDS).join(' / ')) }
    lat = g.latitude; lon = g.longitude; geoName = g.name || city
  }
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
    '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=auto&forecast_days=1'
  const res = await fetch(url)
  if (!res.ok) throw new Error('天气服务不可用')
  const json = await res.json()
  const c = json.current
  return {
    city: String(city || '').trim() || geoName,
    admin: geoName + ' · 坐标 ' + lat.toFixed(2) + ',' + lon.toFixed(2),
    temp: Math.round(c.temperature_2m),
    feel: Math.round(c.apparent_temperature),
    hum: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.wind_speed_10m),
    code: c.weather_code,
    isDay: c.is_day === 1,
  }
}

// 按经纬度直达查询（自动定位用）
async function weatherFetchCoord(lat, lon, label, admin) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
    '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=auto&forecast_days=1'
  const res = await fetch(url)
  if (!res.ok) throw new Error('天气服务不可用')
  const json = await res.json()
  const c = json.current
  return {
    city: label || '当前位置',
    admin: admin || '',
    temp: Math.round(c.temperature_2m),
    feel: Math.round(c.apparent_temperature),
    hum: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.wind_speed_10m),
    code: c.weather_code,
    isDay: c.is_day === 1,
  }
}

// IP 定位：优先 ip-api（返回中文城市），失败退回 geojs（仅坐标）
async function detectLocation() {
  const candidates = [
    async () => {
      const res = await fetch('http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,city,regionName,lat,lon')
      if (!res.ok) return null
      const j = await res.json()
      if (j && j.status === 'success') {
        const label = j.city || j.regionName || j.country || ''
        const admin = [j.country, j.regionName].filter(Boolean).join(' · ')
        return { lat: j.lat, lon: j.lon, label, admin }
      }
      return null
    },
    async () => {
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
      if (!res.ok) return null
      const j = await res.json()
      const lat = parseFloat(j.latitude)
      const lon = parseFloat(j.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon, label: j.country || '当前位置', admin: j.timezone || '' }
    },
  ]
  for (const fn of candidates) {
    try {
      const d = await fn()
      if (d) return d
    } catch (error) { /* 尝试下一个 */ }
  }
  return null
}

async function weatherRefresh(city) {
  const data = await weatherFetch(city)
  WEATHER_S.city = city
  WEATHER_S.data = data
  WEATHER_S.ts = Date.now()
  WEATHER_S.busy = false
  try {
    localStorage.setItem(WEATHER_KEY, city)
    localStorage.setItem(WEATHER_AUTO_KEY, '0')
  } catch (error) { /* ignore */ }
  return data
}

async function weatherEnsure(force) {
  const stored = WEATHER_S.city || (function () { try { return localStorage.getItem(WEATHER_KEY) } catch (e) { return null } })() || WEATHER_DEFAULT_CITY
  const freshEnough = WEATHER_S.data && WEATHER_S.city === stored && Date.now() - WEATHER_S.ts < 10 * 60 * 1000
  if (!force && freshEnough) return WEATHER_S.data
  if (WEATHER_S.busy) return WEATHER_S.data
  WEATHER_S.busy = true
  WEATHER_S.city = stored
  return weatherRefresh(stored)
}

function initWeatherWidget(root) {
  if (!root) return
  const chipHtml = (d, loading) => d
    ? `<span class="w-ico">${wmoInfo(d.code)[0]}</span><b>${d.temp}°</b><span class="w-city">${esc(d.city)}</span>`
    : (loading ? '天气加载中…' : '🌤 天气')
  root.innerHTML = `
    <div class="weather-wrap">
      <button class="weather-chip" id="w-chip" title="查看 / 切换城市">${chipHtml(null, true)}</button>
      <div class="weather-panel" id="w-panel" hidden>
        <div class="w-head">🌍 天气 <span class="muted">Open-Meteo · 免费数据</span></div>
        <div class="row" style="margin:8px 0">
          <input type="text" id="w-city" placeholder="输入城市名，如 上海" style="flex:1">
          <button class="btn primary sm" id="w-go">查询</button>
        </div>
        <div class="row w-quick" id="w-quick">
          ${['北京', '上海', '广州', '深圳', '杭州'].map((c) => `<button class="btn sm" data-city="${c}">${c}</button>`).join('')}
        </div>
        <div id="w-info" class="w-info"></div>
      </div>
    </div>`
  const chip = root.querySelector('#w-chip')
  const panel = root.querySelector('#w-panel')
  const info = root.querySelector('#w-info')
  const cityInput = root.querySelector('#w-city')
  const renderInfo = (d, extra) => {
    if (!d) { info.innerHTML = `<div class="muted">${esc(extra || '暂无数据')}</div>`; return }
    const [ico, desc] = wmoInfo(d.code)
    info.innerHTML = `
      <div class="w-main">${ico} <b>${d.temp}°C</b> <span>${desc}</span></div>
      <div class="muted w-sub">${esc(d.city)}${d.admin ? '（' + esc(d.admin) + '）' : ''}</div>
      <div class="muted w-sub">体感 ${d.feel}° · 湿度 ${d.hum}% · 风速 ${d.wind} km/h</div>`
  }
  const doQuery = async (name, force) => {
    const target = (name || cityInput.value || '').trim()
    if (!target) return
    cityInput.value = target
    chip.innerHTML = '天气查询中…'
    try {
      const d = await weatherRefresh(target)
      renderInfo(d)
      chip.innerHTML = chipHtml(d)
    } catch (error) {
      chip.innerHTML = '⚠ 天气不可用'
      renderInfo(null, String(error && error.message || error))
    }
  }
  chip.onclick = () => { panel.hidden = !panel.hidden }
  root.querySelector('#w-go').onclick = () => void doQuery()
  cityInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doQuery() })
  root.querySelectorAll('#w-quick [data-city]').forEach((b) => {
    b.onclick = () => { cityInput.value = b.dataset.city; void doQuery(b.dataset.city) }
  })
  // 启动默认查询：已保存城市 > IP 自动定位 > 默认北京
  const runDefault = async () => {
    if (WEATHER_S.data && Date.now() - WEATHER_S.ts < 10 * 60 * 1000) {
      chip.innerHTML = chipHtml(WEATHER_S.data)
      renderInfo(WEATHER_S.data)
      return
    }
    chip.innerHTML = '天气定位中…'
    try {
      let savedCity = null
      try { savedCity = localStorage.getItem(WEATHER_KEY) } catch (error) { /* ignore */ }
      let d = null
      if (savedCity) {
        d = await weatherRefresh(savedCity)
      } else {
        const det = await detectLocation()
        if (det) {
          d = await weatherFetchCoord(det.lat, det.lon, det.label || '当前位置', det.admin || '')
          try {
            localStorage.setItem(WEATHER_KEY, det.label || 'auto')
            localStorage.setItem(WEATHER_AUTO_KEY, '1')
          } catch (error) { /* ignore */ }
        } else {
          d = await weatherRefresh(WEATHER_DEFAULT_CITY) // 探测失败 → 默认北京
        }
      }
      WEATHER_S.city = d.city
      WEATHER_S.data = d
      WEATHER_S.ts = Date.now()
      chip.innerHTML = chipHtml(d)
      renderInfo(d)
    } catch (error) {
      chip.innerHTML = '⚠ 天气不可用'
    }
  }
  void runDefault()
}

/* ------------------------------ 工作台 ---------------------------- */

PAGES.dashboard = async (el) => {
  el.innerHTML = `
    <div class="section-title">工作台</div>
    <div class="grid">
      ${[
        ['knowledge', '📚', '知识库', '票据 / 会计两级知识库：检索问答 + 知识投喂（RAG）'],
        ['query', '🔍', '数据查询', '多环境 SQL 查询，表名自动补全'],
        ['agent', '🤖', '王铁 Agent', '日志关键字检索与异常链分析'],
        ['dictionary', '📖', '数据字典工具', '字典一键导入 / 搜索 / 分类'],
        ['metadata', '🗂️', '元数据管理', '表清单 / 表结构比对 / 版本历史'],
        ['notes', '📝', '记事本', '记录开发常用命令 / 配置 / 笔记，自动保存'],
        ['devtools', '🧰', '常用开发工具', 'JSON 解析 / Base64 / 时间戳等在线工具'],
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
      ['王铁 Agent', '日志检索与异常链分析'],
      ['数据字典', '字典检索与一键导入'],
      ['元数据管理', '表结构管理与版本比对'],
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
      ['王铁 Agent', '日志检索与异常链分析'],
      ['数据字典', '字典检索与一键导入'],
      ['元数据管理', '表结构管理与版本比对'],
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
  // 常用数据库类型与默认端口（与后端 /api/db/test 的默认端口一致）
  const DB_TYPES = [
    ['oracle', 'Oracle'],
    ['mysql', 'MySQL'],
    ['postgresql', 'PostgreSQL'],
    ['sqlserver', 'SQL Server'],
    ['dm', '达梦 DM'],
    ['kingbase', '人大金仓 Kingbase'],
    ['oceanbase', 'OceanBase'],
  ]
  const DB_DEFAULT_PORT = {
    oracle: 1521, mysql: 3306, postgresql: 5432, sqlserver: 1433,
    dm: 5236, kingbase: 54321, oceanbase: 2881,
  }
  const DB_PROFILE_KEY = 'wangtie-db-profile'

  el.innerHTML = `
    <div class="section-title">数据查询 <span class="muted">自定义数据库连接 · SQL 执行（当前为 Mock 数据源演示）</span></div>

    <div class="card">
      <h3>🔌 数据库连接 <span class="muted" id="db-note"></span></h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:8px 18px;margin-bottom:10px">
        <div class="row"><span class="muted" style="width:130px">数据库类型</span>
          <select id="db-type" style="flex:1">${DB_TYPES.map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}</select></div>
        <div class="row"><span class="muted" style="width:130px">数据库地址</span>
          <input type="text" id="db-host" placeholder="IP / 域名，如 10.23.144.212" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">端口</span>
          <input type="text" id="db-port" placeholder="留空自动按类型填充" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">数据库名 / SID</span>
          <input type="text" id="db-name" placeholder="可留空" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">用户名</span>
          <input type="text" id="db-user" placeholder="请输入用户名" style="flex:1"></div>
        <div class="row"><span class="muted" style="width:130px">密码</span>
          <input type="password" id="db-pass" placeholder="请输入密码" style="flex:1">
          <button type="button" class="btn sm" id="db-pass-eye" title="显示 / 隐藏密码">👁</button></div>
      </div>
      <div class="row">
        <button class="btn primary" id="db-test">🧪 测试连接</button>
        <button class="btn" id="db-save">💾 保存配置</button>
        <span id="db-test-res" class="muted"></span>
      </div>
    </div>

    <div class="card">
      <h3>SQL 执行 <span class="muted">表名自动补全（Mock 结果；接入真实数据库网关后直连查询）</span></h3>
      <textarea id="sql-text" rows="4" placeholder="请输入您的SQL语句"></textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="sql-run">▶ 执行查询</button>
        <button class="btn" id="sql-export">导出 CSV</button>
        <span class="muted" id="sql-cost"></span>
      </div>
    </div>
    <div id="sql-result"></div>`

  const $id = (id) => el.querySelector('#' + id)

  const readProfile = () => ({
    type: $id('db-type').value,
    host: $id('db-host').value.trim(),
    port: $id('db-port').value.trim(),
    dbName: $id('db-name').value.trim(),
    username: $id('db-user').value.trim(),
    password: $id('db-pass').value,
  })

  const applyProfile = (profile) => {
    if (!profile) return
    $id('db-type').value = profile.type || 'mysql'
    $id('db-host').value = profile.host || ''
    $id('db-port').value = profile.port || ''
    $id('db-name').value = profile.dbName || ''
    $id('db-user').value = profile.username || ''
    $id('db-pass').value = profile.password || ''
    if (!$id('db-port').value) $id('db-port').value = DB_DEFAULT_PORT[$id('db-type').value] || ''
  }

  // 载入本机已保存的配置
  try {
    applyProfile(JSON.parse(localStorage.getItem(DB_PROFILE_KEY) || 'null'))
  } catch (error) { /* ignore */ }

  // 切换类型时自动填充默认端口（端口为空，或等于任一类型的默认端口时覆盖）
  $id('db-type').addEventListener('change', () => {
    const cur = $id('db-port').value.trim()
    const isDefault = Object.values(DB_DEFAULT_PORT).some((p) => String(p) === cur)
    if (cur === '' || isDefault) {
      $id('db-port').value = DB_DEFAULT_PORT[$id('db-type').value] || ''
    }
  })

  // 显示 / 隐藏密码（明文查看）
  const passEye = $id('db-pass-eye')
  if (passEye) {
    passEye.onclick = () => {
      const pass = $id('db-pass')
      const show = pass.type === 'password'
      pass.type = show ? 'text' : 'password'
      passEye.textContent = show ? '🙈' : '👁'
      passEye.title = show ? '隐藏密码' : '显示密码'
      pass.focus()
    }
  }

  const setTestResult = (html, ok) => {
    const node = $id('db-test-res')
    node.innerHTML = html
    node.style.color = ok === true ? 'var(--green)' : (ok === false ? 'var(--red)' : 'var(--text-2)')
  }

  // —— 测试连接：由后端真实探测 地址:端口 ——
  $id('db-test').onclick = async () => {
    const profile = readProfile()
    if (!profile.host) {
      setTestResult('✗ 请先填写数据库地址', false)
      return
    }
    setTestResult('正在测试连接（后端 TCP 探测）…', null)
    try {
      const data = await api('/api/db/test', { method: 'POST', body: JSON.stringify(profile) })
      if (data.ok) {
        setTestResult(`✓ <b>连接成功</b> · ${esc(data.host)}:${data.port}（${data.ms}ms）— ${esc(data.detail)}`, true)
      } else {
        setTestResult(`✗ <b>连接失败</b> · ${esc(data.code || '')} — ${esc(data.detail || '目标不可达')}`, false)
      }
    } catch (error) {
      const message = String(error)
      setTestResult(
        message.includes('404')
          ? '✗ 探测接口尚未生效：后端改动需要<b>重启 DSH Web</b> 后才能启用（其余配置与保存不受影响）'
          : `✗ 测试请求失败：${esc(message)}`, false)
    }
  }

  // —— 保存配置（本机浏览器）——
  $id('db-save').onclick = () => {
    try {
      localStorage.setItem(DB_PROFILE_KEY, JSON.stringify(readProfile()))
      $id('db-note').textContent = '✓ 已保存（存储于本机浏览器）'
    } catch (error) {
      $id('db-note').textContent = '保存失败：' + String(error)
    }
  }

  // —— SQL 执行（Mock 演示）——
  const run = async () => {
    const sql = $id('sql-text').value
    const box = $id('sql-result')
    box.innerHTML = `<div class="loading">执行中…</div>`
    try {
      const data = await api('/api/sql/query', { method: 'POST', body: JSON.stringify({ sql }) })
      $id('sql-cost').textContent = `cost ${data.costMs}ms · 表 ${data.table ?? '未识别'}`
      if (!data.table) {
        box.innerHTML = `<div class="card"><div class="muted">${esc(data.message)}</div></div>`
        return
      }
      box.innerHTML = card('查询结果', table(
        data.columns.map((col) => `${col.name} (${col.cn})`),
        data.rows.map((row) => data.columns.map((col) => row[col.name] ?? '')),
      ))
    } catch (error) {
      box.innerHTML = `<div class="error-text">${esc(String(error))}</div>`
    }
  }
  $id('sql-run').onclick = run
  $id('sql-export').onclick = async () => {
    const rows = el.querySelectorAll('#sql-result tbody tr')
    const csv = [...rows].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'query-result.csv'
    a.click()
  }
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
        <div class="kb-drop" id="kb-drop">点击选择或拖入知识文件（可多选）<br><span class="muted">支持 .txt / .md（【标题】分篇）、.json（文档数组）与 .docx（Word，自动提取正文），一次可投喂大量知识</span></div>
        <input type="file" id="kb-file" accept=".txt,.md,.markdown,.json,.docx,text/plain,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden>
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
      showResult(card(`${name}文档`, table(['文档ID', '标题', '类别', '摘要'], live().map((doc) => [doc.id, doc.title, `${doc.category}${doc.custom ? '（已投喂）' : ''}`, doc.summary]))))
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

/* ------------------------------ 王铁 Agent --------------------------- */

const STEPS = [
  ['1 下载日志', '下载 scb-online_20260828.log（518.6 KB，按需截取）', '1.2s'],
  ['2 关键字检索', '命中关键字…（上下各 5 行上下文）', '0.8s'],
  ['3 去噪', '过滤心跳/常规日志 2 处，保留异常上下文', '0.3s'],
  ['4 异常链分析', '识别 1 条异常链，1 类报错', '3.1s'],
  ['5 生成报告', '已保存到历史分析报告', '0.4s'],
]

PAGES.agent = (el) => {
  el.innerHTML = `
    <div class="section-title">王铁 Agent <span class="muted">日志关键字检索（ccc-log-context-skill 演示）</span></div>
    <div class="card">
      <div class="row">
        <span class="muted">实例：</span>
        <select id="ag-instance"><option>scb-online</option><option>scb-batch</option></select>
        <input type="text" id="ag-keyword" placeholder="输入检索关键字，例如 WLC1779977345791" style="flex:1">
        <button class="btn primary" id="ag-run">开始检索</button>
      </div>
    </div>
    <div class="card">
      <h3>历史分析报告（102）</h3>
      <div id="ag-reports"><div class="loading">加载中…</div></div>
    </div>
    <div id="ag-result"></div>`
  const refresh = async () => {
    try {
      const reports = await api('/api/agent/reports')
      el.querySelector('#ag-reports').innerHTML = reports.length
        ? table(['检索线', '环境', '实例', '生成时间', '报错类型', '操作'], reports.map((r) => [r.keyword, r.env, r.instance, r.createdAt, r.errorType, '查看']))
        : `<div class="empty">暂无报告</div>`
      el.querySelectorAll('#ag-reports tbody tr').forEach((tr) => {
        tr.onclick = async () => {
          const id = reports[tr.rowIndex].id
          try {
            const report = await api(`/api/agent/reports?id=${encodeURIComponent(id)}`)
            show(runReport(report))
          } catch (error) {
            show(`<div class="error-text">${esc(String(error))}</div>`)
          }
        }
      })
    } catch (error) {
      el.querySelector('#ag-reports').innerHTML = `<div class="error-text">${esc(String(error))}</div>`
    }
  }
  refresh()
  const show = (html) => { el.querySelector('#ag-result').innerHTML = html }
  el.querySelector('#ag-run').onclick = async () => {
    const keyword = el.querySelector('#ag-keyword').value.trim()
    if (!keyword) return
    const box = el.querySelector('#ag-result')
    box.innerHTML = `<div class="card"><h3>检索过程</h3><div class="loading">开始检索…</div></div>`
    try {
      const data = await api('/api/agent/log-search', { method: 'POST', body: JSON.stringify({ env: state.env, instance: el.querySelector('#ag-instance').value, keyword }) })
      const steps = data.steps.map((s, i) => `<div>${esc(s.step)}：${esc(s.detail)} <span class="muted">(${esc(s.cost)})</span></div>`).join('\n')
      show(card('检索过程', `<pre class="log">${steps}</pre>`) + runReport(data.report))
      refresh()
    } catch (error) {
      show(`<div class="error-text">${esc(String(error))}</div>`)
    }
  }
  const runReport = (r) => card('异常链摘要', `
    <div class="error-text" style="padding:0 0 8px">${esc(r.exception)}</div>
    <div class="muted" style="margin-bottom:8px">错误类型：<span class="tag red">${esc(r.errorType)}</span> · 命中 ${r.hits} 处 · ${esc(r.logSize)} · 耗时 ${r.costMs}ms</div>
    ${r.relatedErrors?.length ? `<div style="margin:6px 0"><div class="muted">相关错误链：</div>${r.relatedErrors.map((e) => `<div class="cite">${esc(e)}</div>`).join('')}</div>` : ''}
    ${r.codeSnippet?.length ? `<pre class="log">${r.codeSnippet.map((line) => esc(line)).join('\n')}</pre>` : ''}
    <div style="margin-top:8px"><span class="muted">处理建议：</span>${esc(r.suggestion)}</div>`)
}

/* ------------------------------- 数据字典 ------------------------------ */

PAGES.dictionary = async (el) => {
  const render = async (q = '', category = '') => {
    try {
      const data = await api(`/api/dictionary/entries?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`)
      el.querySelector('#dict-total').textContent = `共 ${data.total} 条`
      el.querySelector('#dict-body').innerHTML = table(['中文名', '英文名', '编码', '属性值', '分类', '数据来源', '版本'], data.entries.map((e) => [e.cn, e.en, e.code, e.value, e.category, e.source, e.version])) || `<div class="empty">无结果</div>`
    } catch (error) {
      el.querySelector('#dict-body').innerHTML = `<div class="error-text">${esc(String(error))}</div>`
    }
  }
  el.innerHTML = `
    <div class="section-title">数据字典工具 <span class="muted">一键导入（deepseek-harness 解析）· 中文名/英文名/编码/简述检索</span></div>
    <div class="card">
      <div class="row">
        <input type="text" id="dict-q" placeholder="输入 中文名 / 英文名 / 编码，例如：转账状态" style="flex:1">
        <button class="btn primary" id="dict-search">查询</button>
        <button class="btn" id="dict-import-toggle">一键导入</button>
        <span class="muted" id="dict-total"></span>
      </div>
      <div id="dict-import" style="display:none;margin-top:10px">
        <textarea id="dict-payload" rows="3" placeholder="每行一条：中文名,英文名,编码,属性值,分类"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn" id="dict-do-import">解析导入</button><span class="muted" id="dict-import-note"></span></div>
      </div>
    </div>
    <div class="card"><div id="dict-body"><div class="loading">加载中…</div></div></div>`
  el.querySelector('#dict-search').onclick = () => render(el.querySelector('#dict-q').value)
  el.querySelector('#dict-import-toggle').onclick = () => { const box = el.querySelector('#dict-import'); box.style.display = box.style.display === 'none' ? 'block' : 'none' }
  el.querySelector('#dict-do-import').onclick = async () => {
    try {
      const data = await api('/api/dictionary/import', { method: 'POST', body: JSON.stringify({ payload: el.querySelector('#dict-payload').value }) })
      el.querySelector('#dict-import-note').textContent = `导入成功 ${data.imported} 条`
      render('')
    } catch (error) {
      el.querySelector('#dict-import-note').textContent = `导入失败：${String(error)}`
    }
  }
  render()
}

/* -------------------------------- 元数据管理 --------------------------- */

PAGES.metadata = async (el) => {
  el.innerHTML = `
    <div class="section-title">元数据管理 <span class="muted">环境管理 · 表清单 · 表结构 · 比对 · 版本</span></div>
    <div class="row" style="margin-bottom:12px">
      ${['tables', 'compare', 'versions', 'alter'].map((t) => `<button class="btn" data-mtab="${t}">${({ tables: '表清单', compare: '表结构比对', versions: '版本历史', alter: '结构变更' })[t]}</button>`).join('')}
    </div>
    <div id="md-body"><div class="loading">加载中…</div></div>`
  const apiUrl = (t) => `/api/metadata/${t}`
  const renderTab = async (tab) => {
    const box = el.querySelector('#md-body')
    box.innerHTML = `<div class="loading">加载中…</div>`
    try {
      if (tab === 'tables') {
        const list = await api(`${apiUrl('tables')}?env=${state.env}`)
        box.innerHTML = `<div class="card"><h3>表清单 · ${state.env} <span class="muted">（共 ${list.length} 张演示表）</span></h3>
          ${table(['表名', '中文名', '业务域', '字段数'], list.map((t) => [t.name, t.cn, t.domain, t.fieldCount]))}</div>
          <div id="md-table-detail"></div>`
        box.querySelectorAll('#md-body table tbody tr').forEach((tr) => {
          tr.onclick = async () => {
            const name = tr.children[0].textContent
            try {
              const detail = await api(`${apiUrl('table')}?env=${state.env}&name=${encodeURIComponent(name)}`)
              box.querySelector('#md-table-detail').innerHTML = card(`表结构：${detail.name}（${detail.columns.length} 列）`, table(['序号', '字段名', '字段中文名', '类型', '主键', '注释'], detail.columns.map((col, i) => [i + 1, col.name, col.cn, col.type, col.pk ? '是' : '', col.comment ?? ''])))
            } catch (error) {
              box.querySelector('#md-table-detail').innerHTML = `<div class="error-text">${esc(String(error))}</div>`
            }
          }
        })
      } else if (tab === 'compare') {
        box.innerHTML = `<div class="card"><h3>表结构比对</h3>
          <div class="row">
            <select id="cmp-a">${ENV_OPTIONS.map(([value, label], i) => `<option value="${value}" ${i === 0 ? 'selected' : ''}>${label}</option>`).join('')}</select>
            <span class="muted">→</span>
            <select id="cmp-b">${ENV_OPTIONS.map(([value, label], i) => `<option value="${value}" ${i === 1 ? 'selected' : ''}>${label}</option>`).join('')}</select>
            <select id="cmp-table">${(await api(`${apiUrl('tables')}?env=SIT`)).map((t) => `<option>${t.name}</option>`).join('')}</select>
            <button class="btn primary" id="cmp-run">开始比对</button>
          </div></div><div id="cmp-result"></div>`
        el.querySelector('#cmp-run').onclick = async () => {
          const data = await api(`${apiUrl('compare')}?a=${el.querySelector('#cmp-a').value}&b=${el.querySelector('#cmp-b').value}&name=${el.querySelector('#cmp-table').value}`)
          el.querySelector('#cmp-result').innerHTML = `
            <div class="card"><h3>比对结果：${data.table}</h3>
            <div class="muted" style="margin-bottom:8px">A=${data.a}（共 ${data.aCount} 列） · B=${data.b}（共 ${data.bCount} 列）</div>
            ${card('A 独有字段', data.aOnly.length ? table(['字段名', '中文名', '类型'], data.aOnly.map((col) => [col.name, col.cn, col.type])) : '<div class="empty">无</div>')}
            ${card('B 独有字段', data.bOnly.length ? table(['字段名', '中文名', '类型'], data.bOnly.map((col) => [col.name, col.cn, col.type])) : '<div class="empty">无</div>')}
            ${card('类型不一致', data.typeDiffs.length ? table(['字段名', 'A 类型', 'B 类型'], data.typeDiffs.map((col) => [col.name, col.type, (data.aOnly.find((x) => x.name === col.name) ?? col).type])) : '<div class="empty">无</div>')}
          </div>`
        }
      } else if (tab === 'versions') {
        const versions = await api(`${apiUrl('versions')}?env=${state.env}`)
        box.innerHTML = `<div class="card"><h3>版本历史 · ${state.env}</h3>${versions.map((v) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div class="row"><span class="tag blue">${esc(v.version)}</span><span class="muted">${esc(v.time)}</span><span class="muted">${v.tables} 表 / ${v.fields} 字段</span><span class="tag green">变更 ${v.changed.length}</span></div>
            ${v.changed.map((c) => `<div class="cite">${esc(c.table)} · ${esc(c.kind)}：<b>${esc(c.field)}</b> ${c.from ? `${esc(c.from)} → ` : ''}${esc(c.to ?? '')}</div>`).join('')}
          </div>`).join('')}</div>`
      } else if (tab === 'alter') {
        box.innerHTML = `<div class="card"><h3>结构变更（保留数据）</h3>
          <div class="row">
            <select id="alt-table">${(await api(`${apiUrl('tables')}?env=SIT`)).map((t) => `<option>${t.name}</option>`).join('')}</select>
            字段名 <input id="alt-field" style="width:180px"> 类型 <input id="alt-type" value="VARCHAR2(32)" style="width:140px"> 中文注释 <input id="alt-cn" style="width:160px">
            <button class="btn" id="alt-add">添加字段</button>
          </div>
          <pre class="log" id="alt-sql" style="margin-top:10px">（点击「生成 SQL」）</pre>
          <div class="row" style="margin-top:8px"><button class="btn primary" id="alt-gen">生成 SQL</button><span class="muted">Mock：真实环境将执行到数据库</span></div></div>`
        el.querySelector('#alt-gen').onclick = async () => {
          const data = await api(`${apiUrl('alter-sql')}`, { method: 'POST', body: JSON.stringify({ table: el.querySelector('#alt-table').value, changes: [{ kind: 'add', field: el.querySelector('#alt-field').value, cn: el.querySelector('#alt-cn').value, type: el.querySelector('#alt-type').value }] }) })
          el.querySelector('#alt-sql').textContent = data.sql.join('\n') || '（无变更）'
        }
      }
    } catch (error) {
      box.innerHTML = `<div class="error-text">${esc(String(error))}</div>`
    }
  }
  el.querySelectorAll('[data-mtab]').forEach((btn) => { btn.onclick = () => renderTab(btn.dataset.mtab) })
  renderTab('tables')
}

/* -------------------------------- 记事本（印象笔记风） ------------------ */

// 存储：IndexedDB —— 笔记列表(键 all) + 笔记本列表(键 notebooks)
const NOTE_DB = 'wangtie-os-notes'
const NOTE_STORE = 'items'
const NOTE_DEFAULT_NB = ['默认笔记本', '开发速记', '票据业务', '会计']
let notesSeq = 0

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
    scope: 'all',         // all | trash | nb
    nb: null,             // 当前笔记本名（scope=nb 时）
    q: '', tag: '',
    sel: null,            // 选中笔记 id
    mode: 'edit',         // edit | preview
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
        ${note.deletedAt == null ? `
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

PAGES.devtools = (el) => {
  const TOOL_TABS = [
    ['json', 'JSON'],
    ['base64', 'Base64'],
    ['url', 'URL 编解码'],
    ['ts', '时间戳'],
    ['text', '文本统计'],
    ['hash', '哈希'],
    ['radix', '进制转换'],
    ['regex', '正则测试'],
    ['color', '颜色转换'],
    ['uuid', 'UUID 生成'],
  ]
  let active = 'json'

  const sampleJson = {
    id: 'WLC1779977345791',
    name: '王铁',
    role: '开发者',
    tags: ['票据', 'DSH'],
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
      btn.onclick = () => { active = btn.dataset.tool; renderTabs(); renderBody() }
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
        <div class="game-card" data-src="${esc(g.src)}" data-title="${esc(g.title)}">
          <div class="game-thumb" style="background:radial-gradient(circle at 50% 120%, ${hexToRgba(g.color, 0.45)}, transparent 62%), linear-gradient(180deg, ${hexToRgba(g.color, 0.16)}, #eef4ff);box-shadow:inset 0 0 26px ${hexToRgba(g.color, 0.3)}">${g.ico || '🎮'}</div>
          <div class="game-info">
            <div class="game-name">${esc(g.title)} <span class="tag blue">${esc(g.tag)}</span></div>
            <div class="game-desc">${esc(g.desc)}</div>
            <div class="muted">${esc(g.hint)}</div>
          </div>
          <button class="btn primary game-play">▶ 开始游戏</button>
        </div>`).join('')}
    </div>
    <div class="muted" style="margin:4px 2px 0">进入游戏后先点击游戏画面激活键盘（雷霆战机需同时激活声音），再按 Enter 开始；游戏中按 P 暂停，Esc 或「返回」退出游戏。</div>`
  el.querySelectorAll('.game-play').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.game-card')
      launchGame(card.dataset.src, card.dataset.title)
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
      <div class="game-layer-title">🚀 ${esc(title)}</div>
      <div class="muted" style="flex:1">点击游戏画面后按 Enter 开始 · P 暂停 · Esc 退出</div>
    </div>
    <div class="game-layer-stage"><iframe src="${esc(src)}" title="${esc(title)}" allow="autoplay"></iframe></div>`
  const close = () => { window.removeEventListener('keydown', onKey); layer.remove() }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  window.addEventListener('keydown', onKey)
  layer.querySelector('[data-act="back"]').onclick = close
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
