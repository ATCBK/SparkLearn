function collectVisibleText(root) {
  const blocked = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'IFRAME'])
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || blocked.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      const text = node.textContent.replace(/\s+/g, ' ').trim()
      if (!text || text.length < 2) return NodeFilter.FILTER_REJECT
      const style = window.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const parts = []
  while (walker.nextNode()) {
    parts.push(walker.currentNode.textContent.replace(/\s+/g, ' ').trim())
  }
  return parts.join('\n')
}

function pickMainRoot() {
  return (
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.body
  )
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SPARKLEARN_CAPTURE_PAGE') return false
  const selection = window.getSelection()?.toString().trim() || ''
  const root = pickMainRoot()
  const text = selection || collectVisibleText(root)
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  sendResponse({
    title: document.title || location.hostname,
    url: location.href,
    description,
    text,
    selectionUsed: Boolean(selection),
  })
  return true
})
