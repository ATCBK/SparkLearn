'use client'

import { useEffect, useState } from 'react'

/**
 * 学伴状态类型 - 映射任务执行状态
 */
export type PetState =
  | 'idle'        // 空闲：眨眼、呼吸
  | 'thinking'    // 思考：转圈
  | 'searching'   // 搜索：拿放大镜
  | 'reading'     // 阅读/摘要：翻书
  | 'analyzing'   // 对比分析：左右观察
  | 'success'     // 成功：跳跃
  | 'failed'      // 失败：挠头
  | 'waiting'     // 等待用户：挥手
  | 'levelup'     // 升级：发光

export type PetType = 'fox' | 'owl' | 'robot' | 'cat' | 'dragon' | 'penguin' | 'bunny' | 'panda'

interface Props {
  type: PetType
  state?: PetState
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = { sm: 48, md: 80, lg: 120 }

/**
 * SVG 动画学伴组件
 * 用 CSS 动画 + SVG 替代静态 emoji，让宠物"活起来"
 */
export function PetAvatar({ type, state = 'idle', size = 'md', className = '' }: Props) {
  const px = SIZE_MAP[size]
  const [blink, setBlink] = useState(false)

  // 空闲时随机眨眼
  useEffect(() => {
    if (state !== 'idle' && state !== 'waiting') return
    const interval = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 200)
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [state])

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {/* 状态光环 */}
      <div className={`absolute inset-0 rounded-full ${getGlowClass(state)}`} />

      {/* 宠物主体 */}
      <div className={`relative z-10 ${getAnimationClass(state)}`}>
        <svg
          width={px * 0.75}
          height={px * 0.75}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {type === 'fox' && <FoxSVG blink={blink} state={state} />}
          {type === 'owl' && <OwlSVG blink={blink} state={state} />}
          {type === 'robot' && <RobotSVG blink={blink} state={state} />}
          {type === 'cat' && <CatSVG blink={blink} state={state} />}
          {type === 'dragon' && <DragonSVG blink={blink} state={state} />}
          {type === 'penguin' && <PenguinSVG blink={blink} state={state} />}
          {type === 'bunny' && <BunnySVG blink={blink} state={state} />}
          {type === 'panda' && <PandaSVG blink={blink} state={state} />}
        </svg>
      </div>

      {/* 状态指示器 */}
      <StateIndicator state={state} size={size} />
    </div>
  )
}

// ─── 狐狸 SVG ─────────────────────────────────────────────────────────────────

function FoxSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 耳朵 */}
      <path d="M18 12 L22 26 L14 26 Z" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
      <path d="M46 12 L50 26 L42 26 Z" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
      <path d="M19 16 L21 24 L17 24 Z" fill="#fff7ed" />
      <path d="M45 16 L47 24 L43 24 Z" fill="#fff7ed" />

      {/* 头部 */}
      <ellipse cx="32" cy="36" rx="16" ry="14" fill="#fb923c" />
      <ellipse cx="32" cy="40" rx="10" ry="8" fill="#fff7ed" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="24" y1="33" x2="28" y2="33" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="33" x2="40" y2="33" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="26" cy="33" r="3" fill="#1f2937" />
          <circle cx="38" cy="33" r="3" fill="#1f2937" />
          <circle cx="27" cy="32" r="1" fill="white" />
          <circle cx="39" cy="32" r="1" fill="white" />
        </>
      )}

      {/* 鼻子 */}
      <ellipse cx="32" cy="38" rx="2" ry="1.5" fill="#1f2937" />

      {/* 嘴巴 - 根据状态变化 */}
      {state === 'success' && (
        <path d="M28 42 Q32 46 36 42" stroke="#1f2937" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}
      {state === 'failed' && (
        <path d="M28 44 Q32 41 36 44" stroke="#1f2937" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}
      {(state === 'idle' || state === 'waiting' || state === 'thinking') && (
        <path d="M29 42 Q32 44 35 42" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}

      {/* 搜索状态：放大镜 */}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="50" cy="20" r="5" stroke="#2563eb" strokeWidth="2" fill="none" />
          <line x1="54" y1="24" x2="57" y2="27" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* 阅读状态：书本 */}
      {state === 'reading' && (
        <g>
          <rect x="42" y="42" width="12" height="9" rx="1" fill="#2563eb" opacity="0.8" />
          <line x1="48" y1="42" x2="48" y2="51" stroke="white" strokeWidth="0.5" />
          <line x1="44" y1="45" x2="47" y2="45" stroke="white" strokeWidth="0.5" />
          <line x1="49" y1="45" x2="52" y2="45" stroke="white" strokeWidth="0.5" />
          <line x1="44" y1="47" x2="47" y2="47" stroke="white" strokeWidth="0.5" />
          <line x1="49" y1="47" x2="52" y2="47" stroke="white" strokeWidth="0.5" />
        </g>
      )}
    </g>
  )
}

// ─── 猫头鹰 SVG ──────────────────────────────────────────────────────────────

function OwlSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 耳朵羽毛 */}
      <path d="M20 14 L24 24 L16 22 Z" fill="#78716c" />
      <path d="M44 14 L48 22 L40 24 Z" fill="#78716c" />

      {/* 身体 */}
      <ellipse cx="32" cy="38" rx="15" ry="16" fill="#a8a29e" />
      <ellipse cx="32" cy="42" rx="10" ry="10" fill="#fafaf9" />

      {/* 眼圈 */}
      <circle cx="25" cy="32" r="7" fill="#fafaf9" stroke="#78716c" strokeWidth="1" />
      <circle cx="39" cy="32" r="7" fill="#fafaf9" stroke="#78716c" strokeWidth="1" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="22" y1="32" x2="28" y2="32" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="32" x2="42" y2="32" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="32" r="4" fill="#f59e0b" />
          <circle cx="39" cy="32" r="4" fill="#f59e0b" />
          <circle cx="25" cy="32" r="2" fill="#1f2937" />
          <circle cx="39" cy="32" r="2" fill="#1f2937" />
          <circle cx="26" cy="31" r="0.8" fill="white" />
          <circle cx="40" cy="31" r="0.8" fill="white" />
        </>
      )}

      {/* 喙 */}
      <path d="M30 38 L32 42 L34 38 Z" fill="#f59e0b" />

      {/* 状态表情 */}
      {state === 'success' && (
        <path d="M28 46 Q32 49 36 46" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}
      {state === 'failed' && (
        <path d="M28 48 Q32 45 36 48" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}

      {/* 搜索状态 */}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="52" cy="18" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="55" y1="21" x2="57" y2="23" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* 阅读状态 */}
      {state === 'reading' && (
        <g>
          <rect x="44" y="44" width="10" height="8" rx="1" fill="#8b5cf6" opacity="0.8" />
          <line x1="49" y1="44" x2="49" y2="52" stroke="white" strokeWidth="0.5" />
        </g>
      )}
    </g>
  )
}

// ─── 机器人 SVG ──────────────────────────────────────────────────────────────

function RobotSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 天线 */}
      <line x1="32" y1="10" x2="32" y2="18" stroke="#6b7280" strokeWidth="2" />
      <circle cx="32" cy="8" r="3" fill="#2563eb" className={state === 'thinking' ? 'animate-pulse' : ''} />

      {/* 头部 */}
      <rect x="18" y="18" width="28" height="22" rx="6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* 面板 */}
      <rect x="22" y="22" width="20" height="14" rx="3" fill="#1e293b" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="26" y1="29" x2="30" y2="29" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
          <line x1="34" y1="29" x2="38" y2="29" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="25" y="26" rx="1" width="6" height="6" fill={state === 'failed' ? '#ef4444' : '#22d3ee'} />
          <rect x="33" y="26" rx="1" width="6" height="6" fill={state === 'failed' ? '#ef4444' : '#22d3ee'} />
          {state === 'success' && (
            <>
              <rect x="26" y="27" width="4" height="2" fill="#1e293b" />
              <rect x="34" y="27" width="4" height="2" fill="#1e293b" />
            </>
          )}
        </>
      )}

      {/* 嘴巴 */}
      {state === 'success' ? (
        <rect x="28" y="34" width="8" height="2" rx="1" fill="#22d3ee" />
      ) : state === 'failed' ? (
        <rect x="29" y="34" width="6" height="1.5" rx="0.75" fill="#ef4444" />
      ) : (
        <rect x="29" y="34" width="6" height="1.5" rx="0.75" fill="#22d3ee" opacity="0.6" />
      )}

      {/* 身体 */}
      <rect x="22" y="42" width="20" height="14" rx="4" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
      <rect x="26" y="46" width="12" height="6" rx="2" fill="#e2e8f0" />

      {/* 搜索状态 */}
      {state === 'searching' && (
        <g className="animate-pulse">
          <circle cx="52" cy="16" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="55" y1="19" x2="57" y2="21" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {/* 分析状态：数据流 */}
      {state === 'analyzing' && (
        <g className="animate-pulse" style={{ animationDuration: '1s' }}>
          <rect x="48" y="22" width="8" height="2" rx="1" fill="#2563eb" opacity="0.8" />
          <rect x="50" y="26" width="6" height="2" rx="1" fill="#2563eb" opacity="0.6" />
          <rect x="48" y="30" width="8" height="2" rx="1" fill="#2563eb" opacity="0.4" />
        </g>
      )}
    </g>
  )
}

// ─── 小猫 SVG ─────────────────────────────────────────────────────────────────

function CatSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 耳朵 */}
      <path d="M17 16 L22 28 L12 26 Z" fill="#6366f1" />
      <path d="M47 16 L52 26 L42 28 Z" fill="#6366f1" />
      <path d="M18 19 L21 27 L15 25 Z" fill="#e0e7ff" />
      <path d="M46 19 L49 25 L43 27 Z" fill="#e0e7ff" />

      {/* 头部 */}
      <ellipse cx="32" cy="38" rx="16" ry="14" fill="#818cf8" />
      <ellipse cx="32" cy="42" rx="9" ry="7" fill="#e0e7ff" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="24" y1="34" x2="28" y2="34" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="34" x2="40" y2="34" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="26" cy="34" rx="3" ry="3.5" fill="#fbbf24" />
          <ellipse cx="38" cy="34" rx="3" ry="3.5" fill="#fbbf24" />
          <ellipse cx="26" cy="34" rx="1.5" ry="3" fill="#1f2937" />
          <ellipse cx="38" cy="34" rx="1.5" ry="3" fill="#1f2937" />
          <circle cx="27" cy="33" r="0.8" fill="white" />
          <circle cx="39" cy="33" r="0.8" fill="white" />
        </>
      )}

      {/* 鼻子 */}
      <path d="M31 39 L32 40.5 L33 39 Z" fill="#f472b6" />

      {/* 胡须 */}
      <line x1="14" y1="38" x2="24" y2="39" stroke="#6b7280" strokeWidth="0.5" />
      <line x1="14" y1="41" x2="24" y2="41" stroke="#6b7280" strokeWidth="0.5" />
      <line x1="40" y1="39" x2="50" y2="38" stroke="#6b7280" strokeWidth="0.5" />
      <line x1="40" y1="41" x2="50" y2="41" stroke="#6b7280" strokeWidth="0.5" />

      {/* 嘴巴 */}
      {state === 'success' ? (
        <path d="M29 42 Q32 45 35 42" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M30 42 L32 43 L34 42" stroke="#1f2937" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      )}

      {/* 搜索状态 */}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="50" cy="20" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="53" y1="23" x2="55" y2="25" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

// ─── 小龙 SVG ─────────────────────────────────────────────────────────────────

function DragonSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 角 */}
      <path d="M22 12 L25 22 L19 20 Z" fill="#f59e0b" />
      <path d="M42 12 L45 20 L39 22 Z" fill="#f59e0b" />

      {/* 头部 */}
      <ellipse cx="32" cy="34" rx="15" ry="13" fill="#10b981" />
      <ellipse cx="32" cy="38" rx="10" ry="8" fill="#d1fae5" />

      {/* 鳞片装饰 */}
      <circle cx="32" cy="22" r="2" fill="#059669" opacity="0.6" />
      <circle cx="28" cy="24" r="1.5" fill="#059669" opacity="0.4" />
      <circle cx="36" cy="24" r="1.5" fill="#059669" opacity="0.4" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="24" y1="32" x2="28" y2="32" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="32" x2="40" y2="32" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="26" cy="32" rx="3" ry="3.5" fill="#fbbf24" />
          <ellipse cx="38" cy="32" rx="3" ry="3.5" fill="#fbbf24" />
          <ellipse cx="26" cy="32" rx="1.5" ry="2.5" fill="#1f2937" />
          <ellipse cx="38" cy="32" rx="1.5" ry="2.5" fill="#1f2937" />
        </>
      )}

      {/* 鼻孔 */}
      <circle cx="29" cy="38" r="1" fill="#065f46" />
      <circle cx="35" cy="38" r="1" fill="#065f46" />

      {/* 嘴巴 */}
      {state === 'success' ? (
        <path d="M27 42 Q32 46 37 42" stroke="#065f46" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M29 42 Q32 43 35 42" stroke="#065f46" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}

      {/* 小翅膀 */}
      <path d="M12 36 Q8 30 14 28 Q16 34 14 38 Z" fill="#6ee7b7" opacity="0.7" />
      <path d="M52 36 Q56 30 50 28 Q48 34 50 38 Z" fill="#6ee7b7" opacity="0.7" />

      {/* 火焰（搜索/思考状态） */}
      {(state === 'searching' || state === 'thinking') && (
        <g className="animate-pulse">
          <path d="M30 46 Q32 50 34 46 Q33 48 32 50 Q31 48 30 46" fill="#f97316" opacity="0.8" />
        </g>
      )}
    </g>
  )
}

// ─── 企鹅 SVG ─────────────────────────────────────────────────────────────────

function PenguinSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 身体 */}
      <ellipse cx="32" cy="38" rx="14" ry="16" fill="#1e293b" />
      <ellipse cx="32" cy="42" rx="9" ry="11" fill="#f8fafc" />

      {/* 头部 */}
      <circle cx="32" cy="26" r="12" fill="#1e293b" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="26" y1="26" x2="30" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="34" y1="26" x2="38" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="27" cy="26" r="3.5" fill="white" />
          <circle cx="37" cy="26" r="3.5" fill="white" />
          <circle cx="27" cy="26" r="2" fill="#1f2937" />
          <circle cx="37" cy="26" r="2" fill="#1f2937" />
          <circle cx="28" cy="25" r="0.8" fill="white" />
          <circle cx="38" cy="25" r="0.8" fill="white" />
        </>
      )}

      {/* 嘴 */}
      <path d="M29 31 L32 34 L35 31 Z" fill="#f97316" />

      {/* 腮红 */}
      <circle cx="23" cy="29" r="2" fill="#fda4af" opacity="0.5" />
      <circle cx="41" cy="29" r="2" fill="#fda4af" opacity="0.5" />

      {/* 翅膀 */}
      <ellipse cx="17" cy="40" rx="4" ry="8" fill="#334155" transform="rotate(-10 17 40)" />
      <ellipse cx="47" cy="40" rx="4" ry="8" fill="#334155" transform="rotate(10 47 40)" />

      {/* 脚 */}
      <ellipse cx="28" cy="54" rx="4" ry="2" fill="#f97316" />
      <ellipse cx="36" cy="54" rx="4" ry="2" fill="#f97316" />

      {/* 状态 */}
      {state === 'success' && (
        <path d="M28 32 Q32 35 36 32" stroke="#1e293b" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="50" cy="16" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="53" y1="19" x2="55" y2="21" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

// ─── 兔子 SVG ─────────────────────────────────────────────────────────────────

function BunnySVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 长耳朵 */}
      <ellipse cx="24" cy="14" rx="4" ry="12" fill="#fda4af" stroke="#f472b6" strokeWidth="0.5" />
      <ellipse cx="40" cy="14" rx="4" ry="12" fill="#fda4af" stroke="#f472b6" strokeWidth="0.5" />
      <ellipse cx="24" cy="14" rx="2" ry="8" fill="#fff1f2" />
      <ellipse cx="40" cy="14" rx="2" ry="8" fill="#fff1f2" />

      {/* 头部 */}
      <circle cx="32" cy="36" r="14" fill="#fff1f2" stroke="#fda4af" strokeWidth="0.5" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="25" y1="34" x2="29" y2="34" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          <line x1="35" y1="34" x2="39" y2="34" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="27" cy="34" r="3" fill="#be185d" />
          <circle cx="37" cy="34" r="3" fill="#be185d" />
          <circle cx="28" cy="33" r="1" fill="white" />
          <circle cx="38" cy="33" r="1" fill="white" />
        </>
      )}

      {/* 鼻子 */}
      <ellipse cx="32" cy="39" rx="2" ry="1.5" fill="#f472b6" />

      {/* 嘴巴 */}
      <path d="M30 41 L32 43 L34 41" stroke="#9f1239" strokeWidth="0.8" fill="none" strokeLinecap="round" />

      {/* 腮红 */}
      <circle cx="22" cy="38" r="2.5" fill="#fda4af" opacity="0.4" />
      <circle cx="42" cy="38" r="2.5" fill="#fda4af" opacity="0.4" />

      {/* 状态 */}
      {state === 'success' && (
        <path d="M28 42 Q32 45 36 42" stroke="#9f1239" strokeWidth="1" fill="none" strokeLinecap="round" />
      )}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="50" cy="20" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="53" y1="23" x2="55" y2="25" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

// ─── 熊猫 SVG ─────────────────────────────────────────────────────────────────

function PandaSVG({ blink, state }: { blink: boolean; state: PetState }) {
  return (
    <g>
      {/* 耳朵 */}
      <circle cx="20" cy="20" r="6" fill="#1f2937" />
      <circle cx="44" cy="20" r="6" fill="#1f2937" />

      {/* 头部 */}
      <circle cx="32" cy="34" r="15" fill="#fafafa" stroke="#e5e7eb" strokeWidth="0.5" />

      {/* 眼圈 */}
      <ellipse cx="25" cy="32" rx="5" ry="5.5" fill="#1f2937" />
      <ellipse cx="39" cy="32" rx="5" ry="5.5" fill="#1f2937" />

      {/* 眼睛 */}
      {blink ? (
        <>
          <line x1="23" y1="32" x2="27" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="37" y1="32" x2="41" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="32" r="2.5" fill="white" />
          <circle cx="39" cy="32" r="2.5" fill="white" />
          <circle cx="25" cy="32" r="1.5" fill="#1f2937" />
          <circle cx="39" cy="32" r="1.5" fill="#1f2937" />
          <circle cx="26" cy="31" r="0.6" fill="white" />
          <circle cx="40" cy="31" r="0.6" fill="white" />
        </>
      )}

      {/* 鼻子 */}
      <ellipse cx="32" cy="38" rx="3" ry="2" fill="#1f2937" />

      {/* 嘴巴 */}
      {state === 'success' ? (
        <path d="M28 41 Q32 44 36 41" stroke="#1f2937" strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M30 41 Q32 42 34 41" stroke="#1f2937" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      )}

      {/* 腮红 */}
      <circle cx="21" cy="38" r="2" fill="#fda4af" opacity="0.3" />
      <circle cx="43" cy="38" r="2" fill="#fda4af" opacity="0.3" />

      {/* 竹子（阅读状态） */}
      {state === 'reading' && (
        <g>
          <rect x="48" y="28" width="3" height="20" rx="1.5" fill="#16a34a" />
          <ellipse cx="52" cy="30" rx="4" ry="2" fill="#22c55e" opacity="0.7" />
          <ellipse cx="52" cy="36" rx="3.5" ry="1.8" fill="#22c55e" opacity="0.6" />
        </g>
      )}

      {/* 搜索状态 */}
      {state === 'searching' && (
        <g className="animate-bounce" style={{ animationDuration: '1.5s' }}>
          <circle cx="52" cy="18" r="4" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <line x1="55" y1="21" x2="57" y2="23" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

// ─── 状态指示器 ──────────────────────────────────────────────────────────────

function StateIndicator({ state, size }: { state: PetState; size: 'sm' | 'md' | 'lg' }) {
  if (state === 'idle' || state === 'waiting') return null

  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
  const position = size === 'sm' ? '-bottom-0.5 -right-0.5' : '-bottom-1 -right-1'

  const colors: Record<PetState, string> = {
    idle: '',
    thinking: 'bg-amber-400',
    searching: 'bg-blue-500',
    reading: 'bg-purple-500',
    analyzing: 'bg-indigo-500',
    success: 'bg-emerald-500',
    failed: 'bg-red-500',
    waiting: '',
    levelup: 'bg-amber-400',
  }

  return (
    <div className={`absolute ${position} ${dotSize} rounded-full ${colors[state]} ring-2 ring-white ${
      state === 'thinking' || state === 'searching' || state === 'reading' || state === 'analyzing'
        ? 'animate-pulse'
        : ''
    }`} />
  )
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function getGlowClass(state: PetState): string {
  switch (state) {
    case 'levelup':
      return 'bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 animate-pulse opacity-60'
    case 'success':
      return 'bg-emerald-100 opacity-40 animate-ping'
    case 'searching':
    case 'reading':
    case 'analyzing':
    case 'thinking':
      return 'bg-blue-50 opacity-30'
    default:
      return ''
  }
}

function getAnimationClass(state: PetState): string {
  switch (state) {
    case 'idle':
      return 'animate-[breathe_3s_ease-in-out_infinite]'
    case 'thinking':
      return 'animate-[wobble_1.5s_ease-in-out_infinite]'
    case 'searching':
      return 'animate-[peek_2s_ease-in-out_infinite]'
    case 'reading':
      return 'animate-[nod_2s_ease-in-out_infinite]'
    case 'analyzing':
      return 'animate-[lookAround_2.5s_ease-in-out_infinite]'
    case 'success':
      return 'animate-[jump_0.6s_ease-out]'
    case 'failed':
      return 'animate-[shake_0.5s_ease-in-out]'
    case 'waiting':
      return 'animate-[wave_2s_ease-in-out_infinite]'
    case 'levelup':
      return 'animate-[grow_1s_ease-out]'
    default:
      return ''
  }
}

/**
 * 将任务状态映射为宠物状态
 */
export function taskStatusToPetState(
  taskStatus: string | null,
  taskType?: string
): PetState {
  if (!taskStatus) return 'idle'
  switch (taskStatus) {
    case 'pending':
      return 'thinking'
    case 'running':
      switch (taskType) {
        case 'search': return 'searching'
        case 'summarize': return 'reading'
        case 'compare': return 'analyzing'
        default: return 'thinking'
      }
    case 'completed':
      return 'success'
    case 'failed':
      return 'failed'
    default:
      return 'idle'
  }
}
