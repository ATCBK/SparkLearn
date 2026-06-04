# -*- coding: utf-8 -*-
"""
敏感词过滤模块
用于检测和过滤涉政、色情、暴力等敏感内容
"""

import re
from typing import List, Tuple

# 敏感词分类列表
# 注意：这里只列出部分示例，实际生产环境应该使用更完整的敏感词库

# 涉政敏感词
POLITICAL_WORDS = [
    # 国家领导人相关
    "习近平", "毛泽东", "邓小平", "江泽民", "胡锦涛",
    "习主席", "习总书记", "习core",
    # 政治相关
    "六四", "天安门事件", "文化大革命", "大跃进",
    "反华", "藏独", "疆独", "台独", "港独",
    "法轮功", "法轮大法",
    # 政治组织
    "共产党", "国民党", "民进党",
    # 敏感政治词汇
    "独裁", "专制", "暴政",
]

# 色情相关词汇
PORNOGRAPHIC_WORDS = [
    "色情", "黄片", "AV", "成人视频", "裸体",
    "性交", "做爱", "口交", "肛交",
    "嫖娼", "卖淫", "妓女", "小姐服务",
    "约炮", "一夜情", "援交",
    "淫荡", "骚货", "贱人",
]

# 暴力相关词汇
VIOLENT_WORDS = [
    "杀人", "砍人", "爆炸", "恐怖袭击",
    "炸弹", "枪支", "贩卖枪支",
    "绑架", "勒索", "敲诈",
    "自杀", "自残", "割腕",
    "黑社会", "帮派", "黑帮",
]

# 赌博相关词汇
GAMBLING_WORDS = [
    "赌博", "赌场", "博彩", "彩票预测",
    "网赌", "赌球", "赌马",
    "老虎机", "百家乐", "德州扑克",
    "六合彩", "时时彩",
]

# 毒品相关词汇
DRUG_WORDS = [
    "毒品", "吸毒", "贩毒", "大麻",
    "冰毒", "摇头丸", "海洛因",
    "可卡因", "鸦片", "罂粟",
]

# 歧视性词汇
DISCRIMINATION_WORDS = [
    "黑鬼", "白猪", "支那",
    "贱民", "废物", "垃圾人",
]

# 合并所有敏感词
ALL_SENSITIVE_WORDS = (
    POLITICAL_WORDS
    + PORNOGRAPHIC_WORDS
    + VIOLENT_WORDS
    + GAMBLING_WORDS
    + DRUG_WORDS
    + DISCRIMINATION_WORDS
)

# 敏感词分类映射
SENSITIVE_WORD_CATEGORIES = {
    "political": POLITICAL_WORDS,
    "pornographic": PORNOGRAPHIC_WORDS,
    "violent": VIOLENT_WORDS,
    "gambling": GAMBLING_WORDS,
    "drug": DRUG_WORDS,
    "discrimination": DISCRIMINATION_WORDS,
}


def contains_sensitive_word(text: str) -> Tuple[bool, str, List[str]]:
    """
    检查文本是否包含敏感词

    Args:
        text: 要检查的文本

    Returns:
        Tuple[bool, str, List[str]]: (是否包含敏感词, 敏感词类别, 匹配到的敏感词列表)
    """
    if not text:
        return False, "", []

    text_lower = text.lower()
    found_words = []
    found_category = ""

    # 检查每个敏感词
    for word in ALL_SENSITIVE_WORDS:
        if word.lower() in text_lower:
            found_words.append(word)
            # 确定类别
            for category, words in SENSITIVE_WORD_CATEGORIES.items():
                if word in words:
                    found_category = category
                    break

    if found_words:
        return True, found_category, found_words

    return False, "", []


def filter_sensitive_text(text: str, replacement: str = "***") -> str:
    """
    过滤文本中的敏感词，用指定字符替换

    Args:
        text: 要过滤的文本
        replacement: 替换字符，默认为 "***"

    Returns:
        str: 过滤后的文本
    """
    if not text:
        return text

    result = text
    for word in ALL_SENSITIVE_WORDS:
        # 使用正则表达式进行大小写不敏感的替换
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        result = pattern.sub(replacement, result)

    return result


def get_sensitive_word_message(category: str) -> str:
    """
    根据敏感词类别返回友好的错误提示信息

    Args:
        category: 敏感词类别

    Returns:
        str: 错误提示信息
    """
    messages = {
        "political": "搜索内容包含涉政敏感词汇，请修改后重试",
        "pornographic": "搜索内容包含色情敏感词汇，请修改后重试",
        "violent": "搜索内容包含暴力敏感词汇，请修改后重试",
        "gambling": "搜索内容包含赌博敏感词汇，请修改后重试",
        "drug": "搜索内容包含毒品敏感词汇，请修改后重试",
        "discrimination": "搜索内容包含歧视性词汇，请修改后重试",
    }
    return messages.get(category, "搜索内容包含敏感词汇，请修改后重试")
