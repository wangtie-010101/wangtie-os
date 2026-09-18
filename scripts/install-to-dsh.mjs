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
 * 用法（在本包根目录执行）：
 *   node scripts/install-to-dsh.mjs                 # 装进默认 profile「web」
 *   node scripts/install-to-dsh.mjs --profile web    # 指定 profile
 *   node scripts/install-to-dsh.mjs --dsh-home /path/to/.dsh
 *   node scripts/install-to-dsh.mjs --dry-run        # 只打印将要做什么
 *   node scripts/install-to-dsh.mjs --uninstall      # 卸载（移除登记与目录，保留备份）
 *
 * 装完需要重启 `dsh web`（宿主半边只在进程启动时 import 一次），随后访问：
 *   http://127.0.0.1:3080/wangtie-os/          ← 王铁 OS（DSH 自己的端口，不是 3081）
 *   http://127.0.0.1:3080/wangtie-os/api/health
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = 'wangtie-os'
/** 复制时跳过的目录/文件（版本库、构建缓存与 macOS 垃圾；node_modules 必须一起装，运行期要里面的 mysql2）。 */
const SKIP = new Set(['.git', '.DS_Store', '.test-build', '.local-db'])

/* ------------------------------ 参数解析 ------------------------------ */

function parseArgs(argv) {
  const options = { profile: 'web', dshHome: undefined, dryRun: false, uninstall: false, source: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined]
    const value = () => inline ?? argv[++i]
    if (flag === '--profile') options.profile = value()
    else if (flag === '--dsh-home') options.dshHome = value()
    else if (flag === '--source') options.source = value()
    else if (flag === '--dry-run' || flag === '-n') options.dryRun = true
    else if (flag === '--uninstall') options.uninstall = true
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

say('\n✓ 安装完成。接下来：')
say('  1) 重启 dsh web（宿主半边只在进程启动时 import 一次）')
say('  2) 打开 http://127.0.0.1:3080/wangtie-os/            ← 王铁 OS（走 DSH 自己的 3080，不再需要 3081 预览）')
say('  3) 核对 http://127.0.0.1:3080/wangtie-os/api/health   （routes 应含 22 条，debug.mountState 应为空）')
say(`  4) 侧边栏出现「OceanBase 管理 / DDL 比较」；DDL 比较的库地址读 ${join(home, 'wangtie-os', 'ddl-environments.json')}`)
