'use client'

import { useState } from 'react'
import { X, Copy, Check, Link2, Lock, Globe, Users } from 'lucide-react'
import { getToken } from '@/lib/auth'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  resourceType: string
  resourceId: string
  title?: string
}

export function ShareDialog({ isOpen, onClose, resourceType, resourceId, title }: ShareDialogProps) {
  const [accessType, setAccessType] = useState<'public' | 'password' | 'specific'>('public')
  const [password, setPassword] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      const res = await fetch('/api/sharing/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          title: title || '',
          access_type: accessType,
          password: accessType === 'password' ? password : '',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '创建失败')
      const url = `${window.location.origin}/share/${json.data.share_code}`
      setShareUrl(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建分享链接失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#111827]">分享资料</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {!shareUrl ? (
            <>
              {/* 访问方式 */}
              <div>
                <label className="block text-sm font-medium text-[#52627b] mb-3">访问方式</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'public' as const, icon: Globe, label: '公开' },
                    { value: 'password' as const, icon: Lock, label: '密码访问' },
                    { value: 'specific' as const, icon: Users, label: '指定用户' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAccessType(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                        accessType === opt.value
                          ? 'border-[#2563eb] bg-[#eff6ff] text-[#2563eb]'
                          : 'border-gray-200 text-[#6b7280] hover:border-gray-300'
                      }`}
                    >
                      <opt.icon size={20} />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 密码输入 */}
              {accessType === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-[#52627b] mb-1.5">访问密码</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="设置访问密码"
                    className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={loading || (accessType === 'password' && !password)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#075ff0] to-[#5aa2ff] text-white font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成分享链接'}
              </button>
            </>
          ) : (
            <>
              {/* 分享链接 */}
              <div className="flex items-center gap-2 p-3 bg-[#f6f8fb] rounded-xl">
                <Link2 size={18} className="text-[#2563eb] shrink-0" />
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-[#111827] outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium hover:bg-gray-50"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>

              <p className="text-xs text-[#6b7280]">
                {accessType === 'password' && '需要密码才能访问 · '}
                分享链接可随时在「我的分享」中取消
              </p>

              <button
                onClick={onClose}
                className="w-full h-11 rounded-xl border border-gray-200 text-sm font-medium text-[#111827] hover:bg-gray-50"
              >
                完成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
