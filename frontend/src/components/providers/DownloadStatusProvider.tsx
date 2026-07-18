'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'

type DownloadNotice = {
  title: string
  detail: string
}

function isExeDownloadLink(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const link = target.closest('a')
  if (!link) return false

  const href = link.getAttribute('href') || ''
  const download = link.getAttribute('download') || ''
  return /\.exe(?:$|[?#])/i.test(href) || /\.exe$/i.test(download)
}

export function DownloadStatusProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<DownloadNotice | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const handleClick = (event: MouseEvent) => {
      if (!isExeDownloadLink(event.target)) return
      clearTimer()
      setNotice({
        title: '安装包正在下载',
        detail: '如果没有看到下载进度，请打开浏览器右上角下载列表或按 Ctrl + J 查看。',
      })
      timerRef.current = setTimeout(() => setNotice(null), 6500)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      clearTimer()
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return (
    <>
      {children}
      {notice && (
        <div className="fixed right-6 top-6 z-[10001] w-[min(390px,calc(100vw-32px))]">
          <div className="rounded-[14px] border border-[#bfdbfe] bg-white px-4 py-3 text-[#1d4ed8] shadow-[0_18px_50px_rgba(15,23,42,0.2)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eff6ff]">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0f172a]">{notice.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">{notice.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#334155]"
                aria-label="关闭下载提示"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
