CONFIDENCE_THRESHOLDS = {
    "high": 0.80,
    "medium": 0.55,
}

CONFIDENCE_COLOR_MAP = {
    "high": "green",
    "medium": "yellow",
    "low": "red",
}

CONFIDENCE_LABEL_MAP = {
    "high": "高置信",
    "medium": "中置信",
    "low": "低置信",
}

CONFIDENCE_MESSAGE_MAP = {
    "high": "已基于课程资料和学习记录回答",
    "medium": "已结合部分资料回答，建议继续核对",
    "low": "当前证据不足，以下回答仅供参考",
}

MIN_EVIDENCE_BY_TYPE = {
    "knowledge_qa": 2,
    "personalized_guidance": 2,
    "resource_based": 2,
    "open_ended": 0,
}
