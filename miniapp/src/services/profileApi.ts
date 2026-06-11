import { request, API_BASE_URL } from './apiClient'
import type { DashboardStats, LearningProfile, MasteryItem } from '../types/profile'

export function getProfile() {
  return request<LearningProfile>({ url: '/api/profile' })
}

export function getMastery() {
  return request<MasteryItem[]>({ url: '/api/mastery' })
}

export function getDashboardStats() {
  return request<DashboardStats>({ url: '/api/dashboard/stats' })
}

export function getContribution() {
  return request<any>({ url: '/api/contribution' })
}

export function getApiBaseUrl() {
  return API_BASE_URL
}
