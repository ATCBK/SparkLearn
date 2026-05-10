import * as real from './real'

const impl = real

export const api = {
  getTodayTasks: impl.getTodayTasks,
  createTask: impl.createTask,
  completeTask: impl.completeTask,
  updateTaskStatus: impl.updateTaskStatus,
  deleteTask: impl.deleteTask,

  getDashboardStats: impl.getDashboardStats,
  getRecentResources: impl.getRecentResources,
  getMasteryData: impl.getMasteryData,

  getProfile: impl.getProfile,
  updateProfile: impl.updateProfile,

  getResources: impl.getResources,
  deleteResource: impl.deleteResource,
  getResourcePreview: impl.getResourcePreview,
  downloadResource: impl.downloadResource,
  downloadResourceSource: impl.downloadResourceSource,
  generateResource: impl.generateResource,

  sendMessage: impl.sendMessage,
  getChatHistory: impl.getChatHistory,
  getTutorRoles: impl.getTutorRoles,
  createTutorRole: impl.createTutorRole,
  updateTutorRole: impl.updateTutorRole,
  deleteTutorRole: impl.deleteTutorRole,
  getTutorConversations: impl.getTutorConversations,
  createTutorConversation: impl.createTutorConversation,
  updateTutorConversation: impl.updateTutorConversation,
  deleteTutorConversation: impl.deleteTutorConversation,
  deleteTutorMessage: impl.deleteTutorMessage,
  uploadTutorFiles: impl.uploadTutorFiles,

  getQuizQuestions: impl.getQuizQuestions,
  submitQuizAnswer: impl.submitQuizAnswer,
  getWrongQuizItems: impl.getWrongQuizItems,
  deleteWrongQuizItem: impl.deleteWrongQuizItem,
  getQuizFavorites: impl.getQuizFavorites,
  setQuizFavorite: impl.setQuizFavorite,

  getReport: impl.getReport,

  getRecommendations: impl.getRecommendations,

  getLearningPath: impl.getLearningPath,
  adjustLearningPath: impl.adjustLearningPath,
  getLearningPathNodeAdvice: impl.getLearningPathNodeAdvice,

  getVideos: impl.getVideos,

  getDailyQuote: impl.getDailyQuote,

  getContributionData: impl.getContributionData,

  getKnowledgeFiles: impl.getKnowledgeFiles,
  uploadKnowledgeFiles: impl.uploadKnowledgeFiles,
  indexKnowledgeFile: impl.indexKnowledgeFile,
  deleteKnowledgeFile: impl.deleteKnowledgeFile,
  getKnowledgeStats: impl.getKnowledgeStats,
  getKnowledgeChunks: impl.getKnowledgeChunks,
}

export type {
  Task, TaskCreatePayload, Resource, StudentProfile, Message, QuizQuestion, DashboardStats, MasteryRecord,
  ReportData, Recommendation, LearningPath, PathNode, VideoInfo, ContributionDay,
  TutorRole, TutorConversation, TutorFile, PathNodeAdvice, PathAdjustResult, KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, WorkshopHubEvent, ProfileUpdatePayload, KnowledgeFile, KnowledgeStats,
} from './types'
