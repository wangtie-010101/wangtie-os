#!/usr/bin/env node
/**
 * 王铁 OS — 把本包装进 DSH 的某个 profile，之后 `dsh web` 启动即加载王铁 OS。
 *
 * 为什么不用 `pnpm dsh plugin add`：那条命令只是 pnpm 转发器（会跑 `pnpm add`），
 * 内网机器没有 npm 源 / 没有 pnpm 时会失败。本脚本只做 DSH 启动时真正需要的三件事，
 * 全程离线、不需要 pnpm：
 *   1) 把本包放到 <profile>/node_modules/wangtie-os
 *      （DSH 解析 bundle 名时会先在 dsh 安装处找，再从 profile 目录找：见
 *       packages/boot/app-boot/src/profile.ts 的 packageDirFromAnchor）
 *   2) 在 <profile>/package.json 的 dsh.profile.bundles 末尾登记 "wangtie-os"
 *      （bundle 的自带 cordis.patch.yml 会被自动应用，插件行即由此插入）
 *   3) 同时写一条 dependencies["wangtie-os"] = "file:<本包绝对路径>"，
 *      与 `pnpm dsh plugin add` 的结果保持一致，避免以后 pnpm install 把目录当多余项清掉。
 * 本包的 node_modules 已随包分发，运行期只需其中的 mysql2，无需再装依赖、无需重新构建。
 *
 * 用法（在本包根目录执行）—— 内网机器上只要这一条：
 *   node scripts/install-to-dsh.mjs
 * 它会装包、登记 profile，并**自动重启正在跑的 dsh web**（宿主半边只在进程启动时 import
 * 一次，不重启就不会加载插件）。重启完成后直接打开：
 *   http://127.0.0.1:3080/wangtie-os/          ← 王铁 OS（DSH 自己的端口，不是 3081）
 *
 * 其它参数：
 *   --profile web           指定 profile（缺省 web）
 *   --dsh-home <dir>        指定 DSH_HOME（缺省 $DSH_HOME 或 ~/.dsh）
 *   --source <dir>          指定安装源（缺省＝本包所在目录）
 *   --port 3080             指定 dsh web 的端口（自动重启时用它找进程）
 *   --no-restart            只安装，不重启（自己 Ctrl-C 后重新 dsh web）
 *   --restart-only          只重启，不安装
 *   --dry-run               只打印将要做什么
 *   --uninstall             卸载（移除登记与目录，保留备份），同样会自动重启
 *
 * 重启方式（从稳到兜底）：
 *   1) profile 里装了 dshmarket 时，走它的自重启接口 POST /dsh-market/api/v1/restart；
 *   2) 否则自己找监听端口的 dsh 进程，读出它的命令行与工作目录，起一个 detached 助手
 *      等端口释放后用**同样的命令**重新拉起，再给老进程发 SIGTERM；
 *   3) 两条都不可用时打印手动重启步骤，不影响安装结果。
 */

import { execFileSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = 'wangtie-os'
/** 复制时跳过的目录/文件（版本库、构建缓存与 macOS 垃圾；node_modules 必须一起装，运行期要里面的 mysql2）。 */
const SKIP = new Set(['.git', '.DS_Store', '.test-build', '.local-db'])

/* ------------------------------ 参数解析 ------------------------------ */

function parseArgs(argv) {
  const options = { profile: 'web', dshHome: undefined, dryRun: false, uninstall: false, source: undefined, restart: true, restartOnly: false, port: 3080 }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined]
    const value = () => inline ?? argv[++i]
    if (flag === '--profile') options.profile = value()
    else if (flag === '--dsh-home') options.dshHome = value()
    else if (flag === '--source') options.source = value()
    else if (flag === '--dry-run' || flag === '-n') options.dryRun = true
    else if (flag === '--uninstall') options.uninstall = true
    else if (flag === '--no-restart') options.restart = false
    else if (flag === '--restart') options.restart = true
    else if (flag === '--restart-only') { options.restartOnly = true; options.restart = true }
    else if (flag === '--port') options.port = Number(value())
    else if (flag === '--help' || flag === '-h') options.help = true
    else throw new Error(`未知参数：${arg}（用 --help 看用法）`)
  }
  return options
}

const say = (message) => process.stdout.write(`${message}\n`)
const step = (message) => process.stdout.write(`  ${message}\n`)

/* ------------------------------ 基础路径 ------------------------------ */

/** 本脚本所在包的根目录（也是默认的安装源）。 */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = (options) => resolve(options.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'))

function profilesIn(home) {
  const dir = join(home, 'profiles')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(dir, entry.name, 'cordis.yml')))
    .map(entry => entry.name)
}

/* ------------------------------ 包清单改写 ---------------------------- */

function readManifest(profileDir) {
  return JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
}

/** 与 DSH 自己写 profile 清单的方式保持一致：2 空格缩进 + 结尾换行。 */
function writeManifest(profileDir, manifest) {
  writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify(manifest, undefined, 2)}\n`)
}

function bundlesOf(manifest) {
  return manifest.dsh?.profile?.bundles ?? []
}

/** 登记 bundle 名（追加到末尾；已存在则保持原顺序与位置）。 */
function withBundle(manifest, name, on) {
  const bundles = bundlesOf(manifest)
  const next = on
    ? (bundles.includes(name) ? bundles : [...bundles, name])
    : bundles.filter(item => item !== name)
  return {
    ...manifest,
    dsh: { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: next } },
  }
}

/** 增删一条 dependencies 条目，并保持原有键顺序（新键追加在末尾）。 */
function withDependency(manifest, name, spec) {
  const dependencies = { ...(manifest.dependencies ?? {}) }
  if (spec === undefined) delete dependencies[name]
  else dependencies[name] = spec
  const next = {}
  for (const [key, value] of Object.entries(manifest)) {
    if (key === 'dependencies') { if (Object.keys(dependencies).length > 0) next.dependencies = dependencies }
    else next[key] = value
  }
  if (next.dependencies === undefined && Object.keys(dependencies).length > 0) next.dependencies = dependencies
  return next
}

/** 目录里是否已经躺着同一个包（避免装到别的东西上）。 */
function looksLikeOurs(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === PACKAGE_NAME
  } catch { return false }
}

function copyDir(from, to) {
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, {
    recursive: true,
    force: true,
    dereference: false,                       // node_modules/.bin 里的符号链接原样保留
    filter: (src) => !SKIP.has(basename(src)),
  })
}

function sizeOf(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) total += sizeOf(path)
    else if (entry.isFile()) total += statSync(path).size
  }
  return total
}


/* ------------------------------ 自动重启 dsh --------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 端口上是否有人应答（连得上就算）。 */
async function portListening(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const done = (value) => { socket.destroy(); resolve(value) }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(500, () => done(false))
  })
}

/** 占着这个端口的进程号；找不到返回 null。 */
function listenerPid(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
      const line = out.split(/\r?\n/).find(row => new RegExp(`[:.]${port}\\s`).test(row) && /LISTENING/i.test(row))
      const pid = line ? line.trim().split(/\s+/).pop() : undefined
      return pid ? Number(pid) : null
    }
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
    return Number(out.trim().split(/\s+/)[0]) || null
  } catch { return null }
}

/** 进程的完整命令行（重启时原样复用）。 */
function processCommand(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('wmic', ['process', 'where', `processid=${pid}`, 'get', 'commandline'], { encoding: 'utf8' })
      return out.split(/\r?\n/).map(row => row.trim()).filter(row => row && !/^CommandLine$/i.test(row))[0] ?? null
    }
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim() || null
  } catch { return null }
}

/** 进程的工作目录（重启时必须保持一致，否则 dsh 的相对路径会变）。 */
function processCwd(pid) {
  try {
    if (process.platform === 'win32') return process.cwd()
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' })
    const line = out.split('\n').find(row => row.startsWith('n'))
    return line ? line.slice(1) : process.cwd()
  } catch { return process.cwd() }
}

/** detached 助手：等端口释放 → 用同一命令同一 cwd 拉起新进程 → 写日志。 */
function helperSource(command, cwd, port, logs) {
  return `
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const net = require('node:net')
const command = ${JSON.stringify(command)}, cwd = ${JSON.stringify(cwd)}, port = ${JSON.stringify(port)}
const logOut = ${JSON.stringify(logs.out)}, logErr = ${JSON.stringify(logs.err)}
const note = (line) => { try { fs.appendFileSync(logErr, '[install-to-dsh] ' + line + '\\n') } catch {} }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const listening = () => new Promise((resolve) => {
  const probe = net.connect({ host: '127.0.0.1', port })
  const done = (value) => { probe.destroy(); resolve(value) }
  probe.on('connect', () => done(true)); probe.on('error', () => done(false))
  setTimeout(() => done(false), 500)
})
;(async () => {
  const until = Date.now() + 30000
  while (Date.now() < until && await listening()) await sleep(250)
  await sleep(300)
  try {
    const out = fs.openSync(logOut, 'a'); const err = fs.openSync(logErr, 'a')
    const child = spawn(command, { cwd, shell: true, detached: true, stdio: ['ignore', out, err], env: process.env })
    child.on('error', (error) => note('无法启动 dsh：' + (error && error.message)))
    child.unref()
    note('已用同一命令拉起 dsh（' + command + '）')
  } catch (error) { note('无法启动 dsh：' + (error && error.message)) }
})()
`
}

/**
 * 重启正在跑的 dsh web。
 * @returns `{ how: 'dshmarket' | 'process' | 'none' | 'not-running', pid?, logs? }`
 */
async function restartHost(port) {
  if (!(await portListening(port))) return { how: 'not-running' }
  // 1) dshmarket 的自重启（同源 loopback POST；装了它就走这条，最稳）
  try {
    const response = await fetch(`http://127.0.0.1:${port}/dsh-market/api/v1/restart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
      body: '{}',
    })
    if (response.status === 202) return { how: 'dshmarket' }
  } catch { /* 没装 dshmarket 或端点不可用 → 走下面的进程级重启 */ }
  // 2) 进程级重启
  const pid = listenerPid(port)
  if (!pid) return { how: 'none' }
  const command = processCommand(pid)
  if (!command) return { how: 'none' }
  const cwd = processCwd(pid)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const logs = { out: join(tmpdir(), `wangtie-os-restart-${stamp}.out.log`), err: join(tmpdir(), `wangtie-os-restart-${stamp}.err.log`) }
  const helper = spawn(process.execPath, ['-e', helperSource(command, cwd, port, logs)], { detached: true, stdio: 'ignore', env: process.env })
  helper.unref()
  await sleep(500)
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'])
    else process.kill(pid, 'SIGTERM')
  } catch { /* 进程可能刚好自己退了 */ }
  return { how: 'process', pid, logs }
}

/**
 * 等新进程真正「能应答」。
 * 只看端口能连会误判：进程绑好端口到能回 HTTP 之间还有一小段窗口，
 * 所以再发一次真实请求（任何状态码都算就绪）。
 */
async function waitForReady(port, timeoutMs = 30000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await portListening(port)) {
      const response = await fetch(`http://127.0.0.1:${port}/`).catch(() => null)
      if (response) return true
    }
    await sleep(500)
  }
  return false
}

/* -------------------------------- 主流程 ------------------------------ */

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]
  say(header.slice(header.indexOf('/**')).replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, '').trim())
  process.exit(0)
}

const home = dshHome(options)
const profileDir = join(home, 'profiles', options.profile)
const source = resolve(options.source ?? packageRoot)
const target = join(profileDir, 'node_modules', PACKAGE_NAME)
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dry = options.dryRun ? '（dry-run，不改动任何文件）' : ''

say(`王铁 OS → DSH 插件安装${dry}`)
step(`DSH_HOME     ${home}`)
step(`profile      ${options.profile}  →  ${profileDir}`)
step(`安装源        ${source}`)
step(`安装目标      ${target}`)

if (!existsSync(join(profileDir, 'cordis.yml'))) {
  const available = profilesIn(home)
  say(`\n✗ 找不到 profile：${profileDir} 下没有 cordis.yml`)
  say(available.length ? `  可用的 profile：${available.join('、')}（用 --profile 指定）` : `  ${home}/profiles 下没有任何 profile，先跑一次 dsh web 让它初始化`)
  process.exit(1)
}

const sourceManifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
if (sourceManifest.name !== PACKAGE_NAME) {
  say(`\n✗ 安装源不是 ${PACKAGE_NAME}（package.json 里是 ${String(sourceManifest.name)}）`)
  process.exit(1)
}
if (!existsSync(join(source, 'lib', 'index.js'))) {
  say(`\n✗ 安装源里没有 lib/index.js——先在本包目录执行 node build.mjs 再安装`)
  process.exit(1)
}
if (/(?:^|\/)(?:private\/)?var\/folders\//.test(source) || /^\/tmp\//.test(source) || /(?:^|\/)(?:下载|Downloads)\//.test(source)) {
  say(`\n⚠ 安装源像是临时/下载目录：${source}`)
  step(`装完后请别删它——package.json 里的 file: 依赖指向这个路径（挪走会导致以后 pnpm install 失败）`)
}

const appUrl = `http://127.0.0.1:${options.port}/wangtie-os/`

// 只重启，不安装：`node scripts/install-to-dsh.mjs --restart-only`
if (options.restartOnly) {
  say(`\n重启 dsh web（端口 ${options.port}）…`)
  const result = options.dryRun ? { how: 'none' } : await restartHost(options.port)
  if (result.how === 'not-running') say(`  · ${options.port} 端口上没有 dsh 在跑，无需重启`)
  else if (result.how === 'dshmarket') say('  · 已通过 dshmarket 自重启接口重启')
  else if (result.how === 'process') say(`  · 已重启进程 ${result.pid}（日志 ${result.logs.err}）`)
  else say('  · 未能自动重启，请手动 Ctrl-C 后重新 dsh web')
  if (result.how === 'dshmarket' || result.how === 'process') {
    const up = await waitForReady(options.port)
    say(up ? `✓ dsh 已重新监听 ${options.port}` : `⚠ 30 秒内没等到 ${options.port} 重新监听，请查看日志或手动启动`)
  }
  process.exit(0)
}

const manifest = readManifest(profileDir)
const alreadyBundled = bundlesOf(manifest).includes(PACKAGE_NAME)

// 从已安装副本再装一次会把源目录删掉，直接拒绝。
if (resolve(source) === resolve(target)) {
  say(`\n✗ 安装源就是安装目标本身（${target}）——请在解压出来的包里执行本脚本`)
  process.exit(1)
}

if (options.uninstall) {
  say('\n卸载：')
  step(`从 dsh.profile.bundles 移除 ${PACKAGE_NAME}`)
  step(`移除 dependencies.${PACKAGE_NAME}`)
  step(`删除目录 ${target}`)
  if (!options.dryRun) {
    writeFileSync(join(profileDir, `package.json.bak-${stamp}`), readFileSync(join(profileDir, 'package.json')))
    writeManifest(profileDir, withDependency(withBundle(manifest, PACKAGE_NAME, false), PACKAGE_NAME, undefined))
    if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  }
  say('\n✓ 已卸载。重启 dsh web 后生效（原来那份 package.json 已备份为 package.json.bak-' + stamp + '）')
  process.exit(0)
}

/* 1) 放包 */
if (existsSync(target) && !looksLikeOurs(target)) {
  say(`\n✗ ${target} 已存在且不是 ${PACKAGE_NAME}，为避免覆盖别的东西已停止`)
  process.exit(1)
}
say(`\n1) 安装包体（约 ${(sizeOf(source) / 1048576).toFixed(1)} MB，含随包分发的 node_modules）`)
if (!options.dryRun) {
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  copyDir(source, target)
}
step(`→ ${target}`)

/* 2) 登记 bundle */
say(`2) 登记 profile 的 bundle 层`)
const nextBundles = withBundle(manifest, PACKAGE_NAME, true)
if (alreadyBundled) step(`dsh.profile.bundles 里已有 ${PACKAGE_NAME}（保持原顺序，不重复添加）`)
else step(`dsh.profile.bundles += ${PACKAGE_NAME}`)
step(`（包自带 cordis.patch.yml 会被自动应用，插件行即由此插入）`)

/* 3) 写依赖条目 */
say(`3) 记录 file: 依赖（与 pnpm dsh plugin add 的结果一致）`)
const spec = `file:${source}`
const nextManifest = withDependency(nextBundles, PACKAGE_NAME, spec)
step(`dependencies["${PACKAGE_NAME}"] = "${spec}"`)

if (!options.dryRun) {
  if (JSON.stringify(manifest) !== JSON.stringify(nextManifest)) {
    writeFileSync(join(profileDir, `package.json.bak-${stamp}`), readFileSync(join(profileDir, 'package.json')))
    writeManifest(profileDir, nextManifest)
    step(`原 package.json 已备份为 package.json.bak-${stamp}`)
  } else {
    step('profile 清单无需改动')
  }
}

say('\n✓ 安装完成')

if (options.restart && !options.dryRun) {
  say(`\n重启 dsh web（端口 ${options.port}；宿主半边只在进程启动时 import 一次）…`)
  const result = await restartHost(options.port)
  if (result.how === 'not-running') {
    say(`  · ${options.port} 端口上没有 dsh 在跑：直接执行 dsh web 启动即可`)
  } else if (result.how === 'dshmarket') {
    say('  · 已通过 dshmarket 自重启接口重启')
  } else if (result.how === 'process') {
    say(`  · 已重启进程 ${result.pid}（日志 ${result.logs.err}）`)
  } else {
    say('  · 没能自动重启，请手动：Ctrl-C 停掉 dsh web，再执行 dsh web')
  }
  if (result.how === 'dshmarket' || result.how === 'process') {
    const up = await waitForReady(options.port)
    say(up ? `✓ dsh 已重新监听 ${options.port}` : `⚠ 30 秒内没等到 ${options.port} 重新监听：看日志 ${result.logs ? result.logs.err : ''} 或手动执行 dsh web`)
  }
} else if (options.restart) {
  step('（dry-run：不会真的重启）')
} else {
  say('\n请自行重启 dsh web：Ctrl-C 停掉后重新执行 dsh web')
}

say('\n打开（浏览器刷新即可）：')
say(`  ${appUrl}                         ← 王铁 OS（DSH 自己的端口，不是 3081）`)
say(`  ${appUrl}api/health               ← routes 应含 22 条，debug.mountState 应为空`)
say(`  侧边栏应出现「OceanBase 管理 / DDL 比较」；DDL 比较的库地址读 ${join(home, 'wangtie-os', 'ddl-environments.json')}`)
