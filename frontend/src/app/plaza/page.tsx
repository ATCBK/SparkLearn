import Link from 'next/link'
import { BookOpen, HelpCircle, Trophy, Users } from 'lucide-react'

const MODULES = [
  { href: '/plaza/resource-share', title: '资料共享', desc: '分享课件、笔记、模板、资料包', icon: BookOpen },
  { href: '/plaza/qa', title: '学习答疑', desc: '提问与解答，聚焦具体学习问题', icon: HelpCircle },
  { href: '/plaza/team-study', title: '组队共学', desc: '寻找同伴打卡、组队推进目标', icon: Users },
  { href: '/plaza/experience-share', title: '经验共享', desc: '复盘方法、踩坑总结、成长经验', icon: Trophy },
]

export default function PlazaHomePage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-6">
        <h1 className="text-3xl font-extrabold text-ink">学习广场</h1>
        <p className="mt-2 text-sm text-muted">选择一个独立子模块进入，模块之间互不混用。</p>
      </section>
      <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {MODULES.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.href} href={m.href} className="rounded-xl border border-line bg-white p-5 transition hover:border-blue">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-blue-light text-blue">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-extrabold text-ink">{m.title}</h2>
              <p className="mt-1 text-sm text-muted">{m.desc}</p>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
