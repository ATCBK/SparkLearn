# Tutor Context Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate short-term tutor context by `conversation_id`, keep long-term profile sharing intact, and stop mutating raw user messages with injected resource text.

**Architecture:** The backend remains the source of truth for conversation boundaries. `POST /api/tutor/chat` will create a new conversation when `conversation_id` is absent, and all short-term evidence will stay request-local or conversation-local. The frontend tutor page will stop pre-creating hidden conversations and will rely on the first backend response to establish the active conversation ID.

**Tech Stack:** FastAPI, Python, SQLite/PostgreSQL helpers, Next.js App Router, TypeScript, SSE streaming, pytest

---

### Task 1: Lock the backend contract with failing tests

**Files:**
- Modify: `backend/tests/test_api.py`
- Modify: `backend/tests/test_tutor_eval_mcp_args.py`
- Check: `backend/app/routes/tutor_eval.py`

- [ ] **Step 1: Add a regression test that missing `conversation_id` creates a fresh conversation per request**

```python
@pytest.mark.asyncio
async def test_tutor_chat_without_conversation_id_creates_new_conversation_each_time(client):
    first = await client.post("/api/tutor/chat", json={"message": "第一问", "mode": "knowledge_qa"})
    second = await client.post("/api/tutor/chat", json={"message": "第二问", "mode": "knowledge_qa"})

    assert first.status_code == 200
    assert second.status_code == 200

    first_text = first.text
    second_text = second.text
    assert '"type": "done"' in first_text
    assert '"type": "done"' in second_text

    first_conv = int(first_text.split('"conversation_id": ')[1].split(",")[0])
    second_conv = int(second_text.split('"conversation_id": ')[1].split(",")[0])
    assert first_conv != second_conv
```

- [ ] **Step 2: Add a regression test that raw user messages are stored without appended resource-library context**

```python
@pytest.mark.asyncio
async def test_tutor_chat_stores_raw_user_message_verbatim(client):
    created = await client.post("/api/tutor/conversations", json={"title": "原文校验"})
    conv_id = int(created.json()["data"]["id"])
    raw_message = "帮我查一下信阳明天的天气"

    resp = await client.post(
        "/api/tutor/chat",
        json={
            "message": raw_message,
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert resp.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    assert history.status_code == 200
    user_messages = [m for m in history.json()["data"] if m["role"] == "user"]
    assert user_messages[-1]["content"] == raw_message
    assert "用户已生成资源库上下文" not in user_messages[-1]["content"]
```

- [ ] **Step 3: Add a regression test that file IDs are not implicitly inherited when omitted on a later turn**

```python
@pytest.mark.asyncio
async def test_tutor_chat_does_not_reuse_previous_file_ids_when_request_omits_them(client):
    created = await client.post("/api/tutor/conversations", json={"title": "文件隔离"})
    conv_id = int(created.json()["data"]["id"])

    upload = await client.post(
        "/api/tutor/files",
        files=[("files", ("sample.txt", b"hello workspace", "text/plain"))],
    )
    file_id = int(upload.json()["data"][0]["id"])

    first = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第一问",
            "conversation_id": conv_id,
            "file_ids": [file_id],
            "mode": "knowledge_qa",
        },
    )
    second = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第二问",
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    data = history.json()["data"]
    user_messages = [m for m in data if m["role"] == "user"]
    assert "sample.txt" in user_messages[0]["file_names"]
    assert user_messages[1]["file_names"] == []
```

- [ ] **Step 4: Keep the existing MCP argument extraction regression test as the guardrail**

```python
def test_infer_mcp_tool_args_for_weather_ignores_appended_context():
    question = (
        '帮我查一下信阳天气 用户已生成资源库上下文（资源推荐或学习建议时优先引用 只引用下列真实存在的资源 不要编造资源）'
    )

    args = tutor_eval._infer_mcp_tool_args(question, "get_weather", "天气预报")

    assert args == {"city": "信阳"}
```

- [ ] **Step 5: Run the focused backend tests and confirm they fail before implementation**

Run:

```bash
pytest backend/tests/test_api.py -k "tutor_chat_without_conversation_id or stores_raw_user_message_verbatim or does_not_reuse_previous_file_ids" -v
pytest backend/tests/test_tutor_eval_mcp_args.py -v
```

Expected:

```text
FAIL backend/tests/test_api.py::test_tutor_chat_without_conversation_id_creates_new_conversation_each_time
FAIL backend/tests/test_api.py::test_tutor_chat_does_not_reuse_previous_file_ids_when_request_omits_them
PASS backend/tests/test_tutor_eval_mcp_args.py::test_infer_mcp_tool_args_for_weather_ignores_appended_context
```

- [ ] **Step 6: Commit the failing-test checkpoint**

```bash
git add backend/tests/test_api.py backend/tests/test_tutor_eval_mcp_args.py
git commit -m "test: add tutor context isolation regressions"
```

### Task 2: Fix backend conversation creation and short-term context boundaries

**Files:**
- Modify: `backend/app/routes/tutor_eval.py`
- Check: `backend/app/db.py`
- Check: `backend/app/db_sqlite.py`
- Check: `backend/app/db_postgresql.py`

- [ ] **Step 1: Add a helper that validates an existing conversation or creates a new one**

```python
def _ensure_requested_or_new_conversation(conversation_id: int | None, role_id: int | None) -> tuple[int, int, bool]:
    requested_role_id = role_id or _default_role_id()
    if conversation_id is not None:
        row = fetch_one(
            'SELECT id, role_id FROM tutor_conversations WHERE id = ? AND user_id = ?',
            (conversation_id, settings.single_user_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail='conversation not found')
        effective_role_id = int(row['role_id']) if row['role_id'] is not None else requested_role_id
        return int(row['id']), effective_role_id, False

    ts = now_iso()
    new_conv_id = _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (settings.single_user_id, requested_role_id, '新对话', ts, ts),
    )
    return int(new_conv_id), requested_role_id, True
```

- [ ] **Step 2: Replace default-conversation fallback in `tutor_chat` and emit the created conversation ID**

```python
@router.post('/tutor/chat')
async def tutor_chat(req: TutorReq):
    conversation_id, role_id, conversation_created = _ensure_requested_or_new_conversation(
        req.conversation_id,
        req.role_id,
    )
    role = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules FROM tutor_roles WHERE id = ? AND user_id = ?',
        (role_id, settings.single_user_id),
    )

    async def gen() -> AsyncGenerator[tuple[str, dict], None]:
        ...
        yield (
            'meta',
            {
                'mode': req.mode,
                'conversation_id': conversation_id,
                'role_id': role_id,
                'conversation_created': conversation_created,
                'user_message_id': user_msg_id,
            },
        )
```

- [ ] **Step 3: Remove implicit file ID inheritance so omitted `file_ids` means no file context**

```python
def _resolve_effective_file_ids(conversation_id: int, requested_file_ids: list[int]) -> list[int]:
    return [int(x) for x in (requested_file_ids or []) if int(x) > 0]
```

- [ ] **Step 4: Preserve raw user messages and move resource context out of user content**

```python
user_msg_id = _execute_returning_id(
    """
    INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, created_at)
    VALUES (?, ?, 'user', ?, ?, ?)
    """,
    (
        conversation_id,
        settings.single_user_id,
        req.message,
        json.dumps(effective_file_ids, ensure_ascii=False),
        now_iso(),
    ),
)

page_prompt = _build_page_context_prompt(req.page_context)
memory_prompt = build_injected_context(settings.single_user_id, req.message, top_k=8)
file_context, file_sources = await _retrieve_tutor_file_context(effective_file_ids, req.message)
merged_system_prompt = "\n\n".join(p for p in [role_prompt, page_prompt, memory_prompt] if p)
```

- [ ] **Step 5: Add short-term context diagnostics before the model call**

```python
context_debug = {
    'conversation_id': conversation_id,
    'conversation_created': conversation_created,
    'system_blocks': [name for name, value in [
        ('role_prompt', role_prompt),
        ('page_prompt', page_prompt),
        ('memory_prompt', memory_prompt),
        ('file_prompt', file_prompt),
        ('mcp_prompt', mcp_prompt),
    ] if value],
    'file_ids': effective_file_ids,
}
logger.info("tutor context debug: %s", context_debug)
```

- [ ] **Step 6: Run the focused backend tests and confirm they pass**

Run:

```bash
pytest backend/tests/test_api.py -k "tutor_chat_without_conversation_id or stores_raw_user_message_verbatim or does_not_reuse_previous_file_ids or tutor_stream_and_history" -v
pytest backend/tests/test_tutor_eval_mcp_args.py -v
```

Expected:

```text
PASS backend/tests/test_api.py::test_tutor_chat_without_conversation_id_creates_new_conversation_each_time
PASS backend/tests/test_api.py::test_tutor_chat_stores_raw_user_message_verbatim
PASS backend/tests/test_api.py::test_tutor_chat_does_not_reuse_previous_file_ids_when_request_omits_them
PASS backend/tests/test_tutor_eval_mcp_args.py::test_infer_mcp_tool_args_for_weather_ignores_appended_context
```

- [ ] **Step 7: Commit the backend fix**

```bash
git add backend/app/routes/tutor_eval.py backend/tests/test_api.py backend/tests/test_tutor_eval_mcp_args.py
git commit -m "fix: isolate tutor chat context by conversation"
```

### Task 3: Stop the frontend from pre-building a hidden mixed prompt

**Files:**
- Modify: `frontend/src/app/tutor/page.tsx`
- Check: `frontend/src/lib/api/real.ts`

- [ ] **Step 1: Remove eager conversation creation from `handleSend` and allow the backend to create the first conversation**

```tsx
async function handleSend(sendText?: string) {
  const textValue = (sendText ?? input).trim()
  if ((!textValue && pendingFiles.length === 0) || streaming) return

  const convId = currentConversationId ?? undefined
  const userInput = textValue || '（空文本）'
  const msgUid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const draftConversationId = convId ?? -Date.now()
  ...
}
```

- [ ] **Step 2: Stop concatenating notes, generated resources, and selected-skill text into `outboundInput`; send the raw user question only**

```tsx
const outboundInput = userInput

const savedMessage = await api.sendMessage(
  outboundInput,
  {
    conversationId: convId,
    roleId: currentRoleId || undefined,
    ...
    pageContext: {
      page: '/tutor',
      selected_skill: selectedSkill ? {
        id: selectedSkill.id,
        title: selectedSkill.title,
        category: selectedSkill.category,
        output: selectedSkill.output,
      } : null,
      student_profile: activeProfile ? { ... } : null,
      personalized_notes: matchedNotesForSend.map((item) => ({ ... })),
      generated_resources: resourcesContextForSend.map((item) => ({ ... })),
    },
  },
  ...
)
```

- [ ] **Step 3: On successful send, hydrate the real backend `conversationId` into message state and sidebar state**

```tsx
if (savedMessage.conversationId && savedMessage.conversationId !== currentConversationId) {
  setCurrentConversationId(savedMessage.conversationId)
  await refreshConversations(savedMessage.conversationId)
}

setMessages((prev) => prev.map((m) => (
  m.conversationId === draftConversationId
    ? { ...m, conversationId: savedMessage.conversationId }
    : m
)))
```

- [ ] **Step 4: Keep note/resource context in `pageContext`, not in user text**

```tsx
pageContext: {
  page: '/tutor',
  selected_skill: ...,
  student_profile: ...,
  personalized_notes: matchedNotesForSend.map((item) => ({
    id: item.note.id,
    title: item.note.title,
    source_type: item.note.source.type,
    matched_keywords: item.keywords,
    excerpt: item.note.content.slice(0, 240),
  })),
  generated_resources: resourcesContextForSend.map((item) => ({
    id: item.resource.id,
    title: item.resource.title,
    type: item.resource.type,
    matched_keywords: item.keywords,
    excerpt: (item.resource.content || buildResourceSearchText(item.resource)).slice(0, 260),
  })),
}
```

- [ ] **Step 5: Run the frontend lint or targeted typecheck for the touched tutor files**

Run:

```bash
npm run lint -- --file frontend/src/app/tutor/page.tsx --file frontend/src/lib/api/real.ts
```

Expected:

```text
✔ No ESLint warnings or errors
```

- [ ] **Step 6: Commit the frontend change**

```bash
git add frontend/src/app/tutor/page.tsx frontend/src/lib/api/real.ts
git commit -m "fix: stop tutor frontend from mutating raw user input"
```

### Task 4: End-to-end verification and cleanup

**Files:**
- Check: `backend/tests/test_api.py`
- Check: `backend/tests/test_tutor_eval_mcp_args.py`
- Check: `frontend/src/app/tutor/page.tsx`
- Check: `backend/app/routes/tutor_eval.py`

- [ ] **Step 1: Run the full focused verification suite**

Run:

```bash
pytest backend/tests/test_api.py -k "tutor" -v
pytest backend/tests/test_tutor_eval_mcp_args.py -v
npm run lint -- --file frontend/src/app/tutor/page.tsx --file frontend/src/lib/api/real.ts
```

Expected:

```text
PASS backend tutor tests
PASS backend/tests/test_tutor_eval_mcp_args.py
✔ No ESLint warnings or errors
```

- [ ] **Step 2: Manually verify two new chats do not reuse the same conversation**

Run:

```bash
curl -N -X POST http://127.0.0.1:8000/api/tutor/chat -H "Content-Type: application/json" -d "{\"message\":\"帮我查一下信阳明天的天气\",\"mode\":\"knowledge_qa\"}"
curl -N -X POST http://127.0.0.1:8000/api/tutor/chat -H "Content-Type: application/json" -d "{\"message\":\"帮我做一个猫的图片\",\"mode\":\"image_gen\"}"
```

Expected:

```text
Each response emits a different conversation_id in the streamed meta/done payload.
```

- [ ] **Step 3: Manually verify history stores the raw user question**

Run:

```bash
curl "http://127.0.0.1:8000/api/tutor/history?conversation_id=<new_id>&limit=20"
```

Expected:

```text
The stored user message content matches the original question and does not contain "用户已生成资源库上下文".
```

- [ ] **Step 4: Inspect the final diff for accidental scope creep**

Run:

```bash
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- backend/app/routes/tutor_eval.py backend/tests/test_api.py backend/tests/test_tutor_eval_mcp_args.py frontend/src/app/tutor/page.tsx frontend/src/lib/api/real.ts
```

Expected:

```text
Only tutor context isolation changes appear. No unrelated refactors.
```

- [ ] **Step 5: Commit any final verification-only cleanup**

```bash
git add backend/app/routes/tutor_eval.py backend/tests/test_api.py backend/tests/test_tutor_eval_mcp_args.py frontend/src/app/tutor/page.tsx frontend/src/lib/api/real.ts
git commit -m "chore: verify tutor context isolation rollout"
```
