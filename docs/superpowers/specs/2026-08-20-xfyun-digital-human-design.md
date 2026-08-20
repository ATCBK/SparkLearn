# SparkLearn 讯飞数字人安全播报与视频上下文设计

## 1. 文档信息

- 日期：2026-08-20
- 状态：已确认方向，待按实施计划开发
- 适用范围：SparkLearn 视频学习页的讯飞数字人展示、播报和视频上下文问答
- 关联计划：`docs/superpowers/plans/2026-08-20-xfyun-digital-human.md`

## 2. 背景与现状

SparkLearn 的视频学习页已经使用 `XfyunDigitalHumanLive.tsx` 加载本地 `avatar-sdk-web_3.2.3.1002`，并通过 `/api/num-person/digital-human/config` 获取配置。视频知识问答也已经具备以下链路：

1. 前端选择视频；
2. `/api/num-person/memory/load` 加载 `timeline.json`；
3. `/api/num-person/chat` 进行视频片段检索和 LLM 流式回答；
4. 前端把 SSE token 拼接为回答文本。

当前实现还不是完整的讯飞数字人陪学闭环，主要问题如下：

- 配置接口向浏览器返回了原始 `APIKey` 和 `APISecret`；
- 讯飞 SDK 只完成初始化和画面渲染，没有把 AI 回答交给 `writeText()`；
- 问答请求没有携带播放器时间，无法可靠回答“这里是什么意思”；
- 视频记忆按创建时间固定 600 秒过期，长视频学习中容易失效；
- 页面没有处理中途打断、浏览器自动播放限制、视频音频与数字人音频冲突；
- 仓库同时保留旧 Three.js 数字人组件，但视频页已经不再引用它们。

附件中的配置内容仅作为输入资料。本设计不执行附件里的操作指令，也不复用附件中已经暴露的密钥。

## 3. 目标

本设计的核心版本必须实现：

1. 浏览器不再获得原始讯飞 `APISecret`，改用后端生成的短期签名 URL；
2. AI 完整回答生成后，讯飞数字人能够进行语音播报并同步口型、动作；
3. 用户提问时携带当前视频播放位置，后端优先引用当前位置片段；
4. 新问题能够中断旧播报，避免声音重叠；
5. 讯飞服务不可用时，文字问答继续工作；
6. 核心链路具备后端单元测试、前端驱动测试和页面端到端测试。

## 4. 非目标

以下能力不进入第一个实施计划：

- 麦克风 ASR 语音输入；
- LLM 每生成一句、数字人立即播报一句的逐句流式播报；
- 数字人套餐计费、租户账单和商业化 API Key 管理；
- 替换现有视频知识库和 LLM 服务；
- 删除旧 Three.js 数字人文件；
- 建设后端 WebRTC 媒体中继服务。

逐句播报和 ASR 在核心版本稳定后分别作为独立子项目实施。

## 5. 方案选择

### 5.1 推荐方案

采用“浏览器运行讯飞 Web SDK，后端签发短期 WebSocket 鉴权 URL”的方式：

- SDK、画面和媒体流继续运行在浏览器；
- `APPID`、`APIKey`、`APISecret` 只存放在后端 `.env`；
- 后端根据讯飞 HMAC-SHA256 规则生成 `signed_url`；
- 前端调用 `setApiInfo({ appId, signedUrl, sceneId, sceneVersion })`；
- 前端通过 `writeText()` 驱动语音、口型和动作。

本地 SDK 类型声明已经支持 `signedUrl`、`writeText()`、`interrupt()`、播放器静音控制和播报事件，因此不需要后端代理媒体流。

### 5.2 不采用的方案

**浏览器直接使用 APIKey/APISecret**：改动小，但任何登录用户都能在网络响应和 DevTools 中获得长期密钥，不可用于正式环境。

**后端代理全部 WebSocket/WebRTC 流量**：安全边界更集中，但需要处理 WebSocket、WebRTC、媒体带宽和跨地域延迟，明显超出当前需求。

## 6. 总体架构

```text
┌──────────────────────────── 浏览器 ────────────────────────────┐
│                                                               │
│  Video Player ── current_time_ms ─┐                            │
│                                   ├─> /api/num-person/chat SSE │
│  Chat Input ──────────────────────┘              │             │
│                                                  ▼             │
│                                         回答文本 + 引用片段     │
│                                                  │             │
│                                                  ▼             │
│  /digital-human/session ─> signed_url ─> XfyunAvatarDriver     │
│                                                  │             │
│                                      interrupt + writeText     │
└──────────────────────────────────────────────────┼─────────────┘
                                                   │ WSS/WebRTC
                                                   ▼
                                            讯飞数字人服务

FastAPI:
  session endpoint ─> HMAC signer ─> APIKey/APISecret (.env only)
  chat endpoint ─> 当前时间片段 + 语义检索 ─> LLM SSE
```

## 7. 后端设计

### 7.1 配置

继续使用根目录 `.env`，新增或调整以下设置：

```env
XF_DH_ENABLED=true
XF_DH_APP_ID=
XF_DH_API_KEY=
XF_DH_API_SECRET=
XF_DH_AVATAR_ID=
XF_DH_SERVER_URL=
XF_DH_SDK_URL=/libs/avatar-sdk-web_3.2.3.1002/esm/index.js
XF_DH_SIGNED_URL_TTL_SEC=240
XF_DH_MEMORY_TTL_SEC=1800

XF_DH_WIDTH=720
XF_DH_HEIGHT=405
XF_DH_SCALE=1.15
XF_DH_MOVE_H=0
XF_DH_MOVE_V=-95
XF_DH_TRANSPARENT=true

XF_DH_TTS_VOICE=x4_lingxiaoxuan_oral
XF_DH_TTS_SPEED=50
XF_DH_TTS_PITCH=50
XF_DH_TTS_VOLUME=100
XF_DH_STREAM_PROTOCOL=webrtc
```

约束：

- `XF_DH_SERVER_URL` 必须是与当前 SDK、产品权限和区域匹配的绝对 `wss://` 地址；
- 不允许使用 `NEXT_PUBLIC_` 暴露任何讯飞长期凭据；
- `.env` 已由项目 `.gitignore` 排除；
- 附件中出现的原凭据必须在讯飞控制台轮换；
- `XF_DH_SCALE=0.15` 与仓库现状冲突，核心版本以 `1.15` 为初始值，通过真实形象做视觉标定。

### 7.2 鉴权签名模块

新增 `backend/app/xfyun_digital_human_auth.py`，只负责生成讯飞数字人短期鉴权 URL。公开函数签名为 `build_xfyun_digital_human_signed_url(base_url: str, api_key: str, api_secret: str, *, now: datetime | None = None) -> str`。

算法要求：

1. 解析 `base_url` 的 host 和 path；
2. 生成 GMT/RFC1123 `date`；
3. 构造 `host`、`date`、`GET <path> HTTP/1.1` 三行签名原文；
4. 使用 `APISecret` 执行 HMAC-SHA256；
5. Base64 编码摘要并构造 `authorization`；
6. 将 `authorization`、`date`、`host` 合并到 URL 查询参数；
7. 保留服务地址已有的非鉴权查询参数；
8. 非 `wss://` 的地址直接拒绝，防止继续使用不明确的相对 `/vmss` 地址或错误的 HTTP 产品接口签名。

`APISecret` 不得写入日志、异常信息或响应。

### 7.3 数字人配置接口

保留：

```http
GET /api/num-person/digital-human/config
```

只返回非敏感配置：

```json
{
  "enabled": true,
  "configured": true,
  "provider": "xfyun",
  "sdk_url": "/libs/avatar-sdk-web_3.2.3.1002/esm/index.js",
  "avatar_id": "avatar-id",
  "scene_id": "",
  "scene_version": "",
  "stage": {
    "width": 720,
    "height": 405,
    "scale": 1.15,
    "move_h": 0,
    "move_v": -95,
    "mask_region": {"top": 0, "right": 0, "bottom": 0, "left": 0},
    "transparent": true
  },
  "tts": {"vcn": "x4_lingxiaoxuan_oral", "speed": 50, "pitch": 50, "volume": 100},
  "stream": {"protocol": "webrtc", "alpha": 1}
}
```

响应中禁止出现：

- `api_key`
- `api_secret`
- `server_url`
- `signed_url`

### 7.4 数字人会话接口

新增：

```http
POST /api/num-person/digital-human/session
Authorization: Bearer <access-token>
```

接口使用项目现有 `get_current_user` 鉴权。开发环境可继续使用项目已有的 `auth_dev_bypass`。

成功响应：

```json
{
  "app_id": "public-app-id",
  "signed_url": "wss://avatar.example.com/v1/interact?authorization=encoded-signature",
  "expires_at": 1787198400,
  "scene_id": "",
  "scene_version": ""
}
```

规则：

- 未启用返回 `404 DH_DISABLED`；
- 配置不完整返回 `503 DH_NOT_CONFIGURED`；
- 服务地址非法返回 `503 DH_SERVER_URL_INVALID`；
- 响应添加 `Cache-Control: no-store, max-age=0` 和 `Pragma: no-cache`；
- `expires_at = 当前时间 + XF_DH_SIGNED_URL_TTL_SEC`，前端不得在到期后复用；
- 浏览器重连时重新申请会话，不缓存到 LocalStorage 或 IndexedDB。

### 7.5 视频记忆所有权和滑动过期

内存结构调整为：

```python
{
    "video_id": str,
    "user_id": str,
    "title": str,
    "segments": list[dict],
    "created_at": float,
    "last_access_at": float,
}
```

所有 `get_memory`、`search`、`clear_memory` 调用都携带当前登录用户 ID。`get_memory` 对其他用户的 `memory_id` 与不存在的记忆统一返回 `None`，`clear_memory` 统一返回 `False`，`search` 统一抛出 `MemoryNotFoundError`，均不泄露记忆是否属于其他用户。

过期逻辑改为：

```text
now - last_access_at > XF_DH_MEMORY_TTL_SEC
```

每次成功获取或检索后更新 `last_access_at`，默认滑动有效期为 1800 秒。

### 7.6 当前时间片段检索

`ChatReq` 新增：

```python
current_time_ms: int | None = Field(default=None, ge=0)
```

前端统一传毫秒，避免 timeline 使用毫秒而接口使用浮点秒造成换算混乱。

检索规则：

1. 找到满足 `start_ms <= current_time_ms <= end_ms` 的当前片段；
2. timeline 存在空隙时，允许选择距离当前位置 15 秒以内的最近片段；
3. 按现有 embedding/关键词算法取得语义相关片段；
4. 当前片段排在第一位，再补充语义结果；
5. 按 `segment_id` 去重，总数不超过 3；
6. 没有 `current_time_ms` 时保持原语义检索行为；
7. 问题包含“这里、这段、刚才、现在、这个”等指代词时，系统提示明确要求优先解释当前片段。

LLM 系统提示增加：

```text
当前播放位置：120.5 秒
当前位置片段：[s3] return 的返回值

相关视频片段：
1. [s3] return 会结束当前函数，并把表达式的值返回给调用方。
```

### 7.7 SSE 事件

核心版本继续按 token 显示文字，不实现逐句播报。事件约定为：

```text
token   {"text": "片段"}
sources {"segments": [{"segment_id": "s3", "start_ms": 120000, "end_ms": 132000}]}
done    {"text": "完整回答", "total_tokens": 32}
error   {"code": "NP_LLM_FAILED", "message": "对话生成失败"}
```

`done.text` 是数字人播报的唯一文本来源；前端 token 仅用于页面实时显示，避免因网络重试或事件兼容导致重复播报。

## 8. 前端设计

### 8.1 API 类型

`DigitalHumanConfig` 删除 `server_url`、`app_id`、`api_key`、`api_secret`，新增：

```typescript
export interface DigitalHumanSession {
  app_id: string
  signed_url: string
  expires_at: number
  scene_id?: string
  scene_version?: string
}
```

API 方法新增：

```typescript
getDigitalHumanSession(): Promise<DigitalHumanSession>
```

问答方法调整为：

```typescript
chatWithDigitalHuman(
  memoryId: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  currentTimeMs: number | null,
  onEvent?: (evt: SseEvent) => void,
): Promise<string>
```

返回值优先读取 `done.payload.text`，仅在旧后端没有该字段时回退到 token 拼接结果。

### 8.2 讯飞驱动边界

新增 `xfyun-avatar-driver.ts`，封装 SDK 平台对象，避免页面直接操作第三方 SDK：

```typescript
export interface XfyunDigitalHumanHandle {
  speak(text: string): Promise<void>
  interrupt(): Promise<void>
  setMuted(muted: boolean): Promise<void>
  isReady(): boolean
}
```

驱动规则：

- `speak()` 对空文本直接返回；
- 未连接时抛出 `DH_NOT_READY`，调用方只记录播报失败，不影响文字消息；
- 播报前先调用 `interrupt()`，保证新回答替换旧回答；
- `writeText()` 使用 `nlp: false`，禁止讯飞再次调用内部 NLP 改写 SparkLearn 的 RAG 回答；
- `avatar_dispatch.interactive_mode = 1`，采用打断模式；
- `content_analysis = 1`、`air = 1`，允许根据文本生成动作；
- 页面卸载时依次执行 `stop()`、`destroy()`；
- 日志不得打印 `signed_url`。

### 8.3 组件生命周期

`XfyunDigitalHumanLive` 使用 `forwardRef` 暴露控制句柄：

1. 获取安全配置；
2. 配置不完整时显示提示，不申请会话；
3. 申请短期会话；
4. 动态加载 `sdk_url`；
5. `setApiInfo({ appId, signedUrl, sceneId, sceneVersion })`；
6. 设置形象、TTS、透明流参数；
7. 启动 SDK；
8. `connected` 后进入 ready；
9. `disconnected` 时重新申请会话并最多按 1、2、4 秒重连三次；
10. 三次失败后显示错误覆盖层，保留文字聊天。

### 8.4 浏览器声音授权

SDK 初始化时把播放器设为默认静音，页面在数字人区域提供“开启声音”按钮。按钮点击时执行：

```typescript
player.muted = false
await player.resume()
```

按钮由真实用户手势触发，兼容 Chrome 和 Edge 的自动播放策略。用户关闭声音时只静音媒体，不停止数字人连接。

### 8.5 视频页问答与播报

视频页增加：

```typescript
const videoRef = useRef<HTMLVideoElement>(null)
const digitalHumanRef = useRef<XfyunDigitalHumanHandle>(null)
```

发送问题时：

1. 读取并固定 `currentTimeMs`；
2. 如果视频正在播放，立即暂停；
3. 调用 `/api/num-person/chat`；
4. token 继续实时更新聊天气泡；
5. `done.text` 到达后调用 `digitalHumanRef.current?.speak(answer)`；
6. 播报失败时显示非阻塞提示“回答已生成，数字人播报暂不可用”；
7. 不自动恢复视频，由学习者主动继续播放；
8. 新问题发送前调用 `interrupt()`。

## 9. 错误处理与降级

| 场景 | 行为 |
|---|---|
| 讯飞未配置 | 数字人区域显示配置提示，文字问答可用 |
| 签名接口失败 | 不加载 SDK，文字问答可用 |
| 签名过期/握手失败 | 重新申请一次新会话，再进入退避重连 |
| 浏览器拒绝带声音播放 | 保持静音并显示“开启声音”按钮 |
| SDK `writeText()` 失败 | 保留回答文字，显示非阻塞播报失败提示 |
| 新问题到达时仍在播报 | `interrupt()` 后提交新回答 |
| timeline 没有当前位置 | 使用 15 秒内最近片段；仍没有则语义检索 |
| 视频记忆过期 | 前端重新执行 memory/load，并提示已重新读取视频 |
| LLM 失败 | SSE `error`，不调用数字人播报 |

## 10. 安全要求

- 立即轮换附件中已经出现的讯飞凭据；
- 原始 `APISecret` 永远不得离开 FastAPI 进程；
- 配置、会话、记忆和聊天接口使用当前登录用户；
- 签名响应禁止缓存，禁止写入浏览器持久化存储；
- 后端日志只记录错误码和请求追踪 ID，不记录签名 URL；
- 生产环境必须使用 HTTPS/WSS；
- CSP 至少允许本地 SDK 和经确认的讯飞 WSS/媒体域名；
- 部署入口按登录用户限制数字人会话申请频率，建议不超过 10 次/分钟；
- 讯飞套餐并发上限通过部署配置控制，不在浏览器中信任计数。

## 11. 测试策略

### 11.1 后端

- 固定时间验证 HMAC 签名结果和查询参数；
- 非法协议、缺 host、空密钥验证；
- 配置接口断言不包含任何原始密钥字段；
- 会话接口断言 `no-store`、到期时间和错误码；
- 当前时间片段优先、最近片段、语义回退和去重测试；
- 不同用户访问同一 memory ID 的隔离测试；
- 滑动 TTL 刷新和过期测试；
- SSE `done.text` 与 token 拼接文本一致。

### 11.2 前端

- 驱动 `speak()` 会先打断，再以 `nlp: false` 调用 `writeText()`；
- 未连接、空文本、播报失败和 dispose 测试；
- API 类型和请求体包含 `current_time_ms`；
- 页面发送问题时暂停视频；
- 完整回答只播报一次；
- SDK 失败时聊天文字仍显示；
- 用户按钮能够解除静音。

### 11.3 真实环境冒烟

- Chrome、Edge 各验证一次；
- 半身位置、透明背景和画布缩放正确；
- 提问“这里是什么意思”命中当前位置片段；
- 连续提问时旧声音停止；
- 断网恢复、标签页切换和路由离开不残留音频；
- 浏览器网络面板中不存在原始 `APISecret`。

## 12. 验收标准

1. 视频页只渲染讯飞数字人，不加载旧 iframe 或旧 Three.js 数字人；
2. 网络响应、前端状态和日志中不存在原始 `APISecret`；
3. AI 回答完成后，数字人能够播报并同步口型和动作；
4. 同一回答不会被重复播报；
5. “这里、刚才、这一段”类问题优先使用当前播放片段；
6. 新问题能够打断旧播报；
7. 数字人失败时文字问答仍可继续；
8. 后端定向测试、前端 Vitest、Playwright 用例、前端 lint/build 全部通过；
9. `.env` 中使用的新密钥已经完成轮换，旧密钥失效。

## 13. 发布与回滚

### 13.1 发布顺序

1. 在讯飞控制台轮换凭据并确认 SDK/服务地址/Avatar/音色属于同一产品；
2. 先发布后端安全配置和 session 接口；
3. 验证配置接口不再泄密；
4. 再发布前端安全会话和播报控制；
5. 在测试环境进行真实讯飞冒烟；
6. 通过 `XF_DH_ENABLED` 灰度启用；
7. 观察连接成功率、播报失败率和平均会话时长。

### 13.2 回滚

- 前端回滚时关闭 `XF_DH_ENABLED`，保留文字问答；
- 后端旧的明文密钥响应不得恢复；
- 出现讯飞服务故障时只降级数字人，不回滚视频 RAG；
- 不需要恢复旧 iframe 数字人。

## 14. 后续路线图

### 14.1 逐句流式播报

在 SSE 中增加 `sentence` 事件，根据中文标点聚合句子；前端维护串行播报队列，并使用 SDK `request_id` 和 `frame_stop/action_stop` 推进。该阶段需要单独解决断句、队列背压、回答修订和重复事件幂等。

### 14.2 ASR 语音输入

复用 SDK `createRecorder()` 或单独接入讯飞 ASR，形成“麦克风音频 → ASR → 视频 RAG → LLM → 数字人播报”。该阶段需要单独处理麦克风权限、回声消除、数字人播报期间的误识别和隐私提示。

### 14.3 运营能力

根据真实使用量再增加并发配额、按用户统计、套餐余量告警和成本仪表盘，不在核心版本预建商业化系统。
