// 用户信息
export interface User {
  id: string;
  nickname: string;
  avatar: string;
  level: number;
  totalPractice: number;
  correctRate: number;
  studyDays: number;
}

// 知识节点
export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  masteryLevel: number; // 0-100
  totalQuestions: number;
  completedQuestions: number;
  prerequisites: string[]; // 前置节点 ID
  children: string[]; // 子节点 ID
}

// 知识图谱
export interface KnowledgeGraph {
  id: string;
  name: string;
  nodes: KnowledgeNode[];
  edges: GraphEdge[];
}

// 图谱边
export interface GraphEdge {
  source: string;
  target: string;
  type: 'prerequisite' | 'related';
}

// 题目
export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'judge' | 'fill';
  content: string;
  options?: QuestionOption[];
  answer: string | string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePointId: string;
  knowledgePointName: string;
}

// 题目选项
export interface QuestionOption {
  key: string;
  value: string;
}

// 练习记录
export interface PracticeRecord {
  id: string;
  userId: string;
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeCost: number; // 秒
  createdAt: string;
}

// 练习会话
export interface PracticeSession {
  id: string;
  userId: string;
  knowledgePointId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount: number;
  correctCount: number;
  startTime: string;
  endTime?: string;
  questions: PracticeQuestion[];
}

// 练习题目（包含用户答案）
export interface PracticeQuestion {
  question: Question;
  userAnswer?: string | string[];
  isCorrect?: boolean;
  timeCost?: number;
}

// 错题
export interface WrongQuestion {
  id: string;
  userId: string;
  questionId: string;
  question: Question;
  wrongCount: number;
  lastWrongTime: string;
  isMastered: boolean;
}

// 学习统计
export interface StudyStats {
  totalPractice: number;
  correctRate: number;
  studyDays: number;
  totalStudyTime: number; // 分钟
  knowledgeMastery: KnowledgeMastery[];
  weeklyPractice: WeeklyPractice[];
}

// 知识掌握度
export interface KnowledgeMastery {
  category: string;
  mastery: number;
}

// 每周练习
export interface WeeklyPractice {
  date: string;
  count: number;
  correctCount: number;
}

// AI 对话消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// API 响应
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 练习配置
export interface PracticeConfig {
  knowledgePointId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionTypes: QuestionType[];
}

// 题目类型
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill';

// 图表数据
export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}
