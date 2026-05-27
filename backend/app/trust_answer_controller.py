from __future__ import annotations

from typing import Any

from .llm import spark_lite
from .trust_citation import render_citations
from .trust_judge import judge_answerability
from .trust_retriever import retrieve_evidence
from .trust_router import route_query
from .trust_rules import CONFIDENCE_MESSAGE_MAP
from .trust_schemas import TrustAnswerRequest, TrustAnswerResult


class TrustAnswerController:
    async def plan(self, req: TrustAnswerRequest) -> dict[str, Any]:
        routed = route_query(req.query, req.mode)
        evidence = await retrieve_evidence(req, routed)
        decision = judge_answerability(routed, evidence)
        citations = render_citations(evidence)

        return {
            "prompt": self._build_prompt(req=req, decision=decision, citations=citations),
            "confidence_score": decision.confidence_score,
            "confidence_level": decision.confidence_level,
            "confidence_message": CONFIDENCE_MESSAGE_MAP.get(decision.confidence_level, CONFIDENCE_MESSAGE_MAP["low"]),
            "citations": citations,
            "trust_meta": {
                "scene": req.scene,
                "query_type": routed.query_type,
                "risk_level": routed.risk_level,
                "response_mode": decision.response_mode,
                "reason_codes": decision.reason_codes,
                "missing_requirements": decision.missing_requirements,
                "suggested_user_action": decision.suggested_user_action,
                "evidence_count": len(citations),
            },
        }

    async def answer(self, req: TrustAnswerRequest) -> TrustAnswerResult:
        plan = await self.plan(req)
        answer_text = await self._grounded_generate(req=req, prompt=str(plan["prompt"]))
        return TrustAnswerResult(
            confidence_score=float(plan["confidence_score"]),
            confidence_level=str(plan["confidence_level"]),
            answer=answer_text,
            confidence_message=str(plan["confidence_message"]),
            citations=list(plan["citations"]),
            verification=[],
            trust_meta=dict(plan["trust_meta"]),
        )

    def _build_prompt(self, *, req: TrustAnswerRequest, decision: Any, citations: list[dict]) -> str:
        evidence_lines = []
        for idx, c in enumerate(citations[:6], start=1):
            evidence_lines.append(f"{idx}. [{c['label']}] {c['snippet']}")
        evidence_block = "\n".join(evidence_lines) if evidence_lines else "无可用课程证据片段。"

        style_line = ""
        if decision.confidence_level == "low":
            style_line = "证据不足时仍需回答，但必须使用保守语气，避免强确定性措辞，并在末尾给出补充信息建议。"
        elif decision.confidence_level == "medium":
            style_line = "可给出回答，但需明确证据边界并提示用户继续核对。"
        else:
            style_line = "可以给出清晰结论，并保持可验证表达。"

        return (
            "你是 SparkLearn 的可信学习辅导助手。\n"
            "请优先依据证据回答，不要编造未在证据中出现的事实。\n"
            f"{style_line}\n"
            f"[角色设定]\n{req.role_prompt}\n\n"
            f"[页面上下文]\n{req.page_prompt}\n\n"
            f"[学习记忆]\n{req.memory_prompt}\n\n"
            f"[证据片段]\n{evidence_block}\n\n"
            f"[用户问题]\n{req.query}\n\n"
            "请直接输出最终回答正文。"
        )

    async def _grounded_generate(self, *, req: TrustAnswerRequest, prompt: str) -> str:
        chunks: list[str] = []
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode=req.mode, history=[]):
            if evt_type == "text":
                text = str(payload.get("content", ""))
                if text:
                    chunks.append(text)
        answer = "".join(chunks).strip()
        if not answer:
            answer = "当前证据不足，我先给出一个方向性建议：请补充题目或课程资料后我再给你更准确的结论。"
        return answer
