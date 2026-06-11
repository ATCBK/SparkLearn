'use client'

import { useEffect, useState } from 'react'
import { api, AgentTask } from '@/lib/api'
import { ProtoCard, Pill } from '@/components/proto'
import { Clock, Search, FileText, GitCompare, Sparkles } from 'lucide-react'

const TASK_TYPE_INFO: Record<string, { label: string; icon: React.ReactNode; tone: 'blue' | 'green' | 'orange' | 'purple' }> = {
  search: { label: '搜索', icon: <Search className="h-3 w-3" />, tone: 'blue' },
  summarize: { label: '摘要', icon: <FileText className="h-3 w-3" />, tone: 'green' },
  compare: { label: '对比', icon: <GitCompare className="h-3 w-3" />, tone: 'purple' },
  recommend: { label: '推荐', icon: <Sparkles className="h-3 w-3" />, tone: 'orange' },
}

const STATUS_INFO: Record<string, { label: string; tone: 'blue' | 'green' | 'orange' | 'red' }> = {
  pending: { label: '等待中', tone: 'blue' },
  running: { label: '执行中', tone: 'orange' },
  completed: { label: '已完成', tone: 'green' },
  failed: { label: '失败', tone: 'red' },
}

export function AgentHistory() {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getAgentTasks(1, 10)
        setTasks(data.items)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    void load()
  }, [])

  return (
    <ProtoCard>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-[#6b7280]" />
        <h3 className="text-sm font-bold text-[#111827]">最近任务</h3>
      </div>

      {loading && <div className="text-xs text-[#9ca3af] text-center py-4">加载中...</div>}

      {!loading && tasks.length === 0 && (
        <div className="text-xs text-[#9ca3af] text-center py-6">
          还没有任务记录<br />试试让学习伙伴帮你搜索资料吧！
        </div>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {tasks.map(task => {
          const typeInfo = TASK_TYPE_INFO[task.task_type] || TASK_TYPE_INFO.search
          const statusInfo = STATUS_INFO[task.status] || STATUS_INFO.pending
          return (
            <div key={task.task_id} className="p-2.5 rounded-lg border border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Pill tone={typeInfo.tone}>{typeInfo.icon} {typeInfo.label}</Pill>
                <Pill tone={statusInfo.tone}>{statusInfo.label}</Pill>
              </div>
              <p className="text-xs text-[#374151] truncate">{task.input_text}</p>
              <div className="text-[10px] text-[#9ca3af] mt-1">
                {new Date(task.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
    </ProtoCard>
  )
}
