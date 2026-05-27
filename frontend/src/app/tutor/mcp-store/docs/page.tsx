'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Shield, Workflow, Wrench } from 'lucide-react'

export default function McpStoreDocsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f5f7fa]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="mx-auto max-w-[980px] px-6 py-8">
        <button
          onClick={() => router.push('/tutor/mcp-store')}
          className="inline-flex items-center gap-2 rounded-lg border border-[#dbe3f0] bg-white px-3 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
        >
          <ArrowLeft className="h-4 w-4" /> 返回 MCP 商店
        </button>

        <div className="mt-5 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[#2563eb]">
            <BookOpen className="h-5 w-5" />
            <p className="text-sm font-semibold">MCP 服务接入文档</p>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-[#0f172a]">添加 MCP 服务（HTTP）说明</h1>
          <p className="mt-2 text-sm text-[#64748b]">本页面用于说明 MCP 商店表单各字段含义和建议接入流程。</p>
        </div>

        <div className="mt-4 grid gap-4">
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
            <h2 className="text-base font-semibold text-[#0f172a]">1. 基础信息</h2>
            <div className="mt-3 space-y-2 text-sm text-[#334155]">
              <p><b>服务端点 URL</b>：MCP 服务器 HTTP/HTTPS 地址，例如 `https://example.com/mcp`。</p>
              <p><b>名称和图标</b>：用于在 SparkLearn 内区分不同 MCP 服务。</p>
              <p><b>服务器标识符</b>：建议使用全局唯一标识，如 `sparklearn-mcp-server`。</p>
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#2563eb]" />
              <h2 className="text-base font-semibold text-[#0f172a]">2. 认证配置</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#334155]">
              <p>可启用“动态客户端注册”模式，填写客户端 ID/密钥后进行认证请求。</p>
              <p>如服务端要求 Token 或额外 Header，请在“请求头”配置区域补充。</p>
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#2563eb]" />
              <h2 className="text-base font-semibold text-[#0f172a]">3. 运行配置</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#334155]">
              <p>当使用 `stdio` 方式时，填写 `command`、`args_json`、`env_json`。</p>
              <p>`args_json` 需要是 JSON 数组，`env_json` 需要是 JSON 对象。</p>
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[#2563eb]" />
              <h2 className="text-base font-semibold text-[#0f172a]">4. 建议流程</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[#334155]">
              <p>1) 填写基础字段并保存服务。</p>
              <p>2) 点击“保存并测试连接”，确认工具发现数和状态。</p>
              <p>3) 连接成功后启用服务，再回到学习场景使用。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
