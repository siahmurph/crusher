const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3000
const STATUS_FILE = process.env.STATUS_FILE || '/data/status.json'
const PORTAINER =
  process.env.PORTAINER_URL || 'http://host.docker.internal:9000'

const APPS = {
  fido: { label: 'FiDO 2.0', path: '/fido/', icon: 'bi-camera-reels-fill' },
  sandpiper: {
    label: 'Sandpiper',
    path: '/sandpiper/',
    icon: 'bi-music-note-beamed'
  },
  parouter: {
    label: 'PA Router',
    path: '/parouter/',
    icon: 'bi-diagram-3-fill'
  },
  purgomatic: {
    label: 'Purgomatic',
    path: '/purgeomatic/',
    icon: 'bi-trash3-fill'
  }
}

// Maps app/service key → Docker container_name
const CONTAINER_MAP = {
  fido: 'fido2',
  sandpiper: 'sandpiper',
  parouter: 'parouter',
  purgomatic: 'purgomatic',
  vanmanager: 'vanmanager',
  crusher: 'crusher'
}

const DEFAULT_STATUS = Object.fromEntries(
  Object.keys(APPS).map(k => [
    k,
    {
      enabled: false,
      message: `${APPS[k].label} is temporarily unavailable.`,
      updated_at: null
    }
  ])
)

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readStatus () {
  try {
    const raw = fs.readFileSync(STATUS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    // Merge so new keys added to APPS always exist
    return { ...DEFAULT_STATUS, ...parsed }
  } catch {
    return { ...DEFAULT_STATUS }
  }
}

function writeStatus (data) {
  const dir = path.dirname(STATUS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2))
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Apps metadata (so Crusher UI can be dynamic)
app.get('/api/apps', (_req, res) => res.json(APPS))

// Status consumed by all client apps
app.get('/status.json', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache')
  res.json(readStatus())
})

// Toggle maintenance on/off for one app
app.post('/api/toggle', (req, res) => {
  const { app: key } = req.body
  if (!key || !DEFAULT_STATUS[key])
    return res.status(404).json({ error: 'Unknown app' })
  const status = readStatus()
  status[key].enabled = !status[key].enabled
  status[key].updated_at = new Date().toISOString()
  writeStatus(status)
  res.json(status)
})

// Save maintenance message for one app
app.post('/api/message', (req, res) => {
  const { app: key, message } = req.body
  if (!key || !DEFAULT_STATUS[key])
    return res.status(404).json({ error: 'Unknown app' })
  const status = readStatus()
  status[key].message = (message ?? '').trim()
  status[key].updated_at = new Date().toISOString()
  writeStatus(status)
  res.json(status)
})

// Container statuses per compose stack from Portainer
app.get('/api/stacks', async (_req, res) => {
  const apiKey = process.env.PORTAINER_API_KEY
  const endpointId = process.env.PORTAINER_ENDPOINT || '1'
  if (!apiKey) return res.status(503).json({ error: 'PORTAINER_API_KEY not configured' })
  try {
    const r = await fetch(
      `${PORTAINER}/api/endpoints/${endpointId}/docker/containers/json?all=true`,
      { headers: { 'X-API-Key': apiKey }, signal: AbortSignal.timeout(5000) }
    )
    if (!r.ok) return res.status(502).json({ error: `Portainer returned ${r.status}` })
    const containers = await r.json()
    const stacks = {}
    for (const c of containers) {
      const project = c.Labels?.['com.docker.compose.project']
      const service = c.Labels?.['com.docker.compose.service']
      if (!project) continue
      if (!stacks[project]) stacks[project] = []
      stacks[project].push({ service: service || 'unknown', state: c.State })
    }
    res.set('Cache-Control', 'no-store')
    res.json(stacks)
  } catch (err) {
    res.status(502).json({ error: 'Portainer unreachable', detail: err.message })
  }
})

app.listen(PORT, () => console.log(`Crusher listening on :${PORT}`))
