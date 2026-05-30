from __future__ import annotations

from .trust_rules import CONFIDENCE_THRESHOLDS, MIN_EVIDENCE_BY_TYPE
from .trust_schemas import AnswerabilityDecision, EvidenceBundle, RoutedQuery


def judge_answerability(routed: RoutedQuery, evidence: EvidenceBundle) -> AnswerabilityDecision:
    all_scores = (
        [e.score for e in evidence.knowledge]
        + [e.score for e in evidence.files]
        + [e.score for e in evidence.web]
    )
    evidence_count = len(evidence.knowledge) + len(evidence.profile) + len(evidence.files) + len(evidence.web)
    top1 = max(all_scores) if all_scores else 0.0
    top3_avg = (sum(sorted(all_scores, reverse=True)[:3]) / min(len(all_scores), 3)) if all_scores else 0.0

    reasons: list[str] = []
    missing: list[str] = []

    if evidence_count == 0:
        reasons.append("NO_EVIDENCE")
    has_knowledge = len(evidence.knowledge) > 0
    has_web = len(evidence.web) > 0
    if top1 < 0.55 and top3_avg < 0.45 and routed.need_knowledge and not has_web:
        reasons.append("LOW_RETRIEVAL_SCORE")
    if routed.need_profile and len(evidence.profile) == 0:
        reasons.append("PROFILE_REQUIRED_BUT_MISSING")
        missing.append("profile")

    min_evidence = MIN_EVIDENCE_BY_TYPE.get(routed.query_type, 1)
    base = 0.35 + min(0.4, (evidence_count / max(1, min_evidence + 1)) * 0.25)
    score = base + min(0.25, top1 * 0.15 + top3_avg * 0.1)
    # 联网搜索结果可有效补偿知识库证据不足的情况
    if has_web and not has_knowledge and "LOW_RETRIEVAL_SCORE" not in reasons:
        score = max(score, 0.55)
    if "NO_EVIDENCE" in reasons:
        score = min(score, 0.54)
    if "PROFILE_REQUIRED_BUT_MISSING" in reasons:
        score = min(score, 0.70)
    score = max(0.0, min(1.0, round(score, 3)))

    if score >= CONFIDENCE_THRESHOLDS["high"]:
        level = "high"
        mode = "grounded"
    elif score >= CONFIDENCE_THRESHOLDS["medium"]:
        level = "medium"
        mode = "grounded_cautious"
    else:
        level = "low"
        mode = "low_confidence"

    action = ""
    if level == "low":
        action = "建议补充课程资料、具体题目或学习画像后继续提问。"
    elif level == "medium":
        action = "建议继续核对题干细节，以便提升结论确定性。"

    return AnswerabilityDecision(
        confidence_score=score,
        confidence_level=level,
        response_mode=mode,
        reason_codes=reasons,
        missing_requirements=missing,
        suggested_user_action=action,
    )
