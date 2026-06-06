import Taro from '@tarojs/taro';
import { ApiResponse } from '@/types';

const BASE_URL = 'http://localhost:8000/api';

const request = async <T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  header?: Record<string, string>
): Promise<ApiResponse<T>> => {
  try {
    const token = Taro.getStorageSync('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...header
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      timeout: 30000
    });

    if (response.statusCode === 200) {
      return response.data as ApiResponse<T>;
    } else if (response.statusCode === 401) {
      Taro.removeStorageSync('token');
      Taro.removeStorageSync('user');
      Taro.navigateTo({ url: '/pages/home/index' });
      throw new Error('登录已过期，请重新登录');
    } else {
      throw new Error(response.data?.message || '请求失败');
    }
  } catch (error) {
    console.error('API 请求错误:', error);
    throw error;
  }
};

export const api = {
  // 用户相关
  login: (code: string) => request<any>('/user/login', 'POST', { code }),
  getUserInfo: () => request<any>('/user/info'),
  updateUserInfo: (data: any) => request<any>('/user/info', 'PUT', data),

  // 知识图谱相关
  getKnowledgeGraph: () => request<any>('/graph/data'),
  getKnowledgeNode: (id: string) => request<any>(`/graph/node/${id}`),
  updateMastery: (nodeId: string, mastery: number) =>
    request<any>('/graph/node', 'POST', { nodeId, mastery }),

  // 练习相关
  getQuestions: (params: {
    knowledgePointId?: string;
    difficulty?: string;
    count?: number;
    types?: string[];
  }) => {
    const { count = 10, difficulty, knowledgePointId } = params;
    let url = `/quiz?count=${count}`;
    if (knowledgePointId) url += `&chapter=${knowledgePointId}`;
    return request<any>(url);
  },

  submitAnswer: (data: {
    questionId: string;
    answer: string | string[];
    timeCost: number;
  }) => request<any>('/quiz/submit', 'POST', {
    quiz_id: data.questionId,
    answer: data.answer
  }),

  getPracticeHistory: (page?: number, pageSize?: number) =>
    request<any>('/quiz/records', 'GET'),

  // 错题相关
  getWrongQuestions: (page?: number, pageSize?: number) =>
    request<any>('/quiz/wrong', 'GET'),

  markWrongQuestionMastered: (id: string) =>
    request<any>(`/quiz/wrong/${id}`, 'DELETE'),

  deleteWrongQuestion: (id: string) =>
    request<any>(`/quiz/wrong/${id}`, 'DELETE'),

  // 统计相关
  getStudyStats: () => request<any>('/dashboard/stats'),
  getWeeklyStats: () => request<any>('/dashboard/stats'),

  // AI 对话相关
  sendMessage: (message: string, sessionId?: string) =>
    request<any>('/profile/chat', 'POST', {
      session_id: sessionId || 'default_session',
      message
    }),

  getChatHistory: (page?: number) =>
    request<any>('/profile/history', 'GET'),

  // 题目详情
  getQuestionDetail: (id: string) =>
    request<any>(`/questions/${id}`),

  // 生成题目
  generateQuestions: (params: {
    knowledgePointId: string;
    difficulty?: string;
    count?: number;
  }) => request<any>('/questions/generate', 'POST', params)
};

export default api;
