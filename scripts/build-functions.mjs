// 把 server/api/*.ts 连同依赖打包成自包含的 dist/cloud-functions/api/*.js
// （EdgeOne Makers Cloud Functions，Node 运行时，按文件路径路由，部署时无需再装依赖）。
// 手动构建部署时，EdgeOne 要求函数目录和 package.json 放在产物目录里。
import { readdirSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const entries = readdirSync('server/api')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => `server/api/${f}`)

await build({
  entryPoints: entries,
  outdir: 'dist/cloud-functions/api',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
})

writeFileSync('dist/package.json', JSON.stringify({ name: 'memo', private: true, type: 'module' }, null, 2) + '\n')
console.log(`cloud functions: ${entries.length} 个 → dist/cloud-functions/api`)
