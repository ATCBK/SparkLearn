'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { api, type DigitalHumanConfig } from '@/lib/api'

type AvatarSdkEventHandler = (...args: unknown[]) => void

type AvatarPlatform = {
  on: (event: string, handler: AvatarSdkEventHandler) => AvatarPlatform
  setApiInfo: (apiInfo: {
    serverUrl?: string
    appId: string
    apiKey?: string
    apiSecret?: string
    sceneId?: string
    sceneVersion?: string
  }) => AvatarPlatform
  setGlobalParams: (config: Record<string, unknown>) => AvatarPlatform
  start: (props?: { wrapper?: HTMLDivElement }) => Promise<void>
  stop: () => void
  destroy: () => void
  writeText?: (text: string, extend?: Record<string, unknown>) => Promise<string>
}

type AvatarSdkModule = {
  default: new (props?: { useInlinePlayer?: boolean; logLevel?: number; binaryData?: boolean }) => AvatarPlatform
  SDKEvents?: Record<string, string>
}

type LoadState = 'loading_config' | 'missing_config' | 'loading_sdk' | 'starting' | 'ready' | 'error'

interface XfyunDigitalHumanLiveProps {
  className?: string
}

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

export default function XfyunDigitalHumanLive({ className = '' }: XfyunDigitalHumanLiveProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const platformRef = useRef<AvatarPlatform | null>(null)
  const [state, setState] = useState<LoadState>('loading_config')
  const [message, setMessage] = useState('正在读取讯飞数字人配置')

  useEffect(() => {
    let alive = true

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
        const AvatarPlatform = sdk.default
        if (!AvatarPlatform) throw new Error('SDK 已加载，但没有找到 AvatarPlatform 默认导出')

        if (!alive) return
        const platform = new AvatarPlatform({ useInlinePlayer: true, logLevel: 3 })
        platformRef.current = platform

        platform.on(sdk.SDKEvents?.connected || 'connected', () => {
          if (!alive) return
          setState('ready')
          setMessage('讯飞数字人已就绪')
        })
        platform.on(sdk.SDKEvents?.error || 'error', (error) => {
          if (!alive) return
          setState('error')
          setMessage(getErrorMessage(error))
        })
        platform.on(sdk.SDKEvents?.disconnected || 'disconnected', (error) => {
          if (!alive) return
          if (error) {
            setState('error')
            setMessage(getErrorMessage(error))
          }
        })

        platform
          .setApiInfo({
            serverUrl: config.server_url,
            appId: config.app_id,
            apiKey: config.api_key,
            apiSecret: config.api_secret,
            sceneId: config.scene_id || undefined,
            sceneVersion: config.scene_version || undefined,
          })
          .setGlobalParams(buildGlobalParams(config))

        if (!wrapperRef.current) throw new Error('数字人播放容器不存在')

        setState('starting')
        setMessage('正在启动讯飞数字人')
        await platform.start({ wrapper: wrapperRef.current })
      } catch (error) {
        if (!alive) return
        setState('error')
        setMessage(getErrorMessage(error))
      }
    }

    void startDigitalHuman()

    return () => {
      alive = false
      try {
        platformRef.current?.stop()
        platformRef.current?.destroy()
      } catch {
        // Ignore SDK cleanup failures during route transitions.
      }
      platformRef.current = null
    }
  }, [])

  const showOverlay = state !== 'ready'
  const isError = state === 'error' || state === 'missing_config'

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={wrapperRef} className="absolute inset-0 h-full w-full [&_canvas]:!h-full [&_canvas]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" aria-label="讯飞数字人画面" />

      {showOverlay && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[linear-gradient(135deg,rgba(246,251,255,0.82),rgba(220,236,255,0.72))] px-6 text-center backdrop-blur-[1px]">
          <div className="max-w-[260px] rounded-[8px] border border-white/80 bg-white/86 px-4 py-3 shadow-sm">
            <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-[8px] bg-[#eef5ff] text-blue">
              {isError ? <TriangleAlert className="h-5 w-5" /> : state === 'missing_config' ? <Sparkles className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
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
}
