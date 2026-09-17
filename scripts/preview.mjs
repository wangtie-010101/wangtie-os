// Local preview adapter for the DSH webServer contract. Database calls remain real.
import { createServer } from 'node:http'
import { apply } from '../lib/index.js'

const routes = []
const cleanup = []
const context = {
  inject: (_services, callback) => callback(context),
  effect: callback => { cleanup.push(callback()) },
  logger: { info: console.log },
  webServer: { register: route => { routes.push(route); return () => { const i = routes.indexOf(route); if (i >= 0) routes.splice(i, 1) } } },
}
apply(context)
const port = Number(process.env.PORT || 3081)
const server = createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname
  if (path === '/') { res.writeHead(302, { location: '/wangtie-os/' }); res.end(); return }
  const route = routes.find(route => route.kind === 'exact' && route.path === path)
    || routes.find(route => route.kind === 'prefix' && (path === route.path || path.startsWith(route.path + '/')))
  if (!route) { res.writeHead(404); res.end('Not found'); return }
  try { await route.handler(req, res) } catch { if (!res.headersSent) res.writeHead(500); res.end('Internal server error') }
})
server.listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}/wangtie-os/`))
function stop() { cleanup.forEach(dispose => dispose?.()); server.close(); }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
