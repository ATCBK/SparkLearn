const DEFAULT_API_BASE = 'http://127.0.0.1:8000'
const AUTH_STORAGE_DEFAULTS = { accessToken: '', currentUser: null, authApiBase: '' }

const apiBaseInput = document.getElementById('apiBase')
const captureBtn = document.getElementById('captureBtn')
const statusEl = document.getElementById('status')
const resultEl = document.getElementById('result')
const resultTitleEl = document.getElementById('resultTitle')
const resultMetaEl = document.getElementById('resultMeta')
const loginPanelEl = document.getElementById('loginPanel')
const accountPanelEl = document.getElementById('accountPanel')
const accountNameEl = document.getElementById('accountName')
const phoneInput = document.getElementById('phone')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('loginBtn')
const logoutBtn = document.getElementById('logoutBtn')

let accessToken = ''
let currentUser = null
let authApiBase = ''

function setStatus(text, type = '') {
  statusEl.textContent = text
  statusEl.className = `status ${type}`.trim()
}

function cleanApiBase(value) {
  return (value || DEFAULT_API_BASE).trim().replace(/\/$/, '')
}

function storageGet(area, defaults) {
  return new Promise((resolve) => area.get(defaults, resolve))
}

function apiErrorMessage(json, fallback) {
  if (typeof json?.error === 'string' && json.error) return json.error
  if (typeof json?.message === 'string' && json.message) return json.message
  if (typeof json?.detail === 'string' && json.detail) return json.detail
  return fallback
}

function renderAuthState() {
  const loggedIn = Boolean(accessToken && currentUser)
  loginPanelEl.hidden = loggedIn
  accountPanelEl.hidden = !loggedIn
  accountNameEl.textContent = loggedIn ? String(currentUser.name || currentUser.phone || '已登录用户') : ''
  captureBtn.disabled = !loggedIn
}

async function clearAuthState() {
  accessToken = ''
  currentUser = null
  authApiBase = ''
  await chrome.storage.local.remove(['accessToken', 'currentUser', 'authApiBase'])
  renderAuthState()
}

async function saveAuthState(token, user, apiBase) {
  accessToken = token
  currentUser = user
  authApiBase = apiBase
  await chrome.storage.local.set({ accessToken: token, currentUser: user, authApiBase: apiBase })
  renderAuthState()
}

async function restoreAuthState() {
  const saved = await storageGet(chrome.storage.local, AUTH_STORAGE_DEFAULTS)
  const savedToken = String(saved.accessToken || '')
  const savedApiBase = cleanApiBase(saved.authApiBase || '')
  if (!savedToken || !savedApiBase) {
    renderAuthState()
    return
  }

  try {
    const res = await fetch(`${savedApiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.success === false || !json.data) {
      throw new Error(apiErrorMessage(json, '登录已过期'))
    }
    await saveAuthState(savedToken, json.data, savedApiBase)
    setStatus('账号已连接，可以抓取当前网页。')
  } catch {
    await clearAuthState()
    setStatus('登录已过期，请重新登录 SparkLearn。', 'error')
  }
}

async function handleLogin() {
  const apiBase = cleanApiBase(apiBaseInput.value)
  const phone = String(phoneInput.value || '').trim()
  const password = String(passwordInput.value || '')
  if (!phone || !password) {
    setStatus('请输入 SparkLearn 登录手机号和密码。', 'error')
    return
  }

  loginBtn.disabled = true
  setStatus('正在登录 SparkLearn...')
  try {
    await chrome.storage.sync.set({ apiBase })
    const res = await fetch(`${apiBase}/api/auth/password/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    })
    const json = await res.json().catch(() => ({}))
    const data = json.data || {}
    if (!res.ok || json.success === false || !data.token || !data.user) {
      throw new Error(apiErrorMessage(json, `登录失败：${res.status}`))
    }
    await saveAuthState(String(data.token), data.user, apiBase)
    passwordInput.value = ''
    setStatus('登录成功，现在抓取的资料会进入你的资源中心。', 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '登录失败', 'error')
  } finally {
    loginBtn.disabled = false
  }
}

async function handleLogout() {
  await clearAuthState()
  setStatus('已退出扩展账号，请重新登录后再抓取。')
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('没有找到当前网页标签')
  return tab
}

async function capturePage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'SPARKLEARN_CAPTURE_PAGE' })
  } catch {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title || location.hostname,
        url: location.href,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        text: (window.getSelection()?.toString().trim() || document.body?.innerText || '').trim(),
        selectionUsed: Boolean(window.getSelection()?.toString().trim()),
      }),
    })
    return result
  }
}

async function saveToSparkLearn(payload, apiBase, token) {
  const res = await fetch(`${apiBase}/api/tutor/files/web-capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    await clearAuthState()
    throw new Error('登录已过期，请重新登录后再抓取。')
  }
  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(apiErrorMessage(json, `保存失败：${res.status}`))
  }
  return json.data || json
}

async function handleCapture() {
  resultEl.hidden = true
  const apiBase = cleanApiBase(apiBaseInput.value)
  if (!accessToken || !currentUser) {
    setStatus('请先登录 SparkLearn，再抓取网页。', 'error')
    return
  }
  if (apiBase !== authApiBase) {
    setStatus('后端地址已经变化，请在当前地址重新登录后再抓取。', 'error')
    return
  }

  captureBtn.disabled = true
  setStatus('正在读取当前网页...')

  try {
    await chrome.storage.sync.set({ apiBase })
    const tab = await getCurrentTab()
    const captured = await capturePage(tab.id)
    const text = String(captured?.text || '').trim()
    if (text.length < 20) {
      throw new Error('当前网页可抓取正文太少，可以先选中文章正文后再点击保存。')
    }

    setStatus('正在保存并进行 AI 解析...')
    const saved = await saveToSparkLearn({
      title: captured.title || tab.title || '网页资料',
      url: captured.url || tab.url || '',
      text,
      excerpt: captured.description || '',
    }, apiBase, accessToken)

    resultTitleEl.textContent = saved.filename || captured.title || '网页资料'
    resultMetaEl.textContent = `已保存到资源中心 · ${(Number(saved.size_bytes || 0) / 1024).toFixed(1)} KB`
    resultEl.hidden = false
    setStatus('保存成功，回到 SparkLearn“资源中心”即可查看。', 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    captureBtn.disabled = !accessToken
  }
}

async function initializePopup() {
  const items = await storageGet(chrome.storage.sync, { apiBase: DEFAULT_API_BASE })
  apiBaseInput.value = items.apiBase || DEFAULT_API_BASE
  renderAuthState()
  await restoreAuthState()
}

loginBtn.addEventListener('click', handleLogin)
logoutBtn.addEventListener('click', handleLogout)
captureBtn.addEventListener('click', handleCapture)

void initializePopup()
