# Tutor Context Isolation Design

## Background

The tutor context pipeline currently mixes long-term learner profile data with short-term conversation and resource context. This has produced cross-conversation contamination:

- unrelated user questions receive resource recommendations from other conversations
- user messages appear to be rewritten with appended resource-library text
- requests without an explicit `conversation_id` can silently fall into a reused default conversation

The target behavior for this change is:

- long-term learner profile remains shared for the same user
- short-term dialogue history, resource context, file context, MCP results, and search context are isolated by `conversation_id`
- a missing `conversation_id` creates a new conversation instead of reusing a default one

## Goals

- Preserve shared long-term learner profile injection
- Enforce strict per-conversation isolation for all short-term context
- Keep the user's original message unchanged through storage and model input
- Make context provenance observable in logs for future debugging

## Non-Goals

- Redesign the entire tutor orchestration architecture
- Change role prompt behavior beyond required context-boundary fixes
- Introduce cross-conversation inheritance or manual context sharing in this phase

## Current Failure Modes

### 1. Implicit default conversation reuse

`POST /api/tutor/chat` currently falls back to `_ensure_default_conversation()` when `conversation_id` is absent. This allows unrelated requests to accumulate into the same conversation if the frontend does not explicitly create or persist a conversation first.

### 2. User message contamination

Resource-library context is being appended to the user question somewhere in the current request path. That breaks tool argument extraction and causes the assistant to answer the wrong task.

### 3. Hidden short-term context inheritance

Some short-term context is inherited implicitly:

- file IDs can be inherited from the latest user message in the same conversation
- resource context appears to be reused without an explicit per-conversation boundary

The first behavior is already conversation-scoped but still implicit. The second behavior is more severe because it leaks unrelated context into new requests.

## Context Classes

The tutor pipeline will treat context as four separate classes:

1. `profile_context`
   Shared across the same user. Sourced from learner profile snapshot and long-term memory only.
2. `conversation_history`
   Strictly scoped to one `conversation_id`. Built only from `tutor_messages` in that conversation.
3. `request_context`
   Per-request evidence such as page context, current uploaded file IDs, current search results, and current MCP results.
4. `resource_context`
   Short-term context that must be scoped to the current conversation. It must never be appended to the raw user message.

Only `profile_context` is allowed to cross conversation boundaries.

## Conversation Lifecycle

### Rule

If `POST /api/tutor/chat` receives no `conversation_id`, the backend creates a new conversation immediately and uses that ID for the request.

### Implications

- `_ensure_default_conversation()` must not be used by the chat write path
- the first streamed metadata event must return the newly created `conversation_id`
- the frontend must persist and reuse the returned `conversation_id` for follow-up turns

This preserves compatibility for callers that omit `conversation_id` while preventing silent reuse of an unrelated thread.

## Prompt Assembly Rules

### Raw user message

The backend must treat `req.message` as immutable request data:

- store it verbatim in `tutor_messages`
- pass it verbatim into downstream decision logic
- never append resource-library text, search summaries, MCP output, or file snippets directly into it

### System and evidence blocks

All auxiliary context must be injected as separate blocks:

- role prompt
- page context prompt
- profile memory prompt
- file evidence prompt
- search results prompt
- MCP result prompt
- resource context prompt

The model may receive these blocks in system/history positions, but the original user message must remain unchanged.

## Short-Term Context Isolation Rules

### Conversation history

History assembly remains limited to the current `conversation_id`. No fallback or merge with other conversations is allowed.

### Resource context

Resource context must be loaded only from:

- explicit request payload for the current turn, or
- storage indexed by the current `conversation_id`

No global recent-resource pool may be injected into tutor chat.

### File context

Default behavior changes from implicit reuse to explicit reuse:

- preferred path: use only `req.file_ids`
- if the product later wants "reuse previous files", it must be an explicit frontend action and a dedicated backend flag

For this phase, omitting `file_ids` means no file evidence is injected.

### Search and MCP context

Search results and MCP tool outputs are already request-local in spirit. The implementation must keep them local to the current turn and prevent any persistence-based reinjection into later unrelated conversations.

## API Layer

File: `backend/app/routes/tutor_eval.py`

Required changes:

- replace `req.conversation_id or _ensure_default_conversation()` with logic that creates a new conversation when `req.conversation_id` is absent
- ensure conversation creation also selects the initial role consistently
- stop implicit file ID inheritance in `_resolve_effective_file_ids()`
- audit any helper that appends resource context to `req.message` or derives downstream prompts from a mutated message

### Helper shape

Introduce a small helper such as `_ensure_requested_or_new_conversation(conversation_id, role_id)` or equivalent inline logic. The helper should:

- return the provided `conversation_id` when present
- otherwise create a fresh `tutor_conversations` row
- assign `role_id` using the current defaulting rule
- return the created conversation ID

## Frontend Changes

Any tutor client that starts a new chat without a `conversation_id` must:

- read the returned `conversation_id` from the first response metadata
- store it in the active conversation state
- send it on all subsequent turns

No frontend should rely on a hidden backend default conversation for correctness.

## Observability

Each tutor turn should emit structured diagnostic data for injected context. At minimum, log:

- current `conversation_id`
- whether the conversation was newly created
- context block types injected into the model
- source conversation ID for every short-term context block
- file IDs used

If a short-term context block has a source conversation ID different from the current conversation, the block must be dropped and the mismatch must be logged as a warning.

## Error Handling

- If a provided `conversation_id` does not belong to the current user, reject the request instead of silently creating a fallback
- If explicit file IDs are invalid or inaccessible, continue without file evidence and surface a warning event or log entry
- If context assembly fails for a non-critical block such as resource context, continue with remaining valid context instead of corrupting the user message

## Testing Strategy

Add or update tests for the following:

1. Missing `conversation_id` creates a new conversation and returns its ID
2. Two requests without `conversation_id` create two distinct conversations
3. User message is stored verbatim and never includes appended resource-library context
4. Weather and other tool-argument extraction still work when resource context exists elsewhere in the system
5. File evidence is not inherited when a new request omits `file_ids`
6. Conversation history only contains messages from the active `conversation_id`
7. Resource context from conversation A is never injected into conversation B

## Rollout Plan

1. Implement backend conversation-creation and context-boundary fixes
2. Update frontend state handling for newly returned conversation IDs
3. Add regression tests around message immutability and conversation isolation
4. Verify with manual multi-conversation scenarios

## Risks

- frontend code may currently assume the backend default conversation behavior
- removing implicit file reuse may slightly change user experience for repeated follow-up questions
- there may be more than one resource-context injection path, so code search must verify all mutation sites

## Acceptance Criteria

- New tutor requests without `conversation_id` no longer share context with prior requests
- Profile-based personalization still works across conversations for the same user
- The raw user question remains unchanged in storage and model input
- A question in one conversation cannot receive resource-library context from another conversation
- Diagnostic logs clearly show which context blocks were injected and why
