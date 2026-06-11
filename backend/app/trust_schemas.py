from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class TrustAnswerRequest(BaseModel):
    scene: str
    query: str
    mode: str = "knowledge_qa"
    role_prompt: str = ""
    page_prompt: str = ""
    memory_prompt: str = ""
    conversation_id: int | None = None
    file_ids: list[int] = []
    knowledge_file_ids: list[int] = []
    user_file_sources: list[dict[str, Any]] = []
    web_search_results: list[dict[str, Any]] = []
    use_profile: bool = True


class RoutedQuery(BaseModel):
    query_type: str
    risk_level: str
    need_knowledge: bool
    need_profile: bool
    need_memory: bool
    need_rules: bool
    need_user_files: bool


class EvidenceItem(BaseModel):
    id: str
    source_type: str
    source_id: str
    title: str
    snippet: str
    score: float = 0.0
    metadata: dict[str, Any] = {}


class EvidenceBundle(BaseModel):
    knowledge: list[EvidenceItem] = []
    profile: list[EvidenceItem] = []
    files: list[EvidenceItem] = []
    web: list[EvidenceItem] = []
    rules: list[EvidenceItem] = []


class AnswerabilityDecision(BaseModel):
    confidence_score: float
    confidence_level: str
    response_mode: str
    reason_codes: list[str]
    missing_requirements: list[str]
    suggested_user_action: str = ""


class TrustAnswerResult(BaseModel):
    confidence_score: float
    confidence_level: str
    answer: str
    confidence_message: str = ""
    citations: list[dict[str, Any]] = []
    verification: list[dict[str, Any]] = []
    trust_meta: dict[str, Any] = {}
