# 后端 API 清单（来自 backend/app/routes）

## 基础

- `GET /health`

## Profile

- 前缀: `/api/profile`
- 主要: `POST /onboarding`, `POST /initiate`, `POST /chat`, `GET /`, `PUT /`

## Learning / Path / Task

- 前缀: `/api`
- 主要:
  - `GET /learning-path`
  - `POST /learning-path/node-advice`
  - `POST /learning-path/adjust`
  - `GET /tasks/today`
  - `POST /tasks`
  - `PUT /tasks/{task_id}/complete`
  - `DELETE /tasks/{task_id}`
  - `GET /contribution`
  - `GET /mastery`
  - `GET /dashboard/stats`
  - `GET /daily-quote`
  - `GET /videos`

## Path Planning

- 前缀: `/api`
- 主要:
  - `POST /path-planning/generate`
  - `GET /path-planning/history`
  - `POST /path-planning/node-suggestions`
  - `GET /path-planning/{path_id}`

## Resources

- 前缀: `/api/resources`
- 主要:
  - `GET /`
  - `POST /generate`
  - `GET /{resource_id}`
  - `GET /{resource_id}/preview`
  - `GET /{resource_id}/download`
  - `DELETE /{resource_id}`
  - `GET /recommendations/list`

## Quiz

- 前缀: `/api/quiz`
- 主要:
  - `GET /`
  - `POST /submit`
  - `GET /records`
  - `GET /records/stats`
  - `DELETE /records/{quiz_id}`
  - `GET /wrong`
  - `DELETE /wrong/{quiz_id}`
  - `GET /favorites`
  - `POST /favorites`

## Knowledge

- 前缀: `/api/knowledge`
- 主要:
  - `GET /files`
  - `POST /files`
  - `GET /files/{file_id}`
  - `DELETE /files/{file_id}`
  - `PUT /files/{file_id}/index`
  - `GET /stats`
  - `GET /chunks`

## Video

- 前缀: `/api/video`
- 主要:
  - `POST /polish`
  - `POST /jobs`
  - `GET /jobs/{job_id}/events`
  - `GET /resources`
  - `GET /resources/{resource_id}`
  - `GET /resources/{resource_id}/timeline`
  - `DELETE /resources/{resource_id}`
  - `GET /resources/{resource_id}/download/mp4`
  - `POST /resources/{resource_id}/share`

## PPT

- 前缀: `/api/ppt`
- 主要: `POST /generate-schema`

## Agent

- 前缀: `/api/agent`
- 主要:
  - `POST /pet`, `GET /pet`, `PATCH /pet`
  - `POST /task`, `GET /task/{task_id}`, `GET /tasks`
  - `POST /task/{task_id}/feedback`
  - `POST /bookmark`
  - `GET /recommendations`

## Teacher

- 前缀: `/api/teacher`
- 主要:
  - `GET /dashboard`
  - `GET /students`
  - `GET /students/{student_id}`
  - `POST /ai/diagnose`
  - `POST /ai/daily-report`

## Tutor Evaluation + Voice/Admin

- 前缀: `/api`
- 主要:
  - Tutor: `/tutor/roles`, `/tutor/conversations`, `/tutor/files`, `/tutor/chat`, `/tutor/history`
  - Eval: `/evaluation/report`, `/evaluation/refresh`, `/report/ai-summary`
  - Voice/Admin: `/voice/asr`, `/voice/tts`, `/voice/tts/status`, `/admin/students`, `/admin/resources`, `/admin/dashboard`
