"""模板加载器：从 YAML 文件加载资源生成模板并构建 prompt。"""

from pathlib import Path
from typing import Any

import yaml

_TEMPLATE_DIR = Path(__file__).parent
_cache: dict[str, dict[str, Any] | None] = {}


def load_template(resource_type: str) -> dict[str, Any] | None:
    """加载指定资源类型的 YAML 模板，带内存缓存。"""
    if resource_type not in _cache:
        path = _TEMPLATE_DIR / f"{resource_type}.yaml"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _cache[resource_type] = yaml.safe_load(f)
        else:
            _cache[resource_type] = None
    return _cache[resource_type]


def build_prompt_from_template(resource_type: str, user_prompt: str) -> str:
    """根据模板构建完整 prompt。无模板时回退为原始用户输入。"""
    tpl = load_template(resource_type)
    if not tpl:
        return user_prompt

    parts: list[str] = []

    # 角色设定
    if tpl.get("system_role"):
        parts.append(tpl["system_role"].strip())

    # 输出结构
    structure = tpl.get("output_structure")
    if structure:
        parts.append("请严格按照以下结构输出：\n")
        for sec in structure:
            title = sec.get("title", "")
            instruction = sec.get("instruction", "")
            if title:
                parts.append(title)
            if instruction:
                # 保持缩进格式
                for line in instruction.strip().splitlines():
                    parts.append(f"  {line}")
            parts.append("")  # 空行分隔

    # 质量规则
    rules = tpl.get("quality_rules")
    if rules:
        parts.append("质量要求：")
        for i, rule in enumerate(rules, 1):
            parts.append(f"  {i}. {rule}")
        parts.append("")

    # 格式约束
    constraints = tpl.get("format_constraints")
    if constraints:
        parts.append("格式要求：")
        for c in constraints:
            parts.append(f"  - {c}")
        parts.append("")

    # 用户需求
    parts.append(f"用户需求：{user_prompt.strip()}")

    return "\n".join(parts)
