/**
 * 王铁 OS — 构建脚本（esbuild）。
 *  - 服务端：src/index.ts → lib/index.js（ESM bundle，oracledb 为运行时依赖）
 *  - 客户端：src/client/index.ts → client/client.js（DSH 客户端插件「工厂式 CJS」契约）
 */

import { build } from 'esbuild'
import { existsSync } from 'node:fs'

const shared = {
  bundle: true,
  target: 'node18',
  sourcemap: false,
  logLevel: 'info',
}

// 1) 服务端 bundle
await build({
  ...shared,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  platform: 'node',
  format: 'esm',
  external: ['mysql2/promise', 'oracledb'],
})

// 2) 客户端 bundle（DSH 客户端插件工厂式 CJS 契约：
//    window.__ModuleLoader__.load({ id: <包名>, factory: (require) => { ... } }))
if (existsSync('src/client/index.ts')) {
  // 宿主已提供的 8 个平台词（seed），必须作为外部依赖；其余全部内联。
  const EXTERNALS = new Set([
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ])
  await build({
    ...shared,
    entryPoints: ['src/client/index.ts'],
    outfile: 'client/client.js',
    platform: 'browser',
    format: 'cjs',
    target: ['es2020'],
    define: { 'process.env.NODE_ENV': '"development"' },
    external: [...EXTERNALS],
    banner: {
      js: 'window.__ModuleLoader__.load({ id: "wangtie-os", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
    },
    footer: {
      js: 'return module.exports; } });',
    },
  })
}

console.log('wangtie-os: build done')
