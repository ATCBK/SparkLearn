export type ApiResponse<T> = {
  ok?: boolean
  data?: T
  error?: string
  message?: string
}

export type AppError = {
  message: string
  statusCode?: number
}
