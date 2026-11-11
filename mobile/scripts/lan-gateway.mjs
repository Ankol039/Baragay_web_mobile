import http from 'node:http'
import { readFileSync, createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { privateIPv4, allowRequest } from './gateway-policy.mjs'
const project = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url))).projects.default
const real = process.argv.includes('--real')
const bind = process.env.MOBILE_LAN_HOST || '127.0.0.1', lan = bind !== '127.0.0.1'
if (lan && (!privateIPv4(bind) || (!real && process.env.MOBILE_TRUSTED_LAN_DEMO !== 'I_UNDERSTAND_EMULATOR_TOKENS_ARE_INSECURE'))) throw new Error('Use an explicit private IPv4 interface and acknowledge the trusted-LAN emulator demo when using emulators.')
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const origins = new Set([`http://${bind}:${real ? 8793 : 8790}`, 'http://localhost:8081', 'http://127.0.0.1:8081'])
// The real-project gateway forwards only resident APIs. Auth/Firestore use TLS
// directly; never serve an old emulator bundle from this separate endpoint.
const targets = real ? [['api', 8793, 8788]] : [['api', 8790, 8787], ['auth', 8791, 9099], ['firestore', 8792, 8080]]
for (const [kind, port, upstream] of targets) {
  http.createServer(async (req, res) => {
    const origin = req.headers.origin
    if (origin && !origins.has(origin)) { res.writeHead(403); res.end(); return }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin') }
    res.setHeader('Access-Control-Expose-Headers', 'X-HTTP-Session-Id, X-Client-Wire-Protocol')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Firebase-GMPID,X-Firebase-Client,X-Firebase-AppCheck,X-Client-Version,X-Goog-Api-Client,X-Firebase-Locale,X-Goog-AuthUser,X-Goog-Api-Key')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    if (kind === 'api' && req.method === 'GET' && !req.url.startsWith('/api/')) {
      if (real) { res.writeHead(404); res.end(); return }
      try {
        const path = new URL(req.url, 'http://localhost').pathname
        const file = resolve(webRoot, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`)
        if (!file.startsWith(webRoot + '/') || path.split('/').some(p => p.startsWith('.'))) throw new Error('Invalid path')
        const info = await stat(file); if (!info.isFile()) throw new Error('Not a file')
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.ttf': 'font/ttf' })[extname(file)] || 'application/octet-stream')
        createReadStream(file).pipe(res)
      } catch { res.writeHead(404); res.end() }
      return
    }
    const chunks = []; let bytes = 0
    try {
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw new Error('Too large'); chunks.push(chunk) }
      const body = Buffer.concat(chunks)
      if (!allowRequest(kind, req.method, req.url, req.headers, body.toString(), project)) { res.writeHead(403); res.end('Client routes only.'); return }
      const headers = { ...req.headers, host: `127.0.0.1:${upstream}` }; delete headers.origin; delete headers.cookie; delete headers.referer
      const proxy = http.request({ host: '127.0.0.1', port: upstream, method: req.method, path: req.url, headers }, response => {
        res.statusCode = response.statusCode
        for (const [key, value] of Object.entries(response.headers)) if (!key.startsWith('access-control-') && !['connection', 'transfer-encoding', 'set-cookie'].includes(key)) res.setHeader(key, value)
        response.pipe(res)
      })
      proxy.setTimeout(45000, () => proxy.destroy())
      proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local emulator/API unavailable.') })
      proxy.end(body)
    } catch { res.writeHead(413); res.end() }
  }).listen(port, bind, () => console.log(`${kind}: http://${bind}:${port}`))
}
