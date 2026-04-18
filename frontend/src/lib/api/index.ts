// API 层入口 - USE_MOCK 全局开关
// 切换 Mock/Real 时只改这一个值

import * as mock from './mock'

// 当切换到 Real 时，取消注释下面的 import 并替换对应的方法
// import * as real from './real'

export const api = {
  // Tasks
  getTodayTasks: mock.getTodayTasks,
  completeTask: mock.completeTask,

  // Dashboard
  getDashboardStats: mock.getDashboardStats,
  getRecentResources: mock.getRecentResources,
  getMasteryData: mock.getMasteryData,

  // Profile
  getProfile: mock.getProfile,

  // Resources
  getResources: mock.getResources,
  generateResource: mock.generateResource,

  // Tutor / Chat
  sendMessage: mock.sendMessage,
  getChatHistory: mock.getChatHistory,

  // Quiz
  getQuizQuestions: mock.getQuizQuestions,

  // Report
  getReport: mock.getReport,

  // Recommendations
  getRecommendations: mock.getRecommendations,

  // Learning Path
  getLearningPath: mock.getLearningPath,

  // Video
  getVideos: mock.getVideos,

  // Misc
  getDailyQuote: mock.getDailyQuote,

  // Contribution Graph
  getContributionData: mock.getContributionData,
}

export type { Task, Resource, StudentProfile, Message, QuizQuestion, DashboardStats, MasteryRecord, ReportData, Recommendation, LearningPath, PathNode, VideoInfo, ContributionDay } from './types'
