import * as real from './real'

const impl = real

export const api = {
  getTodayTasks: impl.getTodayTasks,
  completeTask: impl.completeTask,

  getDashboardStats: impl.getDashboardStats,
  getRecentResources: impl.getRecentResources,
  getMasteryData: impl.getMasteryData,

  getProfile: impl.getProfile,

  getResources: impl.getResources,
  generateResource: impl.generateResource,

  sendMessage: impl.sendMessage,
  getChatHistory: impl.getChatHistory,

  getQuizQuestions: impl.getQuizQuestions,

  getReport: impl.getReport,

  getRecommendations: impl.getRecommendations,

  getLearningPath: impl.getLearningPath,

  getVideos: impl.getVideos,

  getDailyQuote: impl.getDailyQuote,

  getContributionData: impl.getContributionData,
}

export type { Task, Resource, StudentProfile, Message, QuizQuestion, DashboardStats, MasteryRecord, ReportData, Recommendation, LearningPath, PathNode, VideoInfo, ContributionDay } from './types'
