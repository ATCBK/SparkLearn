import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const popupSource = fs.readFileSync(new URL('../popup.js', import.meta.url), 'utf8')

function createElement(value = '') {
  const handlers = new Map()
  return {
    value,
    textContent: '',
    className: '',
    disabled: false,
    hidden: false,
    addEventListener(type, handler) {
      handlers.set(type, handler)
    },
    async trigger(type) {
      const handler = handlers.get(type)
      assert.ok(handler, `缺少 ${type} 事件处理器`)
      await handler()
    },
  }
}

function createHarness({ token = '', user = null } = {}) {
  const elements = {
    apiBase: createElement('http://127.0.0.1:8000'),
    captureBtn: createElement(),
    status: createElement(),
    result: createElement(),
    resultTitle: createElement(),
    resultMeta: createElement(),
    loginPanel: createElement(),
    accountPanel: createElement(),
    accountName: createElement(),
    phone: createElement('16600000001'),
    password: createElement('Passw0rd!'),
    loginBtn: createElement(),
    logoutBtn: createElement(),
  }
  const syncState = { apiBase: elements.apiBase.value }
  const localState = {
    accessToken: token,
    currentUser: user,
    authApiBase: token ? syncState.apiBase : '',
  }
  const fetchCalls = []

  const chrome = {
    tabs: {
      query: async () => [{ id: 7, title: '测试网页', url: 'https://example.com/article' }],
      sendMessage: async () => ({
        title: '测试网页',
        url: 'https://example.com/article',
        description: '测试摘要',
        text: '这是一段长度足够用于测试网页资料抓取认证行为的正文内容。',
      }),
    },
    scripting: { executeScript: async () => [] },
    storage: {
      sync: {
        get(defaults, callback) {
          callback({ ...defaults, ...syncState })
        },
        async set(values) {
          Object.assign(syncState, values)
        },
      },
      local: {
        get(defaults, callback) {
          callback({ ...defaults, ...localState })
        },
        async set(values) {
          Object.assign(localState, values)
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete localState[key]
        },
      },
    },
  }

  const fetch = async (url, init = {}) => {
    fetchCalls.push({ url, init })
    if (String(url).endsWith('/api/auth/password/login')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'token-from-login', user: { user_id: 'user-a', name: '用户 A' } },
        }),
      }
    }
    if (String(url).endsWith('/api/auth/me')) {
      return {
        ok: Boolean(localState.accessToken),
        status: localState.accessToken ? 200 : 401,
        json: async () => ({ success: Boolean(localState.accessToken), data: localState.currentUser }),
      }
    }
    if (String(url).endsWith('/api/tutor/files/web-capture')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 42, filename: '测试网页', size_bytes: 1024 },
        }),
      }
    }
    throw new Error(`未处理的请求：${url}`)
  }

  const context = vm.createContext({
    chrome,
    document: { getElementById: (id) => elements[id] },
    fetch,
    console,
    Error,
    Number,
    Promise,
    String,
    setTimeout,
    clearTimeout,
  })
  vm.runInContext(popupSource, context, { filename: 'popup.js' })

  return { elements, fetchCalls, localState }
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('已登录扩展抓取网页时携带 Bearer Token', async () => {
  const harness = createHarness({
    token: 'token-a',
    user: { user_id: 'user-a', name: '用户 A' },
  })
  await flushPromises()

  await harness.elements.captureBtn.trigger('click')
  await flushPromises()

  const captureCall = harness.fetchCalls.find(({ url }) => String(url).endsWith('/api/tutor/files/web-capture'))
  assert.ok(captureCall)
  assert.equal(captureCall.init.headers.Authorization, 'Bearer token-a')
})

test('扩展登录后保存账号 Token 并展示当前用户', async () => {
  const harness = createHarness()
  await flushPromises()

  await harness.elements.loginBtn.trigger('click')

  assert.equal(harness.localState.accessToken, 'token-from-login')
  assert.equal(harness.localState.authApiBase, 'http://127.0.0.1:8000')
  assert.deepEqual(harness.localState.currentUser, { user_id: 'user-a', name: '用户 A' })
  assert.equal(harness.elements.accountName.textContent, '用户 A')
})

test('后端地址变化后不会把已有 Token 发送给其他地址', async () => {
  const harness = createHarness({
    token: 'token-a',
    user: { user_id: 'user-a', name: '用户 A' },
  })
  await flushPromises()
  harness.elements.apiBase.value = 'https://other.example'

  await harness.elements.captureBtn.trigger('click')
  await flushPromises()

  const leakedCall = harness.fetchCalls.find(({ url }) => String(url).startsWith('https://other.example/'))
  assert.equal(leakedCall, undefined)
  assert.match(harness.elements.status.textContent, /重新登录/)
})
