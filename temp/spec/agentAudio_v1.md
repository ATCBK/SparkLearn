# agentAudio_v1.md

## 1. 功能定位

本次新增的是“Agent 语音播报”能力：前端拿到 AI 生成的回答文本后，可以调用后端 `/api/voice/tts`，由后端接入讯飞开放平台在线语音合成，将文本转换为可播放的 WAV 音频。

设计原则：

- 不改动原有 AI 对话、资源生成、视频生成主流程。
- 讯飞密钥只在后端读取，前端不接触 `APP_ID`、`API_KEY`、`API_SECRET`。
- TTS 能力封装成独立模块，后续智能辅导、资源讲解、学习报告、错题讲解都可以复用。

## 2. 本次新增/修改文件

| 文件 | 作用 |
| --- | --- |
| `backend/app/xfyun_tts.py` | 新增可复用讯飞 TTS 服务，负责鉴权 URL、WebSocket 调用、文本切分、PCM 转 WAV。 |
| `backend/app/routes/voice_admin.py` | 将原 `/api/voice/tts` 占位接口升级为真实 TTS 接口，并增加 `/api/voice/tts/status` 配置检查接口。 |
| `backend/app/config.py` | 标注讯飞 TTS API 配置位置。 |
| `frontend/src/lib/api/real.ts` | 新增 `synthesizeSpeech()`，供前端调用后端语音接口。 |
| `frontend/src/lib/api/index.ts` | 导出 `synthesizeSpeech`。 |
| `frontend/src/app/tutor/page.tsx` | 在 AI 回复下方增加纯图标播报按钮，并支持播放/暂停/继续。 |

## 3. 需要配置 API 的地方

配置位置已经在 `backend/app/config.py` 中用 `API CONFIG` 注释标出。建议不要直接改代码里的默认值，而是在项目根目录 `.env` 中配置：

```env
XF_TTS_APP_ID=你的讯飞应用AppID
XF_TTS_API_KEY=你的讯飞APIKey
XF_TTS_API_SECRET=你的讯飞APISecret
XF_TTS_BASE_URL=wss://tts-api.xfyun.cn/v2/tts
XF_TTS_DEFAULT_VOICE=xiaoyan
XF_TTS_TEXT_LIMIT=1000
XF_TTS_TIMEOUT_MS=15000
```

讯飞平台侧需要开通“在线语音合成”能力。密钥字段以讯飞开放平台控制台为准。

## 4. 后端接口

### 4.1 生成语音

`POST /api/voice/tts`

请求体：

```json
{
  "text": "AI 生成的讲解内容",
  "voice": "xiaoyan",
  "speed": 50,
  "volume": 60,
  "pitch": 50
}
```

返回：

- `Content-Type: audio/wav`
- 响应体为 WAV 音频二进制
- 响应头会带上：
  - `X-TTS-Provider`
  - `X-TTS-Voice`
  - `X-TTS-Duration-Ms`
  - `X-TTS-Chunks`

### 4.2 检查配置

`GET /api/voice/tts/status`

返回示例：

```json
{
  "success": true,
  "data": {
    "provider": "xunfei_tts",
    "configured": true,
    "base_url": "wss://tts-api.xfyun.cn/v2/tts",
    "default_voice": "xiaoyan",
    "text_limit": 1000
  },
  "error": null
}
```

## 5. 前端复用方式

任何页面只要拿到了 AI 文本，都可以这样调用：

```ts
const blob = await api.synthesizeSpeech(aiText)
const url = URL.createObjectURL(blob)
const audio = new Audio(url)
await audio.play()
```

当前已接入位置：

- 智能辅导页 `/tutor`
- 每条 AI 回复下方有一个纯图标按钮，不显示文字，悬停时通过 `title/aria-label` 标识用途。
- 第一次点击会调用 `/api/voice/tts`，浏览器播放返回的音频 Blob。
- 播放中再次点击同一个按钮会暂停；暂停后再次点击会继续播放。
- 播放中点击另一条 AI 回复的播报按钮，会停止当前音频并生成/播放新音频。

## 6. 复用建议

后续如果要在其他 Agent 场景复用，不需要重新写讯飞鉴权逻辑，只需要复用：

```py
from backend.app.xfyun_tts import TTSOptions, synthesize_speech

result = synthesize_speech(
    "这里是 AI 生成的内容",
    TTSOptions(voice="xiaoyan", speed=50, volume=60, pitch=50),
)
```

`result.audio` 是 WAV 二进制，可以直接返回给前端，也可以写入文件作为学习资源附件。

## 7. 注意事项

- 长文本会按 `XF_TTS_TEXT_LIMIT` 自动拆分，多段音频会合并为一个 WAV 返回。
- 前端不要保存讯飞密钥，也不要直接访问讯飞 WebSocket。
- 如果 `/api/voice/tts/status` 的 `configured` 为 `false`，说明后端还没有读到讯飞配置。
- 如果调用失败，优先检查 `.env`、讯飞能力是否开通、接口额度、网络和系统时间。
