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
  optimizeRolePrompt: impl.optimizeRolePrompt,
  getTutorConversations: impl.getTutorConversations,
  createTutorConversation: impl.createTutorConversation,
  updateTutorConversation: impl.updateTutorConversation,
  deleteTutorConversation: impl.deleteTutorConversation,
  deleteTutorMessage: impl.deleteTutorMessage,
  uploadTutorFiles: impl.uploadTutorFiles,
  getTutorFiles: impl.getTutorFiles,
  deleteTutorFile: impl.deleteTutorFile,

  getQuizQuestions: impl.getQuizQuestions,
  submitQuizAnswer: impl.submitQuizAnswer,
  getWrongQuizItems: impl.getWrongQuizItems,
  deleteWrongQuizItem: impl.deleteWrongQuizItem,
  getQuizFavorites: impl.getQuizFavorites,
  setQuizFavorite: impl.setQuizFavorite,
  getQuizRecords: impl.getQuizRecords,
  getQuizRecordsStats: impl.getQuizRecordsStats,
  deleteQuizRecord: impl.deleteQuizRecord,

  getReport: impl.getReport,

  getRecommendations: impl.getRecommendations,

  getLearningPath: impl.getLearningPath,
  adjustLearningPath: impl.adjustLearningPath,
  getLearningPathNodeAdvice: impl.getLearningPathNodeAdvice,
  generatePathPlanning: impl.generatePathPlanning,
  getPathPlanningHistory: impl.getPathPlanningHistory,
  getPathNodeSuggestions: impl.getPathNodeSuggestions,

  getVideos: impl.getVideos,

  getDailyQuote: impl.getDailyQuote,

  getContributionData: impl.getContributionData,
  getForumPosts: impl.getForumPosts,
  createForumPost: impl.createForumPost,
  getForumPostDetail: impl.getForumPostDetail,
  deleteForumPost: impl.deleteForumPost,
  getForumComments: impl.getForumComments,
  createForumComment: impl.createForumComment,
  toggleForumLike: impl.toggleForumLike,
  toggleForumFavorite: impl.toggleForumFavorite,
  uploadForumAttachments: impl.uploadForumAttachments,
  getMyLikedPosts: impl.getMyLikedPosts,
  getMyForumHistory: impl.getMyForumHistory,
  getMyForumComments: impl.getMyForumComments,
  getTeacherRecipients: impl.getTeacherRecipients,
  uploadTeacherMaterials: impl.uploadTeacherMaterials,
  getTeacherMaterials: impl.getTeacherMaterials,
  createTeacherBroadcast: impl.createTeacherBroadcast,
  getTeacherBroadcasts: impl.getTeacherBroadcasts,

  deleteVideoResource: impl.deleteVideoResource,
  downloadVideoArtifact: impl.downloadVideoArtifact,
  polishVideoPrompt: impl.polishVideoPrompt,
  generateVideo: impl.generateVideo,

  getKnowledgeFiles: impl.getKnowledgeFiles,
  uploadKnowledgeFiles: impl.uploadKnowledgeFiles,
  indexKnowledgeFile: impl.indexKnowledgeFile,
  deleteKnowledgeFile: impl.deleteKnowledgeFile,
  getKnowledgeStats: impl.getKnowledgeStats,
  getKnowledgeChunks: impl.getKnowledgeChunks,

  // Agent Pet
  getAgentPet: impl.getAgentPet,
  adoptAgentPet: impl.adoptAgentPet,
  updateAgentPet: impl.updateAgentPet,
  createAgentTask: impl.createAgentTask,
  getAgentTask: impl.getAgentTask,
  getAgentTasks: impl.getAgentTasks,
  submitAgentFeedback: impl.submitAgentFeedback,
  bookmarkAgentResult: impl.bookmarkAgentResult,
  getAgentRecommendations: impl.getAgentRecommendations,

  // Voice TTS
  synthesizeSpeech: impl.synthesizeSpeech,
  getTtsStatus: impl.getTtsStatus,
}

export type {
  Task, TaskCreatePayload, Resource, StudentProfile, Message, QuizQuestion, DashboardStats, MasteryRecord,
  ReportData, Recommendation, LearningPath, PathNode, VideoInfo, ContributionDay,
  TutorRole, TutorConversation, TutorFile, PathNodeAdvice, PathAdjustResult, KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, WorkshopHubEvent, ProfileUpdatePayload, KnowledgeFile, KnowledgeStats,
  PathPlanningData, PathPlanningSuggestion, PathPlanningResource, PathNodeSuggestionsReq, PathNodeSuggestionsResp,
  ForumPost, ForumComment, ForumAttachment, TeacherRecipient, TeacherMaterialFile, TeacherBroadcast,
  AgentPet, AgentTask, AgentTaskList, AgentTaskStep, AgentSearchResult, AgentSummaryResult, AgentCompareResult,
  AdoptPetPayload, CreateAgentTaskPayload, BookmarkPayload,
} from './types'
