import { userScopedStorageKey } from './auth'

export type LearningSkill = {
  id: string
  title: string
  shortTitle: string
  category: string
  summary: string
  prompt: string
  output: string
  examples: string[]
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'red'
}

export const SKILL_STORAGE_KEY = 'sparklearn_selected_skill'
export const CUSTOM_SKILLS_STORAGE_KEY = 'sparklearn_custom_skills'

export function selectedSkillStorageKey(userId?: string): string {
  return userScopedStorageKey(SKILL_STORAGE_KEY, userId)
}

export function customSkillsStorageKey(userId?: string): string {
  return userScopedStorageKey(CUSTOM_SKILLS_STORAGE_KEY, userId)
}

export const LEARNING_SKILLS: LearningSkill[] = [
  {
    id: 'concept-explain',
    title: '知识点讲解技能',
    shortTitle: '知识点讲解',
    category: '理解',
    summary: '把复杂概念拆成定义、例子、易错点和练习建议。',
    prompt: '请用知识点讲解模式回答：先给出准确概念，再用生活化例子解释，最后列出常见误区和一个巩固练习。',
    output: '概念定义 / 例子 / 易错点 / 巩固练习',
    examples: ['解释闭包是什么', '讲讲二次函数顶点式'],
    tone: 'blue',
  },
  {
    id: 'mistake-analysis',
    title: '错题分析技能',
    shortTitle: '错题分析',
    category: '诊断',
    summary: '定位错因、知识漏洞和补救动作，适合错题本与练习页。',
    prompt: '请用错题分析模式回答：判断错误类型，指出对应知识点，给出纠错步骤和一道同类变式题。',
    output: '错因定位 / 知识漏洞 / 纠错步骤 / 变式题',
    examples: ['分析这道错题', '为什么这个选项不对'],
    tone: 'red',
  },
  {
    id: 'study-plan',
    title: '学习计划生成技能',
    shortTitle: '学习计划',
    category: '规划',
    summary: '按目标、时间和薄弱点生成可执行的阶段学习安排。',
    prompt: '请用学习计划生成模式回答：根据目标、可用时间和薄弱点，安排分阶段任务、每日动作和验收标准。',
    output: '阶段目标 / 每日任务 / 资源建议 / 验收标准',
    examples: ['给我做一周复习计划', '每天 30 分钟怎么学'],
    tone: 'green',
  },
  {
    id: 'material-organize',
    title: '资料整理技能',
    shortTitle: '资料整理',
    category: '整理',
    summary: '把零散资料归类成目录、重点摘要和可生成资源的素材包。',
    prompt: '请用资料整理模式回答：先归类资料，再提炼重点，最后给出适合生成讲义、测验或思维导图的素材建议。',
    output: '资料分类 / 重点摘要 / 缺口 / 资源生成建议',
    examples: ['整理这份笔记', '哪些资料适合做成课件'],
    tone: 'cyan',
  },
  {
    id: 'mindmap',
    title: '思维导图生成技能',
    shortTitle: '思维导图',
    category: '结构',
    summary: '把主题拆成中心节点、一级分支和关键关联，方便形成知识网络。',
    prompt: '请用思维导图生成模式回答：输出中心主题、一级分支、二级要点和关键关联，结构要清晰可转成导图。',
    output: '中心主题 / 一级分支 / 二级要点 / 关联线索',
    examples: ['生成函数章节思维导图', '把这段内容整理成导图'],
    tone: 'purple',
  },
  {
    id: 'course-summary',
    title: '课程总结技能',
    shortTitle: '课程总结',
    category: '复盘',
    summary: '提炼课程重点、难点、课堂结论和课后行动。',
    prompt: '请用课程总结模式回答：总结本节课的关键结论、重点知识、难点提醒和课后复盘清单。',
    output: '课程重点 / 难点提醒 / 关键结论 / 课后清单',
    examples: ['总结今天这节课', '把这段课程内容变成复盘'],
    tone: 'orange',
  },
  {
    id: 'exam-review',
    title: '考试复习技能',
    shortTitle: '考试复习',
    category: '冲刺',
    summary: '围绕考试范围生成高频考点、复习顺序和刷题策略。',
    prompt: '请用考试复习模式回答：提炼高频考点，安排复习优先级，给出刷题策略和临考检查清单。',
    output: '高频考点 / 复习顺序 / 刷题策略 / 临考清单',
    examples: ['期末前怎么复习', '帮我做考试冲刺清单'],
    tone: 'blue',
  },
  {
    id: 'project-coach',
    title: '项目实践指导技能',
    shortTitle: '项目指导',
    category: '实践',
    summary: '把项目目标拆成任务、技术路线、里程碑和风险检查点。',
    prompt: '请用项目实践指导模式回答：明确项目目标，拆解任务，给出技术路线、里程碑和风险检查。',
    output: '目标拆解 / 技术路线 / 里程碑 / 风险检查',
    examples: ['指导我完成课程项目', '这个项目怎么分阶段做'],
    tone: 'green',
  },
]

export function getSkillById(id?: string | null, skills: LearningSkill[] = LEARNING_SKILLS) {
  return skills.find((skill) => skill.id === id) || null
}

export function readCustomSkills(): LearningSkill[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(customSkillsStorageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLearningSkill)
  } catch {
    return []
  }
}

export function writeCustomSkills(skills: LearningSkill[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(customSkillsStorageKey(), JSON.stringify(skills))
  window.dispatchEvent(new Event('sparklearn-custom-skills-updated'))
}

export function addCustomSkill(skill: LearningSkill) {
  const skills = readCustomSkills()
  const next = [skill, ...skills.filter((item) => item.id !== skill.id)]
  writeCustomSkills(next)
  return next
}

export function markdownToSkill(markdown: string, filename: string): LearningSkill {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim())
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim()
  const fallbackName = filename.replace(/\.md$/i, '').trim() || '自定义技能'
  const title = normalizeSkillTitle(heading || fallbackName)
  const bodyLine = lines.find((line) => line && !line.startsWith('#') && !line.startsWith('---')) || '根据导入的 Markdown 技能说明提供学习支持。'
  const now = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id: `custom-${now}-${slugify(fallbackName).slice(0, 24)}`,
    title,
    shortTitle: title.replace(/技能$/, '').slice(0, 12),
    category: '自定义',
    summary: bodyLine.slice(0, 72),
    prompt: `请严格按照以下自定义技能说明来辅助用户学习：\n\n${markdown.trim()}`,
    output: '按导入技能说明输出',
    examples: [],
    tone: 'blue',
  }
}

function normalizeSkillTitle(title: string) {
  const clean = title.trim() || '自定义技能'
  return clean.endsWith('技能') ? clean : `${clean}技能`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'skill'
}

function isLearningSkill(value: unknown): value is LearningSkill {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LearningSkill>
  return Boolean(
    item.id &&
    item.title &&
    item.shortTitle &&
    item.summary &&
    item.prompt &&
    item.output &&
    item.tone,
  )
}
