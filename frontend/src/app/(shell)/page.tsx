'use client'

import { useEffect, useState } from 'react'
import { api, Task, Resource, DashboardStats, StudentProfile, MasteryRecord, ContributionDay } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDateChinese, formatDurationShort } from '@/lib/utils/format'
import {
  Clock, CheckCircle2, Target, Flame, Play, BookOpen,
  PenTool, Code, ChevronRight, TrendingUp, AlertCircle,
} from 'lucide-react'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentResources, setRecentResources] = useState<Resource[]>([])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [contributions, setContributions] = useState<ContributionDay[]>([])
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const [t, s, r, p, c, m] = await Promise.all([
        api.getTodayTasks(),
        api.getDashboardStats(),
        api.getRecentResources(),
        api.getProfile(),
        api.getContributionData(),
        api.getMasteryData(),
      ])
      setTasks(t)
      setStats(s)
      setRecentResources(r)
      setProfile(p)
      setContributions(c)
      setMastery(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  const taskTypeIcon = {
    video: <Play className="w-4 h-4" />,
    reading: <BookOpen className="w-4 h-4" />,
    quiz: <PenTool className="w-4 h-4" />,
    practice: <Code className="w-4 h-4" />,
  }

  const totalContributions = contributions.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="animate-fade-in-up">
        <p className="text-caption text-ink-tertiary mb-2">{formatDateChinese(new Date())}</p>
        <h1 className="text-display text-ink">
          继续你的<span className="text-gradient">学习之旅</span>
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <Badge variant="success">
            <Flame className="w-3 h-3 mr-1" />
            连续学习 {stats?.streakDays} 天
          </Badge>
          <span className="text-body text-ink-secondary">
            你已经走在成为 Python 高手的路上了
          </span>
        </div>
      </div>

      {/* Featured Card */}
      <Card className="bg-blue-100 p-8 animate-fade-in-up delay-1">
        <div className="flex items-center gap-8">
          <LightProgressRing value={75} size={100} strokeWidth={8} />
          <div className="flex-1">
            <h2 className="text-h3 text-ink mb-1">Python 程序设计</h2>
            <p className="text-body text-ink-tertiary mb-4">当前学习路径</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success">基础语法</Badge>
              <ChevronRight className="w-3 h-3 text-ink-disabled" />
              <Badge variant="info">函数与模块</Badge>
              <ChevronRight className="w-3 h-3 text-ink-disabled" />
              <Badge>面向对象</Badge>
              <ChevronRight className="w-3 h-3 text-ink-disabled" />
              <Badge>模块</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 animate-fade-in-up delay-2">
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue" />}
          label="学习时长"
          value={`${stats?.totalHours}h`}
          color="bg-blue/5"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-success" />}
          label="任务完成率"
          value={`${Math.round((stats?.taskCompletionRate ?? 0) * 100)}%`}
          color="bg-success/5"
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-warning" />}
          label="正确率"
          value={`${Math.round((stats?.quizAccuracy ?? 0) * 100)}%`}
          color="bg-warning/5"
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-purple" />}
          label="连续天数"
          value={`${stats?.streakDays}天`}
          color="bg-purple/5"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-[1fr_360px] gap-6 animate-fade-in-up delay-3">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Today's Tasks */}
          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">今日任务</h3>
            <div className="space-y-2">
              {tasks.map(task => (
                <TaskItemRow key={task.id} task={task} icon={taskTypeIcon[task.type]} onToggle={() => {
                  setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t))
                }} />
              ))}
            </div>
          </Card>

          {/* Learning Contribution Heatmap */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 text-ink">学习打卡</h3>
              <span className="text-caption text-ink-tertiary">
                近一年共学习 <span className="font-semibold text-ink">{totalContributions}</span> 次
              </span>
            </div>
            <ContributionGraph data={contributions} />
          </Card>
        </div>

        {/* Right Column - Info Sidebar */}
        <div className="space-y-6">
          {/* Profile Tags */}
          {profile && (
            <Card className="p-5">
              <h4 className="text-small font-semibold text-ink mb-3">学习画像</h4>
              <div className="flex flex-wrap gap-2">
                {profile.learningPreference.map(pref => (
                  <Badge key={pref} variant="info">{pref}</Badge>
                ))}
                <Badge variant="purple">{profile.cognitiveStyle}</Badge>
              </div>
            </Card>
          )}

          {/* Recent Resources */}
          <Card className="p-5">
            <h4 className="text-small font-semibold text-ink mb-3">最近学习</h4>
            <div className="space-y-2">
              {recentResources.map(res => (
                <div key={res.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
                    <BookOpen className="w-3.5 h-3.5 text-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-small font-medium text-ink truncate">{res.title}</p>
                    <p className="text-caption text-ink-tertiary">{res.createdAt}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-disabled" />
                </div>
              ))}
            </div>
          </Card>

          {/* Weak Points */}
          {mastery.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-warning" />
                <h4 className="text-small font-semibold text-ink">待加强知识点</h4>
              </div>
              <div className="space-y-3">
                {mastery
                  .filter(m => m.score < 0.7)
                  .sort((a, b) => a.score - b.score)
                  .slice(0, 4)
                  .map(m => (
                    <div key={m.knowledgePointId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-small text-ink">{m.knowledgePointName}</span>
                        <span className={`text-caption font-medium ${m.score < 0.5 ? 'text-warning' : 'text-ink-tertiary'}`}>
                          {Math.round(m.score * 100)}%
                        </span>
                      </div>
                      <ProgressBar value={m.score * 100} color={m.score < 0.5 ? 'warning' : 'blue'} className="h-1.5" />
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card className={`p-5 ${color}`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-h1 text-ink">{value}</p>
      <p className="text-caption text-ink-tertiary">{label}</p>
    </Card>
  )
}

// Light Progress Ring Component
function LightProgressRing({ value, size = 100, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#3b82f6" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="#3b82f6" fontSize="24" fontWeight="700" fontFamily="DM Sans, sans-serif"
      >
        {value}%
      </text>
    </svg>
  )
}

// Contribution Graph Component
function ContributionGraph({ data }: { data: ContributionDay[] }) {
  const cellSize = 12
  const cellGap = 3
  const totalWeeks = 53
  const levelColors = [
    '#ebedf0', // 0 - 无学习
    '#9be9a8', // 1 - 少量
    '#40c463', // 2 - 中等
    '#30a14e', // 3 - 较多
    '#216e39', // 4 - 大量
  ]

  function getLevel(count: number): number {
    if (count === 0) return 0
    if (count <= 1) return 1
    if (count <= 2) return 2
    if (count <= 3) return 3
    return 4
  }

  // 按列（周）组织数据: 7行 x 53列
  const weeks: ContributionDay[][] = []
  for (let w = 0; w < totalWeeks; w++) {
    const week: ContributionDay[] = []
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d
      week.push(idx < data.length ? data[idx] : { date: '', count: 0 })
    }
    weeks.push(week)
  }

  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const svgWidth = totalWeeks * (cellSize + cellGap) + 40
  const svgHeight = 7 * (cellSize + cellGap) + 24

  // 计算月份标签位置
  const monthPositions: { label: string; x: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstDay = week[0]
    if (firstDay.date) {
      const month = new Date(firstDay.date).getMonth()
      if (month !== lastMonth) {
        monthPositions.push({ label: monthLabels[month], x: wi * (cellSize + cellGap) + 30 })
        lastMonth = month
      }
    }
  })

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="block">
        {/* Month labels */}
        {monthPositions.map((m, i) => (
          <text key={i} x={m.x} y={10} fontSize={11} fill="#9ca3af" fontFamily="DM Sans, sans-serif">
            {m.label}
          </text>
        ))}
        {/* Day cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const level = getLevel(day.count)
            const x = wi * (cellSize + cellGap) + 30
            const y = di * (cellSize + cellGap) + 18
            return (
              <rect
                key={`${wi}-${di}`}
                x={x} y={y}
                width={cellSize} height={cellSize}
                rx={2} ry={2}
                fill={levelColors[level]}
              >
                {day.date && (
                  <title>{`${day.date}: ${day.count} 次学习`}</title>
                )}
              </rect>
            )
          })
        )}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-caption text-ink-tertiary">
        <span>少</span>
        {levelColors.map((color, i) => (
          <svg key={i} width={cellSize} height={cellSize}><rect width={cellSize} height={cellSize} rx={2} fill={color} /></svg>
        ))}
        <span>多</span>
      </div>
    </div>
  )
}

// Task Item Row
function TaskItemRow({ task, icon, onToggle }: { task: Task; icon: React.ReactNode; onToggle: () => void }) {
  const completed = task.status === 'completed'
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors group">
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          completed ? 'bg-success border-success text-white' : 'border-ink-disabled hover:border-blue'
        }`}
      >
        {completed && <CheckCircle2 className="w-3 h-3" />}
      </button>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${completed ? 'bg-success/10 text-success' : 'bg-blue-light text-blue'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-body font-medium truncate ${completed ? 'text-ink-disabled line-through' : 'text-ink'}`}>
          {task.title}
        </p>
        <p className="text-caption text-ink-tertiary">{formatDurationShort(task.duration)}</p>
      </div>
    </div>
  )
}
