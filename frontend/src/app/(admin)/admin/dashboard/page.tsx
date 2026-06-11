import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, GraduationCap, Server, ShieldCheck, UsersRound } from 'lucide-react'
import { Bar, PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

const modules = [
  { name: '用户中心', status: '正常', value: '99.98%', tone: 'green' as const },
  { name: '资源生成', status: '排队 12', value: '86%', tone: 'blue' as const },
  { name: '学习画像', status: '正常', value: '94%', tone: 'green' as const },
  { name: '知识库索引', status: '需同步', value: '72%', tone: 'orange' as const },
]

const tenants = [
  { name: 'Python 基础训练营', students: 428, teachers: 12, health: 96 },
  { name: 'AI 应用开发营', students: 216, teachers: 8, health: 91 },
  { name: '校园创新实验班', students: 132, teachers: 5, health: 88 },
]

const risks = [
  { label: '3 个班级资源生成失败率上升', type: '资源服务', tone: 'orange' as const },
  { label: '知识库索引距上次同步超过 6 小时', type: '数据同步', tone: 'red' as const },
  { label: '教师端登录失败次数异常', type: '账号安全', tone: 'orange' as const },
]

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHead
        eyebrow="平台管理 / 运行总览"
        title="管理工作台"
        description="统一查看平台租户、用户规模、关键服务与安全事件，面向管理员的日常巡检和权限治理。"
        actions={
          <Link
            href="/admin/audit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-white px-3.5 text-small font-bold text-blue ring-1 ring-[#bfdbfe] transition-colors hover:bg-blue-light"
          >
            查看运营日志
          </Link>
        }
        chips={[
          { value: '1,286', label: '注册用户', icon: <UsersRound className="h-4 w-4" />, tone: 'blue' },
          { value: '34', label: '教师账号', icon: <GraduationCap className="h-4 w-4" />, tone: 'green' },
          { value: '99.95%', label: '服务可用性', icon: <Server className="h-4 w-4" />, tone: 'cyan' },
          { value: '5', label: '待处理告警', icon: <AlertTriangle className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2">
          {[
            { label: '今日活跃用户', value: '742', sub: '较昨日 +8.4%', icon: <Activity className="h-5 w-5" />, tone: 'bg-[#eaf2ff] text-[#2563eb]' },
            { label: 'AI 任务吞吐', value: '3,418', sub: '资源/练习/报告', icon: <Cpu className="h-5 w-5" />, tone: 'bg-[#ecfdf5] text-[#059669]' },
            { label: '知识库文档', value: '9,620', sub: '已索引 92%', icon: <Database className="h-5 w-5" />, tone: 'bg-[#fff7ed] text-[#d97706]' },
            { label: '安全事件', value: '12', sub: '高优先级 2', icon: <ShieldCheck className="h-5 w-5" />, tone: 'bg-[#f3efff] text-[#7c3aed]' },
          ].map((item) => (
            <ProtoCard key={item.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${item.tone}`}>{item.icon}</div>
                <div>
                  <div className="text-xs font-semibold text-[#64748b]">{item.label}</div>
                  <div className="text-[22px] font-bold text-[#0f172a]">{item.value}</div>
                  <div className="text-xs text-[#94a3b8]">{item.sub}</div>
                </div>
              </div>
            </ProtoCard>
          ))}
        </div>

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-5 max-[1100px]:grid-cols-1">
          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">核心服务状态</h2>
              <Pill tone="green">在线巡检</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
              {modules.map((item) => (
                <SoftCard key={item.name} className="bg-white">
                  <div className="mb-3 flex items-center justify-between">
                    <b className="text-sm text-[#0f172a]">{item.name}</b>
                    <Pill tone={item.tone}>{item.status}</Pill>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[#64748b]">健康度</span>
                    <span className="font-bold text-[#111827]">{item.value}</span>
                  </div>
                  <Bar value={Number.parseInt(item.value, 10)} tone={item.tone} />
                </SoftCard>
              ))}
            </div>
          </ProtoCard>

          <ProtoCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0f172a]">待处理告警</h2>
              <ProtoButton href="/admin/audit" variant="tertiary">查看日志</ProtoButton>
            </div>
            <div className="space-y-2">
              {risks.map((risk) => (
                <SoftCard key={risk.label} className="grid grid-cols-[auto_1fr] items-start gap-3 bg-white">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <Pill tone={risk.tone}>{risk.type}</Pill>
                    <div className="mt-2 text-sm font-bold text-[#0f172a]">{risk.label}</div>
                  </div>
                </SoftCard>
              ))}
            </div>
          </ProtoCard>
        </div>

        <ProtoCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#0f172a]">租户与班级概览</h2>
            <ProtoButton href="/admin/users" variant="secondary">管理账号</ProtoButton>
          </div>
          <div className="overflow-hidden rounded-[10px] border border-[#eef2f7]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#f8fafc] text-left text-xs text-[#64748b]">
                <tr>
                  <th className="px-4 py-3 font-bold">租户/项目</th>
                  <th className="px-4 py-3 font-bold">学生数</th>
                  <th className="px-4 py-3 font-bold">教师数</th>
                  <th className="px-4 py-3 font-bold">运行健康度</th>
                  <th className="px-4 py-3 font-bold">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7] bg-white">
                {tenants.map((item) => (
                  <tr key={item.name}>
                    <td className="px-4 py-3 font-bold text-[#0f172a]">{item.name}</td>
                    <td className="px-4 py-3 text-[#52627b]">{item.students}</td>
                    <td className="px-4 py-3 text-[#52627b]">{item.teachers}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] items-center gap-3">
                        <div className="flex-1"><Bar value={item.health} /></div>
                        <span className="text-xs font-bold text-[#2563eb]">{item.health}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Pill tone="green"><CheckCircle2 className="h-3.5 w-3.5" />正常</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProtoCard>
      </div>
    </div>
  )
}
