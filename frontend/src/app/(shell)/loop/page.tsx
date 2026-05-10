'use client'

import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { api, Task } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function LoopPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  useEffect(() => { api.getTodayTasks().then(setTasks).catch(() => setTasks([])) }, [])
  const days = [
    { title: '今天', tone: 'blue' as const, text: '回顾函数返回值，完成达标题。' },
    { title: '明天', tone: 'green' as const, text: '复习作用域和参数传递，做变式题。' },
    { title: '后天', tone: 'purple' as const, text: '进入模块导入，生成代码案例。' },
  ]
  return (
    <div>
      <PageHead eyebrow="分析与反馈 / 复习计划" title="复习计划" description="复习计划把错题、薄弱点和路径节点压缩成未来三天的行动卡。" />
      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {days.map((day, idx) => (
          <ProtoCard key={day.title}>
            <Pill tone={day.tone}>{day.title}</Pill>
            <h2 className="mt-3 text-h2 font-bold text-ink">{day.text}</h2>
            <p className="mt-2 text-small leading-6 text-muted">预计 {idx === 0 ? 24 : 18} 分钟，完成后更新学习报告。</p>
          </ProtoCard>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_.9fr] gap-4 max-[900px]:grid-cols-1">
        <ProtoCard>
          <h2 className="mb-3 flex items-center gap-2 text-h2 font-bold text-ink"><CalendarDays className="h-5 w-5 text-blue" />本周提醒</h2>
          <div className="grid gap-2">
            {(tasks.length ? tasks : [{ id: '1', title: '完成函数返回值达标练习', duration: 12, type: 'quiz', status: 'pending' } as Task]).map(task => (
              <SoftCard key={task.id} className="flex items-center justify-between">
                <span className="text-small font-bold text-ink">{task.title}</span>
                <Pill>{task.duration}分</Pill>
              </SoftCard>
            ))}
          </div>
        </ProtoCard>
        <ProtoCard>
          <h2 className="mb-3 text-h2 font-bold text-ink">AI 能帮你的</h2>
          <div className="grid gap-2">
            <SoftCard className="text-small text-muted">把错题改成 5 道变式练习。</SoftCard>
            <SoftCard className="text-small text-muted">用生活化类比讲解 return。</SoftCard>
            <SoftCard className="text-small text-muted">根据本周报告调整路径顺序。</SoftCard>
          </div>
          <ProtoButton href="/tutor" className="mt-4 w-full">打开完整辅导</ProtoButton>
        </ProtoCard>
      </div>
    </div>
  )
}
