'use client'

import Image from 'next/image'
import { AlertTriangle, X } from 'lucide-react'

const SUPPORT_CONTACT = process.env.NEXT_PUBLIC_SUPPORT_CONTACT || '项目负责人'
const SUPPORT_CONTACT_IMAGE = process.env.NEXT_PUBLIC_SUPPORT_CONTACT_IMAGE || '/assets/contact-demo.jpg'

export function GenerationFailureContactDialog({
  open,
  message,
  detail,
  onClose,
}: {
  open: boolean
  message?: string
  detail?: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0f172a]/45 px-4 py-8 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-failure-title"
        className="w-full max-w-[620px] overflow-hidden rounded-[18px] border border-[#fecaca] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#fee2e2] bg-[#fff7f7] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#fee2e2] text-[#dc2626]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="generation-failure-title" className="text-[17px] font-bold text-[#111827]">
                生成服务暂时不可用
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[#6b7280]">
                可能是模型额度、服务配置或网络问题。请联系{SUPPORT_CONTACT}处理。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#64748b] transition hover:bg-white hover:text-[#111827]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_190px]">
          <div className="min-w-0">
            <p className="text-[14px] leading-6 text-[#374151]">
              {message || '当前生成请求没有成功完成，请扫码联系项目负责人确认额度、模型服务或部署配置。'}
            </p>
            {detail && (
              <pre className="mt-3 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-[10px] bg-[#f8fafc] p-3 text-[12px] leading-5 text-[#64748b]">
                {detail}
              </pre>
            )}
          </div>

          <div className="rounded-[14px] border border-[#e6eef9] bg-[#f8fbff] p-3">
            <div className="overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-[#dbe7f5]">
              <Image
                src={SUPPORT_CONTACT_IMAGE}
                alt="项目负责人微信联系方式二维码"
                width={1074}
                height={1532}
                className="block h-auto w-full"
              />
            </div>
            <p className="mt-2 text-center text-[12px] font-bold text-[#64748b]">扫码联系处理</p>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#fee2e2] bg-[#fffafa] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] bg-[#2563eb] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#1d4ed8]"
          >
            我知道了
          </button>
        </div>
      </section>
    </div>
  )
}
