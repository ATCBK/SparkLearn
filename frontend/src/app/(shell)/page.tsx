'use client'

import { useEffect, useState } from 'react'
import { api, Task, Resource, DashboardStats, MasteryRecord, StudentProfile } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDateChinese, formatDurationShort } from '@/lib/utils/format'
import {
  Clock, CheckCircle2, Target, Flame, Play, BookOpen,
  PenTool, Code, ChevronRight, TrendingUp,
} from 'lucide-react'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentResources, setRecentResources] = useState<Resource[]>([])
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const [t, s, r, m, p] = await Promise.all([
        api.getTodayTasks(),
        api.getDashboardStats(),
        api.getRecentResources(),
        api.getMasteryData(),
        api.getProfile(),
      ])
      setTasks(t)
      setStats(s)
      setRecentResources(r)
      setMastery(m)
      setProfile(p)
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
      <Card variant="dark" className="p-8 animate-fade-in-up delay-1">
        <div className="flex items-center gap-8">
          <WarmProgressRing value={75} size={100} strokeWidth={8} />
          <div className="flex-1">
            <h2 className="text-h3 text-white mb-1">Python 程序设计</h2>
            <p className="text-body text-white/60 mb-4">当前学习路径</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success">基础语法</Badge>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <Badge variant="info">函数与模块</Badge>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <Badge>面向对象</Badge>
              <ChevronRight className="w-3 h-3 text-white/30" />
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

          {/* Recent Resources */}
          <Card className="p-6">
            <h3 className="text-h3 text-ink mb-4">最近学习</h3>
            <div className="space-y-2">
              {recentResources.map(res => (
                <div key={res.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-blue-light flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium text-ink truncate">{res.title}</p>
                    <p className="text-caption text-ink-tertiary">{res.createdAt}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-disabled" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column - Info Sidebar */}
        <div className="space-y-6">
          {/* Learning Stage */}
          <Card className="p-5">
            <h4 className="text-small font-semibold text-ink mb-3">学习阶段</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">函数与模块</Badge>
                <TrendingUp className="w-3 h-3 text-blue" />
              </div>
              <ProgressBar value={62} showLabel color="warm" />
            </div>
          </Card>

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

          {/* Knowledge Mastery */}
          <Card className="p-5">
            <h4 className="text-small font-semibold text-ink mb-3">知识掌握度</h4>
            <div className="space-y-3">
              {mastery.slice(0, 5).map(m => (
                <div key={m.knowledgePointId}>
                  <div className="flex justify-between text-caption mb-1">
                    <span className="text-ink-secondary">{m.knowledgePointName}</span>
                    <span className="text-ink-tertiary">{Math.round(m.score * 100)}%</span>
                  </div>
                  <ProgressBar
                    value={m.score * 100}
                    color={m.score > 0.7 ? 'success' : m.score > 0.5 ? 'warning' : 'danger'}
                  />
                </div>
              ))}
            </div>
          </Card>
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

// Warm Progress Ring Component
function WarmProgressRing({ value, size = 100, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#fff" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize="24" fontWeight="700" fontFamily="DM Sans, sans-serif"
      >
        {value}%
      </text>
    </svg>
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
