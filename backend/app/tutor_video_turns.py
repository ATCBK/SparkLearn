# -*- coding: utf-8 -*-
"""Tutor 视频消息的持久化边界。"""

from __future__ import annotations

import json
from typing import Any

from .db import get_conn, now_iso


class TutorVideoConversationNotFoundError(ValueError):
    """目标 Tutor 会话不存在或不属于当前用户。"""


class TutorVideoRoleNotFoundError(ValueError):
    """目标 Tutor 角色不存在、已禁用或不属于当前用户。"""


def create_tutor_video_turn(
    user_id: str,
    tutor_context: dict[str, Any],
    *,
    resource_id: str,
    title: str,
) -> dict[str, int]:
    """原子写入用户提问和待生成的视频消息。"""
    message = str(tutor_context.get("message") or "").strip()
    if not message:
        raise ValueError("tutor video message is empty")

    conversation_value = tutor_context.get("conversation_id")
    conversation_id = int(conversation_value) if conversation_value is not None else None
    role_value = tutor_context.get("role_id")
    role_id = int(role_value) if role_value is not None else None
    timestamp = now_iso()

    with get_conn() as conn:
        if conversation_id is not None:
            conversation = conn.execute(
                "SELECT id FROM tutor_conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id),
            ).fetchone()
            if not conversation:
                raise TutorVideoConversationNotFoundError("conversation not found")
        else:
            if role_id is None:
                role = conn.execute(
                    "SELECT id FROM tutor_roles WHERE user_id = ? AND enabled = 1 ORDER BY id ASC LIMIT 1",
                    (user_id,),
                ).fetchone()
                role_id = int(role["id"]) if role else None
            else:
                role = conn.execute(
                    "SELECT id FROM tutor_roles WHERE id = ? AND user_id = ? AND enabled = 1",
                    (role_id, user_id),
                ).fetchone()
                if not role:
                    raise TutorVideoRoleNotFoundError("tutor role not found")
            cursor = conn.execute(
                """
                INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, role_id, message[:80] or "视频辅导", timestamp, timestamp),
            )
            conversation_id = int(cursor.lastrowid)

        user_cursor = conn.execute(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
            VALUES (?, ?, 'user', ?, '[]', '{}', ?)
            """,
            (conversation_id, user_id, message, timestamp),
        )
        user_message_id = int(user_cursor.lastrowid)
        pending_resource = {
            "id": resource_id,
            "title": title,
            "type": "video",
            "status": "generating",
            "created_at": timestamp,
        }
        assistant_cursor = conn.execute(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
            VALUES (?, ?, 'assistant', ?, '[]', ?, ?)
            """,
            (
                conversation_id,
                user_id,
                "视频生成中，请稍候…",
                json.dumps({"mode": "video", "video_resource": pending_resource}, ensure_ascii=False),
                timestamp,
            ),
        )
        assistant_message_id = int(assistant_cursor.lastrowid)
        conn.execute(
            "UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
            (timestamp, conversation_id, user_id),
        )

    return {
        "conversation_id": int(conversation_id),
        "user_message_id": user_message_id,
        "assistant_message_id": assistant_message_id,
    }


def complete_tutor_video_turn(user_id: str, tutor_turn: dict[str, Any] | None, resource: dict[str, Any]) -> None:
    """把视频资源写入创建任务时对应的 Tutor 消息。"""
    if not tutor_turn:
        return
    assistant_message_id = tutor_turn.get("assistant_message_id")
    if assistant_message_id is None:
        return

    video_resource = {**resource, "type": "video", "status": "completed"}
    content = (
        "视频已生成，可以直接在下方播放。"
        if bool(video_resource.get("has_mp4"))
        else "视频已生成，可以直接在下方预览。"
        if video_resource.get("scene_url")
        else "视频已生成。"
    )
    _update_tutor_video_message(
        user_id,
        int(assistant_message_id),
        content=content,
        video_resource=video_resource,
    )


def fail_tutor_video_turn(user_id: str, tutor_turn: dict[str, Any] | None, error: str) -> None:
    """持久化视频生成失败状态，避免历史里永久显示生成中。"""
    if not tutor_turn:
        return
    assistant_message_id = tutor_turn.get("assistant_message_id")
    if assistant_message_id is None:
        return
    _update_tutor_video_message(
        user_id,
        int(assistant_message_id),
        content="视频生成失败，请稍后重试。",
        video_resource={
            "id": str(tutor_turn.get("resource_id") or ""),
            "title": str(tutor_turn.get("title") or "视频生成"),
            "type": "video",
            "status": "failed",
            "error": error,
        },
    )


def _update_tutor_video_message(
    user_id: str,
    assistant_message_id: int,
    *,
    content: str,
    video_resource: dict[str, Any],
) -> None:
    timestamp = now_iso()
    meta_json = json.dumps({"mode": "video", "video_resource": video_resource}, ensure_ascii=False)
    with get_conn() as conn:
        row = conn.execute(
            "SELECT conversation_id FROM tutor_messages WHERE id = ? AND user_id = ? AND sender_role = 'assistant'",
            (assistant_message_id, user_id),
        ).fetchone()
        if not row:
            return
        conversation_id = int(row["conversation_id"])
        conn.execute(
            "UPDATE tutor_messages SET content = ?, meta_json = ? WHERE id = ? AND user_id = ?",
            (content, meta_json, assistant_message_id, user_id),
        )
        conn.execute(
            "UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
            (timestamp, conversation_id, user_id),
        )
