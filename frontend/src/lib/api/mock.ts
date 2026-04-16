import type {
  Task, Resource, StudentProfile, Message, QuizQuestion,
  DashboardStats, MasteryRecord, ReportData, Recommendation,
  LearningPath, VideoInfo,
} from './types'

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ---- Tasks ----

export async function getTodayTasks(): Promise<Task[]> {
  await delay(300)
  return [
    { id: '1', title: 'Python 变量与数据类型', type: 'video', status: 'pending', duration: 25 },
    { id: '2', title: '函数定义与调用练习', type: 'quiz', status: 'in_progress', duration: 15 },
    { id: '3', title: '条件语句与循环讲义', type: 'reading', status: 'pending', duration: 20 },
    { id: '4', title: '列表推导式代码实践', type: 'practice', status: 'completed', duration: 30 },
  ]
}

export async function completeTask(_taskId: string): Promise<void> {
  await delay(200)
}

// ---- Dashboard ----

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay(200)
  return {
    totalHours: 12.5,
    taskCompletionRate: 0.78,
    quizAccuracy: 0.85,
    streakDays: 12,
  }
}

export async function getRecentResources(): Promise<Resource[]> {
  await delay(300)
  return [
    { id: 'r1', title: '变量与数据类型详解', type: 'document', status: 'completed', createdAt: '2026-04-15' },
    { id: 'r2', title: 'Python 函数基础 PPT', type: 'ppt', status: 'completed', createdAt: '2026-04-14', docmeeId: 'demo-1' },
    { id: 'r3', title: '条件逻辑思维导图', type: 'mindmap', status: 'completed', createdAt: '2026-04-13' },
  ]
}

export async function getMasteryData(): Promise<MasteryRecord[]> {
  await delay(300)
  return [
    { knowledgePointId: '1.1', knowledgePointName: '变量定义', score: 0.9, chapter: '基础语法' },
    { knowledgePointId: '1.2', knowledgePointName: '数据类型', score: 0.85, chapter: '基础语法' },
    { knowledgePointId: '2.1', knowledgePointName: '条件语句', score: 0.75, chapter: '控制流' },
    { knowledgePointId: '2.2', knowledgePointName: '循环', score: 0.7, chapter: '控制流' },
    { knowledgePointId: '3.1', knowledgePointName: '函数定义', score: 0.62, chapter: '函数' },
    { knowledgePointId: '3.2', knowledgePointName: '参数传递', score: 0.55, chapter: '函数' },
    { knowledgePointId: '3.3', knowledgePointName: '闭包', score: 0.45, chapter: '函数' },
    { knowledgePointId: '4.1', knowledgePointName: '类与对象', score: 0.3, chapter: '面向对象' },
  ]
}

// ---- Profile ----

export async function getProfile(): Promise<StudentProfile> {
  await delay(200)
  return {
    id: 'u1',
    name: '张同学',
    major: '计算机科学',
    grade: '大二',
    goals: ['期末提分', '竞赛准备'],
    knowledgeLevel: '有一定基础',
    weakPoints: ['函数', '面向对象'],
    learningPreference: ['视觉型', '实践型'],
    cognitiveStyle: '归纳型',
    dailyTime: 60,
    practicalAbility: '能独立完成小项目',
  }
}

// ---- Resources ----

export async function getResources(): Promise<Resource[]> {
  await delay(300)
  return [
    { id: 'r1', title: '变量与数据类型详解', type: 'document', status: 'completed', createdAt: '2026-04-15', content: '# 变量与数据类型\n\nPython 中的变量不需要声明类型...' },
    { id: 'r2', title: 'Python 函数基础 PPT', type: 'ppt', status: 'completed', createdAt: '2026-04-14', docmeeId: 'demo-1' },
    { id: 'r3', title: '条件逻辑思维导图', type: 'mindmap', status: 'completed', createdAt: '2026-04-13', content: '# 条件逻辑\n- if 语句\n  - 单分支\n  - 双分支\n  - 多分支\n- 三元表达式\n- match 语句' },
    { id: 'r4', title: '函数练习题集', type: 'quiz', status: 'completed', createdAt: '2026-04-12' },
    { id: 'r5', title: 'Python 标准库拓展阅读', type: 'reading', status: 'completed', createdAt: '2026-04-11', content: '# Python 标准库\n\nPython 拥有丰富的标准库...' },
    { id: 'r6', title: '装饰器代码案例', type: 'code', status: 'completed', createdAt: '2026-04-10', content: '```python\ndef timer(func):\n    def wrapper(*args, **kwargs):\n        import time\n        start = time.time()\n        result = func(*args, **kwargs)\n        print(f"{func.__name__} took {time.time()-start:.2f}s")\n        return result\n    return wrapper\n```' },
  ]
}

export async function generateResource(type: Resource['type'], prompt: string): Promise<Resource> {
  await delay(200)
  return {
    id: `gen-${Date.now()}`,
    title: prompt.slice(0, 20) || '新生成资源',
    type,
    status: 'generating',
    createdAt: new Date().toISOString(),
    progress: 0,
  }
}

// ---- Tutor / Chat ----

export async function sendMessage(content: string): Promise<Message> {
  await delay(500)
  return {
    id: `m-${Date.now()}`,
    role: 'assistant',
    content: `关于"${content}"，这是一个很好的问题。让我来为你详细解答...`,
    timestamp: new Date().toISOString(),
  }
}

export async function getChatHistory(): Promise<Message[]> {
  await delay(300)
  return [
    { id: 'm1', role: 'assistant', content: '你好！我是你的 AI 学习助手。有什么 Python 问题我可以帮你解答？', timestamp: '2026-04-16T10:00:00Z' },
    { id: 'm2', role: 'user', content: '什么是闭包？', timestamp: '2026-04-16T10:01:00Z' },
    { id: 'm3', role: 'assistant', content: '闭包（Closure）是指一个函数能够记住并访问它被创建时的词法作用域，即使函数在其作用域之外被调用。\n\n```python\ndef outer(x):\n    def inner(y):\n        return x + y\n    return inner\n\nadd_5 = outer(5)\nprint(add_5(3))  # 输出: 8\n```\n\n在这个例子中，`inner` 函数"捕获"了变量 `x`，即使 `outer` 已经执行完毕。', timestamp: '2026-04-16T10:01:30Z' },
  ]
}

// ---- Quiz ----

export async function getQuizQuestions(_chapter: string): Promise<QuizQuestion[]> {
  await delay(300)
  return [
    {
      id: 'q1',
      type: 'single',
      content: '以下哪个是 Python 的可变数据类型？',
      options: ['tuple', 'list', 'string', 'int'],
      correctAnswer: 'list',
      explanation: 'list 是可变类型，可以修改其元素。tuple、string 和 int 都是不可变类型。',
    },
    {
      id: 'q2',
      type: 'single',
      content: 'Python 中用于定义函数的关键字是？',
      options: ['function', 'def', 'func', 'define'],
      correctAnswer: 'def',
      explanation: 'Python 使用 def 关键字来定义函数。',
    },
    {
      id: 'q3',
      type: 'multiple',
      content: '以下哪些是 Python 的内置数据类型？（多选）',
      options: ['list', 'dict', 'array', 'set'],
      correctAnswer: ['list', 'dict', 'set'],
      explanation: 'list、dict、set 都是 Python 内置数据类型。array 需要导入 array 模块。',
    },
    {
      id: 'q4',
      type: 'fill_blank',
      content: '在 Python 中，使用 ______ 关键字来导入模块。',
      correctAnswer: 'import',
      explanation: 'Python 使用 import 关键字来导入模块。',
    },
  ]
}

// ---- Report ----

export async function getReport(): Promise<ReportData> {
  await delay(300)
  return {
    period: '本周',
    stats: { totalHours: 12.5, taskCompletionRate: 0.78, quizAccuracy: 0.85, streakDays: 12 },
    dailyHours: [
      { date: '04-10', hours: 2.0 },
      { date: '04-11', hours: 1.5 },
      { date: '04-12', hours: 2.5 },
      { date: '04-13', hours: 1.0 },
      { date: '04-14', hours: 2.0 },
      { date: '04-15', hours: 1.5 },
      { date: '04-16', hours: 2.0 },
    ],
    timeDistribution: [
      { category: '视频学习', minutes: 120 },
      { category: '练习题', minutes: 90 },
      { category: '阅读讲义', minutes: 60 },
      { category: '代码实践', minutes: 80 },
    ],
    weakPoints: [
      { name: '闭包', score: 0.45 },
      { name: '装饰器', score: 0.38 },
      { name: '类与继承', score: 0.3 },
    ],
    aiSummary: '本周你在基础语法上进步明显，变量和数据类型的掌握度达到了 90%。但函数章节的练习正确率较低，建议重点复习闭包和装饰器的概念。下一阶段可以开始接触面向对象编程的基础知识。',
  }
}

// ---- Recommendations ----

export async function getRecommendations(): Promise<Recommendation[]> {
  await delay(300)
  const resources = await getResources()
  return [
    { id: 'rec1', resource: resources[0], reason: '因为你函数章节掌握度较低', category: 'remedial' },
    { id: 'rec2', resource: resources[1], reason: '基于你当前学习路径的下一步', category: 'stage' },
    { id: 'rec3', resource: resources[2], reason: '为你今天的复习准备的推荐', category: 'today' },
  ]
}

// ---- Learning Path ----

export async function getLearningPath(): Promise<LearningPath> {
  await delay(300)
  return {
    currentStage: '函数与模块',
    stages: [
      { name: '基础语法', status: 'completed' },
      { name: '函数与模块', status: 'current' },
      { name: '面向对象', status: 'pending' },
      { name: '文件处理', status: 'pending' },
      { name: '高级特性', status: 'pending' },
    ],
    knowledgeTree: [
      {
        id: 'ch1', name: '基础语法', status: 'completed',
        children: [
          { id: '1.1', name: '变量', status: 'completed' },
          { id: '1.2', name: '数据类型', status: 'completed' },
          { id: '1.3', name: '控制流', status: 'completed' },
        ],
      },
      {
        id: 'ch2', name: '函数', status: 'current',
        children: [
          { id: '2.1', name: '定义与调用', status: 'completed' },
          { id: '2.2', name: '参数传递', status: 'current' },
          { id: '2.3', name: '闭包', status: 'pending' },
          { id: '2.4', name: '装饰器', status: 'pending' },
        ],
      },
      {
        id: 'ch3', name: '面向对象', status: 'pending',
        children: [
          { id: '3.1', name: '类与对象', status: 'pending' },
          { id: '3.2', name: '继承', status: 'pending' },
          { id: '3.3', name: '多态', status: 'pending' },
        ],
      },
    ],
  }
}

// ---- Video ----

export async function getVideos(): Promise<VideoInfo[]> {
  await delay(300)
  return [
    { id: 'v1', title: 'Python 变量与数据类型', url: '/demo-video.mp4', duration: 750, createdAt: '2026-04-15' },
    { id: 'v2', title: '函数定义与调用详解', url: '/demo-video.mp4', duration: 920, createdAt: '2026-04-14' },
  ]
}

// ---- Quote ----

export async function getDailyQuote(): Promise<string> {
  await delay(100)
  const quotes = [
    '学而不思则罔，思而不学则殆。',
    '知之者不如好之者，好之者不如乐之者。',
    '千里之行，始于足下。',
    '工欲善其事，必先利其器。',
    '不积跬步，无以至千里。',
  ]
  return quotes[Math.floor(Math.random() * quotes.length)]
}
