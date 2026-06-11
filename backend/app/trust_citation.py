from __future__ import annotations

from .trust_rules import CONFIDENCE_COLOR_MAP, CONFIDENCE_LABEL_MAP, CONFIDENCE_MESSAGE_MAP
from .trust_schemas import EvidenceBundle


def render_citations(bundle: EvidenceBundle) -> list[dict]:
    out: list[dict] = []
    for item in [*bundle.knowledge, *bundle.files, *bundle.profile, *bundle.web]:
        out.append(
            {
                "id": item.id,
                "label": item.title,
                "source_type": item.source_type,
                "snippet": item.snippet,
                "score": round(float(item.score), 4),
            }
        )
    return out


def render_confidence(confidence_score: float, confidence_level: str, reason_codes: list[str]) -> dict:
    return {
        "score": round(float(confidence_score), 3),
        "level": confidence_level,
        "color": CONFIDENCE_COLOR_MAP.get(confidence_level, "red"),
        "label": CONFIDENCE_LABEL_MAP.get(confidence_level, "低置信"),
        "reason_codes": reason_codes,
        "message": CONFIDENCE_MESSAGE_MAP.get(confidence_level, CONFIDENCE_MESSAGE_MAP["low"]),
    }
