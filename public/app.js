// ─── State ────────────────────────────────────────────────────────────────────
let currentStatus = {}
let appsMeta = {}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme()
  await loadAll()
})

async function loadAll () {
  try {
    const [metaRes, statusRes] = await Promise.all([
      fetch('api/apps'),
      fetch('status.json', { cache: 'no-store' })
    ])
    appsMeta = await metaRes.json()
    currentStatus = await statusRes.json()
    renderGrid()
  } catch (err) {
    document.getElementById(
      'app-grid'
    ).innerHTML = `<div class="col-12 text-danger text-center py-5"><i class="bi bi-exclamation-triangle me-2"></i>Could not load status — ${err.message}</div>`
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderGrid () {
  const grid = document.getElementById('app-grid')
  grid.innerHTML = ''

  // App cards
  Object.entries(appsMeta).forEach(([key, meta]) => {
    const s = currentStatus[key] || {
      enabled: false,
      message: '',
      updated_at: null
    }
    const isDown = s.enabled
    const col = document.createElement('div')
    col.className = 'col-12 col-md-6 col-xl-3'
    col.innerHTML = appCard(key, meta, s, isDown)
    grid.appendChild(col)
  })

  // VanManager tile
  const vmCol = document.createElement('div')
  vmCol.className = 'col-12 col-md-6 col-xl-3'
  vmCol.innerHTML = vanManagerCard()
  grid.appendChild(vmCol)
}

function appCard (key, meta, s, isDown) {
  const badgeClass = isDown ? 'bg-danger' : 'bg-success'
  const badgeText = isDown ? 'MAINTENANCE' : 'LIVE'
  const btnClass = isDown ? 'btn-danger' : 'btn-success'
  const btnIcon = isDown ? 'bi-cone-striped' : 'bi-check-circle-fill'
  const btnText = isDown
    ? 'In Maintenance — Click to Restore'
    : 'Live — Click to Pause'
  const updated = s.updated_at
    ? `Updated ${new Date(s.updated_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`
    : 'Never toggled'

  return `
    <div class="card app-card border shadow-sm h-100 ${
      isDown ? 'is-down' : 'is-live'
    }" id="card-${key}">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <i class="bi ${meta.icon} app-icon"></i>
            <a href="${
              meta.path
            }" target="_blank" rel="noopener" class="fw-semibold text-decoration-none link-body-emphasis">${
    meta.label
  }</a>
          </div>
          <span class="badge status-badge ${badgeClass}" id="badge-${key}">${badgeText}</span>
        </div>

        <button
          class="btn toggle-btn ${btnClass} w-100"
          id="toggle-${key}"
          onclick="toggle('${key}')">
          <i class="bi ${btnIcon} me-2"></i>${btnText}
        </button>

        <div class="d-flex flex-column gap-1">
          <label class="form-label small mb-0 fw-semibold opacity-75">Maintenance Message</label>
          <textarea
            class="form-control msg-input"
            id="msg-${key}"
            rows="2">${s.message || ''}</textarea>
          <button
            class="btn btn-sm btn-outline-secondary align-self-end"
            onclick="saveMessage('${key}')">
            <i class="bi bi-floppy me-1"></i>Save Message
          </button>
        </div>

        <div class="updated-label mt-auto">${updated}</div>
      </div>
    </div>`
}

function vanManagerCard () {
  return `
    <div class="card app-card vanmanager-card border shadow-sm h-100">
      <div class="card-body">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-sliders app-icon text-primary"></i>
          <span class="fw-semibold">VanManager</span>
        </div>
        <p class="text-secondary small">Vantage workflow controls — enable or disable workflows for maintenance windows.</p>
        <a
          href="/vanmanage/"
          target="_blank"
          rel="noopener"
          class="btn btn-primary w-100 mt-auto">
          <i class="bi bi-box-arrow-up-right me-2"></i>Open VanManager
        </a>
      </div>
    </div>`
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function toggle (key) {
  const btn = document.getElementById(`toggle-${key}`)
  btn.disabled = true
  try {
    const res = await fetch('api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: key })
    })
    currentStatus = await res.json()
    renderGrid()
  } catch (err) {
    alert(`Toggle failed: ${err.message}`)
    btn.disabled = false
  }
}

async function saveMessage (key) {
  const message = document.getElementById(`msg-${key}`).value
  try {
    const res = await fetch('api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: key, message })
    })
    currentStatus = await res.json()
    // Just update the updated label without full re-render
    const s = currentStatus[key]
    const card = document.getElementById(`card-${key}`)
    const label = card?.querySelector('.updated-label')
    if (label && s.updated_at) {
      label.textContent = `Updated ${new Date(s.updated_at).toLocaleString(
        'en-US',
        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      )}`
    }
  } catch (err) {
    alert(`Save failed: ${err.message}`)
  }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme () {
  const stored = localStorage.getItem('crusher-theme') || 'dark'
  setTheme(stored)
  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(
      document.documentElement.getAttribute('data-bs-theme') === 'dark'
        ? 'light'
        : 'dark'
    )
  })
}

function setTheme (theme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
  localStorage.setItem('crusher-theme', theme)
  document.getElementById('theme-icon').className =
    theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill'
}
