import { build } from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const dir = new URL('../.test-build/', import.meta.url)
await mkdir(dir, { recursive: true })
try {
  const integration = process.argv.includes('--integration')
  const name = integration ? 'oceanbase.integration.test' : 'oceanbase.test'
  await build({ entryPoints: [`tests/${name}.ts`], outfile: `.test-build/${name}.mjs`, bundle: true, platform: 'node', format: 'esm', external: ['mysql2/promise', 'oracledb'] })
  const extra = integration ? [] : ['tests/oceanbase-ui.test.mjs', 'tests/ofd.test.mjs', 'tests/tns-decode.test.mjs']
  const result = spawnSync(process.execPath, ['--test', `.test-build/${name}.mjs`, ...extra], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
