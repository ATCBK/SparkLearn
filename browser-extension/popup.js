const DEFAULT_API_BASE = 'http://127.0.0.1:8000'

const apiBaseInput = document.getElementById('apiBase')
const captureBtn = document.getElementById('captureBtn')
const statusEl = document.getElementById('status')
const resultEl = document.getElementById('result')
const resultTitleEl = document.getElementById('resultTitle')
const resultMetaEl = document.getElementById('resultMeta')

function setStatus(text, type = '') {
  statusEl.textContent = text
  statusEl.className = `status ${type}`.trim()
}

function cleanApiBase(value) {
  return (value || DEFAULT_API_BASE).trim().replace(/\/$/, '')
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

async function saveToSparkLearn(payload, apiBase) {
  const res = await fetch(`${apiBase}/api/tutor/files/web-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(json.error || json.message || `保存失败：${res.status}`)
  }
  return json.data || json
}

async function handleCapture() {
  captureBtn.disabled = true
  resultEl.hidden = true
  setStatus('正在读取当前网页...')

  try {
    const apiBase = cleanApiBase(apiBaseInput.value)
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
    }, apiBase)

    resultTitleEl.textContent = saved.filename || captured.title || '网页资料'
    resultMetaEl.textContent = `已保存到我的资料 · ${(Number(saved.size_bytes || 0) / 1024).toFixed(1)} KB`
    resultEl.hidden = false
    setStatus('保存成功，回到 SparkLearn 的“我的资料”即可查看解析卡片。', 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败', 'error')
  } finally {
    captureBtn.disabled = false
  }
}

chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE }, (items) => {
  apiBaseInput.value = items.apiBase || DEFAULT_API_BASE
})

captureBtn.addEventListener('click', () => {
  void handleCapture()
})
