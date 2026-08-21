'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { api, type DigitalHumanConfig } from '@/lib/api'
import {
  XfyunAvatarDriver,
  type AvatarPlatform as DriverAvatarPlatform,
  type XfyunDigitalHumanHandle,
} from './xfyun-avatar-driver'

type AvatarSdkEventHandler = (...args: unknown[]) => void

type AvatarSdkPlatform = DriverAvatarPlatform & {
  on: (event: string, handler: AvatarSdkEventHandler) => AvatarSdkPlatform
  setApiInfo: (apiInfo: {
    appId: string
    signedUrl: string
    sceneId?: string
    sceneVersion?: string
  }) => AvatarSdkPlatform
  setGlobalParams: (config: Record<string, unknown>) => AvatarSdkPlatform
  start: (props?: { wrapper?: HTMLDivElement }) => Promise<void>
}

type AvatarSdkModule = {
  default: new (props?: { useInlinePlayer?: boolean; logLevel?: number; binaryData?: boolean }) => AvatarSdkPlatform
  SDKEvents?: Record<string, string>
}

type LoadState = 'loading_config' | 'missing_config' | 'loading_sdk' | 'starting' | 'ready' | 'error'

interface XfyunDigitalHumanLiveProps {
  className?: string
}

const RECONNECT_DELAYS_MS = [1000, 2000, 4000] as const

function buildMaskRegion(config: DigitalHumanConfig) {
  const mask = config.stage.mask_region
  if (!mask.top && !mask.right && !mask.bottom && !mask.left) return undefined
  return [mask.left, mask.top, mask.right, mask.bottom].join(',')
}

function buildGlobalParams(config: DigitalHumanConfig) {
  const stage = config.stage
  return {
    stream: {
      protocol: config.stream?.protocol || 'webrtc',
      alpha: config.stream?.alpha ?? (stage.transparent ? 1 : 0),
      fps: 25,
    },
    avatar: {
      avatar_id: config.avatar_id,
      width: stage.width,
      height: stage.height,
      scale: stage.scale,
      move_h: stage.move_h,
      move_v: stage.move_v,
      mask_region: buildMaskRegion(config),
    },
    tts: {
      vcn: config.tts?.vcn || 'x4_lingxiaoxuan_oral',
      speed: config.tts?.speed ?? 50,
      pitch: config.tts?.pitch ?? 50,
      volume: config.tts?.volume ?? 100,
    },
    avatar_dispatch: {
      enable_action_status: 1,
      interactive_mode: 1,
    },
    air: {
      air: 1,
      add_nonsemantic: 1,
    },
  }
}

async function importAvatarSdk(sdkUrl: string): Promise<AvatarSdkModule> {
  const url = sdkUrl.startsWith('/') ? `${window.location.origin}${sdkUrl}` : sdkUrl
  return import(/* webpackIgnore: true */ url) as Promise<AvatarSdkModule>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return '讯飞数字人启动失败'
}

const XfyunDigitalHumanLive = forwardRef<
  XfyunDigitalHumanHandle,
  XfyunDigitalHumanLiveProps
>(function XfyunDigitalHumanLive({ className = '' }, ref) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const driverRef = useRef<XfyunAvatarDriver | null>(null)
  const [state, setState] = useState<LoadState>('loading_config')
  const [message, setMessage] = useState('正在读取讯飞数字人配置')
  const [muted, setMuted] = useState(true)

  useImperativeHandle(ref, () => ({
    speak: async (text) => driverRef.current?.speak(text),
    interrupt: async () => driverRef.current?.interrupt(),
    setMuted: async (nextMuted) => driverRef.current?.setMuted(nextMuted),
    isReady: () => driverRef.current?.isReady() ?? false,
  }), [])

  useEffect(() => {
    let alive = true
    let connectionId = 0
    let reconnectAttempt = 0
    let reconnectTimer: number | null = null

    function disposeDriver() {
      const driver = driverRef.current
      driverRef.current = null
      if (!driver) return
      try {
        driver.dispose()
      } catch {
        // 路由切换或异常重连时忽略第三方 SDK 的清理失败。
      }
    }

    function scheduleReconnect(
      config: DigitalHumanConfig,
      sdk: AvatarSdkModule,
      error: unknown,
    ) {
      if (!alive) return
      connectionId += 1
      disposeDriver()

      if (reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
        setState('error')
        setMessage(getErrorMessage(error))
        return
      }

      const delay = RECONNECT_DELAYS_MS[reconnectAttempt]
      reconnectAttempt += 1
      setState('starting')
      setMessage(`连接中断，${delay / 1000} 秒后重试`)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        void connect(config, sdk)
      }, delay)
    }

    async function connect(config: DigitalHumanConfig, sdk: AvatarSdkModule) {
      const currentConnectionId = ++connectionId
      try {
        setState('starting')
        setMessage('正在申请讯飞数字人安全会话')
        const session = await api.getDigitalHumanSession()
        if (!alive || currentConnectionId !== connectionId) return

        const AvatarPlatform = sdk.default
        const platform = new AvatarPlatform({ useInlinePlayer: true, logLevel: 3 })
        const driver = new XfyunAvatarDriver(platform)
        driverRef.current = driver
        await driver.setMuted(true)
        setMuted(true)

        platform.on(sdk.SDKEvents?.connected || 'connected', () => {
          if (!alive || currentConnectionId !== connectionId) return
          reconnectAttempt = 0
          driver.markConnected(true)
          setState('ready')
          setMessage('讯飞数字人已就绪')
        })
        platform.on(sdk.SDKEvents?.error || 'error', (error) => {
          if (!alive || currentConnectionId !== connectionId) return
          driver.markConnected(false)
          scheduleReconnect(config, sdk, error)
        })
        platform.on(sdk.SDKEvents?.disconnected || 'disconnected', (error) => {
          if (!alive || currentConnectionId !== connectionId) return
          driver.markConnected(false)
          scheduleReconnect(config, sdk, error || new Error('讯飞数字人连接已断开'))
        })

        platform
          .setApiInfo({
            appId: session.app_id,
            signedUrl: session.signed_url,
            sceneId: session.scene_id || undefined,
            sceneVersion: session.scene_version || undefined,
          })
          .setGlobalParams(buildGlobalParams(config))

        if (!wrapperRef.current) throw new Error('数字人播放容器不存在')

        setMessage('正在启动讯飞数字人')
        await platform.start({ wrapper: wrapperRef.current })
      } catch (error) {
        if (!alive || currentConnectionId !== connectionId) return
        scheduleReconnect(config, sdk, error)
      }
    }

    async function startDigitalHuman() {
      try {
        setState('loading_config')
        setMessage('正在读取讯飞数字人配置')
        const config = await api.getDigitalHumanConfig()

        if (!alive) return
        if (!config.enabled || !config.configured) {
          setState('missing_config')
          setMessage('请先在 .env 中配置讯飞数字人参数')
          return
        }

        setState('loading_sdk')
        setMessage('正在加载讯飞数字人 SDK')
        const sdk = await importAvatarSdk(config.sdk_url)
        if (!sdk.default) throw new Error('SDK 已加载，但没有找到 AvatarPlatform 默认导出')

        if (!alive) return
        await connect(config, sdk)
      } catch (error) {
        if (!alive) return
        setState('error')
        setMessage(getErrorMessage(error))
      }
    }

    void startDigitalHuman()

    return () => {
      alive = false
      connectionId += 1
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      disposeDriver()
    }
  }, [])

  const showOverlay = state !== 'ready'
  const isMissingConfig = state === 'missing_config'
  const isError = state === 'error'

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={wrapperRef} className="absolute inset-0 h-full w-full [&_canvas]:!h-full [&_canvas]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" aria-label="讯飞数字人画面" />

      {state === 'ready' && muted && (
        <button
          type="button"
          onClick={async () => {
            try {
              await driverRef.current?.setMuted(false)
              setMuted(false)
            } catch {
              setMessage('请再次点击开启声音')
            }
          }}
          className="absolute bottom-3 right-3 z-20 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-blue shadow"
        >
          {message === '请再次点击开启声音' ? message : '开启声音'}
        </button>
      )}

      {showOverlay && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[linear-gradient(135deg,rgba(246,251,255,0.82),rgba(220,236,255,0.72))] px-6 text-center backdrop-blur-[1px]">
          <div className="max-w-[260px] rounded-[8px] border border-white/80 bg-white/86 px-4 py-3 shadow-sm">
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef5ff] text-blue">
              {isMissingConfig ? <Sparkles className="h-5 w-5" /> : isError ? <TriangleAlert className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <p className="text-[13px] font-bold text-[#26364f]">{message}</p>
            {state === 'missing_config' && (
              <p className="mt-1 text-[11px] leading-5 text-[#64748b]">
                配好 XF_DH_APP_ID、XF_DH_API_KEY、XF_DH_API_SECRET、XF_DH_AVATAR_ID 后重启服务。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default XfyunDigitalHumanLive
