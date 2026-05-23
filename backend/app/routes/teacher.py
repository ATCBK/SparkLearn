"""
教师端大屏数据 API
提供班级聚合数据、学生列表、知识点掌握分布等供大屏消费
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import fetch_all, fetch_one
from ..llm import spark_lite
from ..schemas import fail, ok

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


# ─── 工具函数 ─────────────────────────────────────────────────────────────────

def _days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


# ─── 知识点元数据 ─────────────────────────────────────────────────────────────

_KP_NAMES: dict[str, str] = {
    "1.1": "变量与数据类型", "1.2": "表达式与运算符", "1.3": "条件分支",
    "1.4": "循环与控制", "1.5": "列表与字典",
    "2.1": "函数定义与调用", "2.2": "作用域与闭包", "2.3": "模块与包",
    "2.4": "常用标准库",
    "3.1": "类与对象", "3.2": "封装与属性", "3.3": "继承与多态", "3.4": "OOP建模实战",
    "4.1": "文件读写", "4.2": "异常处理", "4.3": "JSON与持久化", "4.4": "日志与调试",
    "5.1": "装饰器", "5.2": "生成器与迭代器", "5.3": "列表推导式", "5.4": "异步编程入门",
}

_STAGE_ORDER = ["基础语法", "函数与模块", "面向对象", "文件处理", "高级特性"]

_STAGE_KPS: dict[str, list[str]] = {
    "基础语法":  ["1.1", "1.2", "1.3", "1.4", "1.5"],
    "函数与模块": ["2.1", "2.2", "2.3", "2.4"],
    "面向对象":  ["3.1", "3.2", "3.3", "3.4"],
    "文件处理":  ["4.1", "4.2", "4.3", "4.4"],
    "高级特性":  ["5.1", "5.2", "5.3", "5.4"],
}


# ─── 模拟班级学生数据（8人，覆盖不同阶段/掌握度/风险） ──────────────────────

def _mock_students() -> list[dict[str, Any]]:
    return [
        {
            "id": "stu_001", "name": "张明远", "avatar": "张",
            "major": "计算机科学", "grade": "大二",
            "current_stage": "函数与模块",
            "knowledge_level": "有一定基础",
            "weak_points": ["闭包", "装饰器"],
            "learning_preference": ["实践型", "视觉型"],
            "daily_time": 60, "streak_days": 12,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.90, "1.2": 0.85, "1.3": 0.80, "1.4": 0.75, "1.5": 0.70,
                "2.1": 0.62, "2.2": 0.45, "2.3": 0.50, "2.4": 0.40,
                "3.1": 0.30, "3.2": 0.20, "3.3": 0.15, "3.4": 0.10,
            },
            "quiz_accuracy": 0.78, "total_hours": 24.5, "task_completion": 0.82,
        },
        {
            "id": "stu_002", "name": "李晓雨", "avatar": "李",
            "major": "软件工程", "grade": "大二",
            "current_stage": "面向对象",
            "knowledge_level": "基础扎实",
            "weak_points": ["继承", "多态"],
            "learning_preference": ["阅读型"],
            "daily_time": 90, "streak_days": 20,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.95, "1.2": 0.92, "1.3": 0.90, "1.4": 0.88, "1.5": 0.85,
                "2.1": 0.82, "2.2": 0.78, "2.3": 0.80, "2.4": 0.75,
                "3.1": 0.65, "3.2": 0.55, "3.3": 0.48, "3.4": 0.30,
            },
            "quiz_accuracy": 0.88, "total_hours": 38.0, "task_completion": 0.91,
        },
        {
            "id": "stu_003", "name": "王浩然", "avatar": "王",
            "major": "计算机科学", "grade": "大一",
            "current_stage": "基础语法",
            "knowledge_level": "零基础",
            "weak_points": ["循环", "条件分支", "列表"],
            "learning_preference": ["视觉型"],
            "daily_time": 30, "streak_days": 3,
            "risk_level": "warning",
            "last_active": _days_ago(2),
            "mastery": {
                "1.1": 0.60, "1.2": 0.45, "1.3": 0.35, "1.4": 0.28, "1.5": 0.20,
                "2.1": 0.10, "2.2": 0.05, "2.3": 0.05, "2.4": 0.00,
                "3.1": 0.00, "3.2": 0.00, "3.3": 0.00, "3.4": 0.00,
            },
            "quiz_accuracy": 0.52, "total_hours": 8.5, "task_completion": 0.45,
        },
        {
            "id": "stu_004", "name": "陈思琪", "avatar": "陈",
            "major": "数据科学", "grade": "大二",
            "current_stage": "高级特性",
            "knowledge_level": "进阶",
            "weak_points": ["异步编程"],
            "learning_preference": ["实践型", "挑战型"],
            "daily_time": 120, "streak_days": 35,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.98, "1.2": 0.96, "1.3": 0.95, "1.4": 0.93, "1.5": 0.92,
                "2.1": 0.90, "2.2": 0.88, "2.3": 0.87, "2.4": 0.85,
                "3.1": 0.82, "3.2": 0.80, "3.3": 0.78, "3.4": 0.75,
                "4.1": 0.72, "4.2": 0.70, "4.3": 0.68, "4.4": 0.65,
                "5.1": 0.60, "5.2": 0.55, "5.3": 0.58, "5.4": 0.40,
            },
            "quiz_accuracy": 0.94, "total_hours": 62.0, "task_completion": 0.96,
        },
        {
            "id": "stu_005", "name": "刘子轩", "avatar": "刘",
            "major": "信息安全", "grade": "大三",
            "current_stage": "文件处理",
            "knowledge_level": "有一定基础",
            "weak_points": ["异常处理", "日志调试"],
            "learning_preference": ["实践型"],
            "daily_time": 45, "streak_days": 7,
            "risk_level": "normal",
            "last_active": _days_ago(1),
            "mastery": {
                "1.1": 0.88, "1.2": 0.85, "1.3": 0.82, "1.4": 0.80, "1.5": 0.78,
                "2.1": 0.75, "2.2": 0.70, "2.3": 0.72, "2.4": 0.68,
                "3.1": 0.65, "3.2": 0.60, "3.3": 0.58, "3.4": 0.50,
                "4.1": 0.55, "4.2": 0.42, "4.3": 0.48, "4.4": 0.35,
            },
            "quiz_accuracy": 0.72, "total_hours": 31.0, "task_completion": 0.74,
        },
        {
            "id": "stu_006", "name": "赵雅婷", "avatar": "赵",
            "major": "计算机科学", "grade": "大二",
            "current_stage": "函数与模块",
            "knowledge_level": "有一定基础",
            "weak_points": ["作用域", "模块导入"],
            "learning_preference": ["阅读型", "归纳型"],
            "daily_time": 60, "streak_days": 0,
            "risk_level": "danger",
            "last_active": _days_ago(5),
            "mastery": {
                "1.1": 0.82, "1.2": 0.78, "1.3": 0.72, "1.4": 0.68, "1.5": 0.65,
                "2.1": 0.55, "2.2": 0.38, "2.3": 0.40, "2.4": 0.30,
                "3.1": 0.20, "3.2": 0.10, "3.3": 0.08, "3.4": 0.05,
            },
            "quiz_accuracy": 0.65, "total_hours": 15.0, "task_completion": 0.55,
        },
        {
            "id": "stu_007", "name": "孙博文", "avatar": "孙",
            "major": "软件工程", "grade": "大一",
            "current_stage": "基础语法",
            "knowledge_level": "零基础",
            "weak_points": ["变量", "数据类型", "运算符"],
            "learning_preference": ["视觉型"],
            "daily_time": 20, "streak_days": 1,
            "risk_level": "danger",
            "last_active": _days_ago(4),
            "mastery": {
                "1.1": 0.42, "1.2": 0.30, "1.3": 0.20, "1.4": 0.15, "1.5": 0.10,
                "2.1": 0.05, "2.2": 0.00, "2.3": 0.00, "2.4": 0.00,
                "3.1": 0.00, "3.2": 0.00, "3.3": 0.00, "3.4": 0.00,
            },
            "quiz_accuracy": 0.40, "total_hours": 4.0, "task_completion": 0.30,
        },
        {
            "id": "stu_008", "name": "周欣怡", "avatar": "周",
            "major": "人工智能", "grade": "大二",
            "current_stage": "面向对象",
            "knowledge_level": "有一定基础",
            "weak_points": ["面向对象建模"],
            "learning_preference": ["实践型", "视觉型"],
            "daily_time": 75, "streak_days": 15,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.92, "1.2": 0.88, "1.3": 0.85, "1.4": 0.82, "1.5": 0.80,
                "2.1": 0.78, "2.2": 0.72, "2.3": 0.75, "2.4": 0.70,
                "3.1": 0.62, "3.2": 0.55, "3.3": 0.50, "3.4": 0.38,
            },
            "quiz_accuracy": 0.82, "total_hours": 28.5, "task_completion": 0.85,
        },
        {
            "id": "stu_009", "name": "许文涛", "avatar": "许",
            "major": "软件工程", "grade": "大三",
            "current_stage": "文件处理",
            "knowledge_level": "基础扎实",
            "weak_points": ["日志与调试"],
            "learning_preference": ["实践型", "归纳型"],
            "daily_time": 70, "streak_days": 18,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.90, "1.2": 0.88, "1.3": 0.86, "1.4": 0.84, "1.5": 0.82,
                "2.1": 0.80, "2.2": 0.76, "2.3": 0.78, "2.4": 0.74,
                "3.1": 0.70, "3.2": 0.66, "3.3": 0.62, "3.4": 0.58,
                "4.1": 0.60, "4.2": 0.57, "4.3": 0.55, "4.4": 0.45,
            },
            "quiz_accuracy": 0.81, "total_hours": 34.0, "task_completion": 0.86,
        },
        {
            "id": "stu_010", "name": "马雨桐", "avatar": "马",
            "major": "计算机科学", "grade": "大一",
            "current_stage": "基础语法",
            "knowledge_level": "零基础",
            "weak_points": ["循环与控制", "表达式与运算符"],
            "learning_preference": ["视觉型"],
            "daily_time": 25, "streak_days": 2,
            "risk_level": "warning",
            "last_active": _days_ago(2),
            "mastery": {
                "1.1": 0.55, "1.2": 0.42, "1.3": 0.38, "1.4": 0.30, "1.5": 0.25,
                "2.1": 0.12, "2.2": 0.08, "2.3": 0.05, "2.4": 0.00,
                "3.1": 0.00, "3.2": 0.00, "3.3": 0.00, "3.4": 0.00,
            },
            "quiz_accuracy": 0.50, "total_hours": 6.5, "task_completion": 0.40,
        },
        {
            "id": "stu_011", "name": "曹佳宁", "avatar": "曹",
            "major": "数据科学", "grade": "大二",
            "current_stage": "函数与模块",
            "knowledge_level": "有一定基础",
            "weak_points": ["作用域与闭包"],
            "learning_preference": ["阅读型", "归纳型"],
            "daily_time": 65, "streak_days": 9,
            "risk_level": "normal",
            "last_active": _days_ago(1),
            "mastery": {
                "1.1": 0.86, "1.2": 0.82, "1.3": 0.78, "1.4": 0.74, "1.5": 0.72,
                "2.1": 0.64, "2.2": 0.46, "2.3": 0.54, "2.4": 0.48,
                "3.1": 0.28, "3.2": 0.20, "3.3": 0.15, "3.4": 0.10,
            },
            "quiz_accuracy": 0.74, "total_hours": 22.0, "task_completion": 0.76,
        },
        {
            "id": "stu_012", "name": "邓思远", "avatar": "邓",
            "major": "网络工程", "grade": "大三",
            "current_stage": "高级特性",
            "knowledge_level": "进阶",
            "weak_points": ["生成器与迭代器"],
            "learning_preference": ["挑战型", "实践型"],
            "daily_time": 110, "streak_days": 27,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.97, "1.2": 0.95, "1.3": 0.94, "1.4": 0.92, "1.5": 0.90,
                "2.1": 0.88, "2.2": 0.84, "2.3": 0.85, "2.4": 0.82,
                "3.1": 0.80, "3.2": 0.78, "3.3": 0.74, "3.4": 0.70,
                "4.1": 0.68, "4.2": 0.66, "4.3": 0.64, "4.4": 0.60,
                "5.1": 0.58, "5.2": 0.50, "5.3": 0.54, "5.4": 0.42,
            },
            "quiz_accuracy": 0.92, "total_hours": 58.0, "task_completion": 0.94,
        },
        {
            "id": "stu_013", "name": "冯嘉乐", "avatar": "冯",
            "major": "人工智能", "grade": "大二",
            "current_stage": "面向对象",
            "knowledge_level": "有一定基础",
            "weak_points": ["继承与多态", "OOP建模实战"],
            "learning_preference": ["实践型"],
            "daily_time": 55, "streak_days": 5,
            "risk_level": "warning",
            "last_active": _days_ago(3),
            "mastery": {
                "1.1": 0.82, "1.2": 0.79, "1.3": 0.75, "1.4": 0.72, "1.5": 0.70,
                "2.1": 0.68, "2.2": 0.62, "2.3": 0.64, "2.4": 0.60,
                "3.1": 0.52, "3.2": 0.46, "3.3": 0.40, "3.4": 0.32,
            },
            "quiz_accuracy": 0.69, "total_hours": 19.0, "task_completion": 0.66,
        },
        {
            "id": "stu_014", "name": "韩若彤", "avatar": "韩",
            "major": "信息安全", "grade": "大二",
            "current_stage": "函数与模块",
            "knowledge_level": "有一定基础",
            "weak_points": ["模块与包", "常用标准库"],
            "learning_preference": ["阅读型", "视觉型"],
            "daily_time": 50, "streak_days": 0,
            "risk_level": "danger",
            "last_active": _days_ago(6),
            "mastery": {
                "1.1": 0.76, "1.2": 0.72, "1.3": 0.68, "1.4": 0.62, "1.5": 0.60,
                "2.1": 0.50, "2.2": 0.36, "2.3": 0.32, "2.4": 0.28,
                "3.1": 0.12, "3.2": 0.08, "3.3": 0.04, "3.4": 0.00,
            },
            "quiz_accuracy": 0.60, "total_hours": 13.5, "task_completion": 0.50,
        },
        {
            "id": "stu_015", "name": "蒋天宇", "avatar": "蒋",
            "major": "计算机科学", "grade": "大一",
            "current_stage": "基础语法",
            "knowledge_level": "零基础",
            "weak_points": ["变量与数据类型", "条件分支"],
            "learning_preference": ["视觉型", "实践型"],
            "daily_time": 18, "streak_days": 1,
            "risk_level": "danger",
            "last_active": _days_ago(5),
            "mastery": {
                "1.1": 0.38, "1.2": 0.32, "1.3": 0.22, "1.4": 0.18, "1.5": 0.12,
                "2.1": 0.05, "2.2": 0.00, "2.3": 0.00, "2.4": 0.00,
                "3.1": 0.00, "3.2": 0.00, "3.3": 0.00, "3.4": 0.00,
            },
            "quiz_accuracy": 0.42, "total_hours": 3.5, "task_completion": 0.28,
        },
        {
            "id": "stu_016", "name": "雷诗雨", "avatar": "雷",
            "major": "软件工程", "grade": "大三",
            "current_stage": "文件处理",
            "knowledge_level": "基础扎实",
            "weak_points": ["JSON与持久化"],
            "learning_preference": ["实践型", "阅读型"],
            "daily_time": 85, "streak_days": 14,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.94, "1.2": 0.90, "1.3": 0.88, "1.4": 0.86, "1.5": 0.84,
                "2.1": 0.82, "2.2": 0.78, "2.3": 0.79, "2.4": 0.76,
                "3.1": 0.72, "3.2": 0.68, "3.3": 0.64, "3.4": 0.60,
                "4.1": 0.58, "4.2": 0.54, "4.3": 0.46, "4.4": 0.52,
            },
            "quiz_accuracy": 0.85, "total_hours": 40.0, "task_completion": 0.89,
        },
        {
            "id": "stu_017", "name": "罗晨希", "avatar": "罗",
            "major": "数据科学", "grade": "大二",
            "current_stage": "面向对象",
            "knowledge_level": "有一定基础",
            "weak_points": ["封装与属性"],
            "learning_preference": ["归纳型"],
            "daily_time": 62, "streak_days": 11,
            "risk_level": "normal",
            "last_active": _days_ago(1),
            "mastery": {
                "1.1": 0.88, "1.2": 0.84, "1.3": 0.82, "1.4": 0.80, "1.5": 0.76,
                "2.1": 0.74, "2.2": 0.70, "2.3": 0.72, "2.4": 0.68,
                "3.1": 0.60, "3.2": 0.49, "3.3": 0.52, "3.4": 0.40,
            },
            "quiz_accuracy": 0.79, "total_hours": 27.0, "task_completion": 0.81,
        },
        {
            "id": "stu_018", "name": "倪浩然", "avatar": "倪",
            "major": "网络工程", "grade": "大一",
            "current_stage": "基础语法",
            "knowledge_level": "零基础",
            "weak_points": ["列表与字典", "循环与控制"],
            "learning_preference": ["视觉型"],
            "daily_time": 28, "streak_days": 4,
            "risk_level": "warning",
            "last_active": _days_ago(2),
            "mastery": {
                "1.1": 0.62, "1.2": 0.54, "1.3": 0.48, "1.4": 0.35, "1.5": 0.30,
                "2.1": 0.15, "2.2": 0.10, "2.3": 0.06, "2.4": 0.02,
                "3.1": 0.00, "3.2": 0.00, "3.3": 0.00, "3.4": 0.00,
            },
            "quiz_accuracy": 0.57, "total_hours": 9.0, "task_completion": 0.47,
        },
        {
            "id": "stu_019", "name": "潘梓豪", "avatar": "潘",
            "major": "人工智能", "grade": "大三",
            "current_stage": "高级特性",
            "knowledge_level": "进阶",
            "weak_points": ["装饰器", "异步编程入门"],
            "learning_preference": ["挑战型", "实践型"],
            "daily_time": 100, "streak_days": 22,
            "risk_level": "normal",
            "last_active": _days_ago(0),
            "mastery": {
                "1.1": 0.96, "1.2": 0.94, "1.3": 0.92, "1.4": 0.91, "1.5": 0.89,
                "2.1": 0.86, "2.2": 0.82, "2.3": 0.83, "2.4": 0.80,
                "3.1": 0.78, "3.2": 0.74, "3.3": 0.70, "3.4": 0.66,
                "4.1": 0.64, "4.2": 0.60, "4.3": 0.58, "4.4": 0.56,
                "5.1": 0.52, "5.2": 0.44, "5.3": 0.46, "5.4": 0.36,
            },
            "quiz_accuracy": 0.90, "total_hours": 52.5, "task_completion": 0.93,
        },
        {
            "id": "stu_020", "name": "乔可欣", "avatar": "乔",
            "major": "计算机科学", "grade": "大二",
            "current_stage": "函数与模块",
            "knowledge_level": "有一定基础",
            "weak_points": ["函数定义与调用"],
            "learning_preference": ["实践型", "视觉型"],
            "daily_time": 58, "streak_days": 6,
            "risk_level": "normal",
            "last_active": _days_ago(1),
            "mastery": {
                "1.1": 0.84, "1.2": 0.80, "1.3": 0.76, "1.4": 0.72, "1.5": 0.70,
                "2.1": 0.60, "2.2": 0.56, "2.3": 0.52, "2.4": 0.50,
                "3.1": 0.34, "3.2": 0.24, "3.3": 0.20, "3.4": 0.12,
            },
            "quiz_accuracy": 0.73, "total_hours": 20.5, "task_completion": 0.71,
        },
    ]


def _build_students() -> list[dict[str, Any]]:
    """合并真实用户 + 模拟学生"""
    students: list[dict[str, Any]] = []

    # 真实用户
    real_profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    real_student = fetch_one("SELECT * FROM students WHERE user_id = ?", (settings.single_user_id,))
    real_mastery_rows = fetch_all(
        "SELECT knowledge_point_id, score FROM mastery_records WHERE user_id = ?",
        (settings.single_user_id,),
    )
    real_mastery = {str(r["knowledge_point_id"]): float(r["score"]) for r in real_mastery_rows}
    real_contrib = fetch_all(
        "SELECT count FROM contribution_days WHERE user_id = ? ORDER BY date DESC LIMIT 30",
        (settings.single_user_id,),
    )
    streak = 0
    for row in real_contrib:
        if row["count"] > 0:
            streak += 1
        else:
            break

    if real_student and real_profile:
        weak = json.loads(real_profile["weak_points"] or "[]")
        pref = json.loads(real_profile["learning_preference"] or "[]")
        risk = "normal"
        if streak == 0:
            risk = "warning"
        name = real_student["name"] or "张同学"
        students.append({
            "id": settings.single_user_id,
            "name": name,
            "avatar": name[0],
            "major": real_student["major"] or "计算机科学",
            "grade": real_student["grade"] or "大二",
            "current_stage": real_profile["current_stage"] or "函数与模块",
            "knowledge_level": real_profile["knowledge_level"] or "有一定基础",
            "weak_points": weak,
            "learning_preference": pref,
            "daily_time": real_profile["daily_time"] or 60,
            "streak_days": streak,
            "risk_level": risk,
            "last_active": _days_ago(0) if streak > 0 else _days_ago(3),
            "mastery": real_mastery,
            "quiz_accuracy": 0.75,
            "total_hours": round(sum(r["count"] for r in real_contrib) * 0.5, 1),
            "task_completion": 0.72,
        })

    students.extend(_mock_students())
    return students


# ─── API 路由 ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard():
    """大屏聚合数据"""
    students = _build_students()
    total = len(students)
    today = date.today().isoformat()
    active_today = sum(1 for s in students if s["last_active"] == today)

    # 各知识点全班平均掌握度
    kp_acc: dict[str, list[float]] = {}
    for s in students:
        for kp_id, score in s["mastery"].items():
            kp_acc.setdefault(kp_id, []).append(score)
    kp_mastery = {k: round(sum(v) / len(v), 3) for k, v in kp_acc.items()}

    # 阶段分布
    stage_dist: dict[str, int] = {}
    for s in students:
        stage_dist[s["current_stage"]] = stage_dist.get(s["current_stage"], 0) + 1

    # 各阶段平均掌握度
    stage_mastery = []
    for stage, kp_ids in _STAGE_KPS.items():
        scores = [kp_mastery.get(k, 0.0) for k in kp_ids if k in kp_mastery]
        avg = round(sum(scores) / len(scores), 3) if scores else 0.0
        stage_mastery.append({
            "stage": stage,
            "avg_mastery": avg,
            "student_count": stage_dist.get(stage, 0),
        })

    # 全班最弱知识点 TOP10
    weak_kps = sorted(
        [{"id": k, "name": _KP_NAMES.get(k, k), "avg_mastery": v} for k, v in kp_mastery.items()],
        key=lambda x: x["avg_mastery"],
    )[:10]

    # 近7天活跃趋势
    activity_trend = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        cnt = sum(1 for s in students if s["last_active"] >= d)
        activity_trend.append({"date": d, "active_count": min(cnt, total)})

    # 风险学生
    risk_students = [
        {
            "id": s["id"], "name": s["name"], "avatar": s["avatar"],
            "risk_level": s["risk_level"],
            "last_active": s["last_active"],
            "current_stage": s["current_stage"],
            "weak_points": s["weak_points"][:2],
            "streak_days": s["streak_days"],
        }
        for s in students if s["risk_level"] in ("warning", "danger")
    ]

    return ok({
        "summary": {
            "total_students": total,
            "active_today": active_today,
            "active_rate": round(active_today / total, 3),
            "avg_quiz_accuracy": round(sum(s["quiz_accuracy"] for s in students) / total, 3),
            "avg_total_hours": round(sum(s["total_hours"] for s in students) / total, 1),
            "avg_task_completion": round(sum(s["task_completion"] for s in students) / total, 3),
            "avg_streak_days": round(sum(s["streak_days"] for s in students) / total, 1),
            "risk_count": len(risk_students),
        },
        "stage_distribution": [
            {"stage": s, "count": stage_dist.get(s, 0)} for s in _STAGE_ORDER
        ],
        "stage_mastery": stage_mastery,
        "kp_mastery": kp_mastery,
        "kp_names": _KP_NAMES,
        "weak_kps": weak_kps,
        "activity_trend": activity_trend,
        "risk_students": risk_students,
        "students": [
            {
                "id": s["id"], "name": s["name"], "avatar": s["avatar"],
                "current_stage": s["current_stage"],
                "risk_level": s["risk_level"],
                "quiz_accuracy": s["quiz_accuracy"],
                "total_hours": s["total_hours"],
                "streak_days": s["streak_days"],
                "task_completion": s["task_completion"],
                "last_active": s["last_active"],
            }
            for s in students
        ],
    })


@router.get("/students")
async def get_students():
    return ok(_build_students())


@router.get("/students/{student_id}")
async def get_student(student_id: str):
    students = _build_students()
    student = next((s for s in students if s["id"] == student_id), None)
    if not student:
        return fail("学生不存在")
    return ok(student)


class AIDiagnoseReq(BaseModel):
    student_id: str


@router.post("/ai/diagnose")
async def ai_diagnose(req: AIDiagnoseReq):
    """AI 一句话诊断学生"""
    students = _build_students()
    student = next((s for s in students if s["id"] == req.student_id), None)
    if not student:
        return ok({"diagnosis": "未找到该学生数据。"})

    weak = "、".join(student["weak_points"][:3]) if student["weak_points"] else "暂无"
    prompt = (
        f"你是编程教师助手。用1-2句话给出最关键的教学建议，只输出建议文字。\n"
        f"学生：{student['name']}，阶段：{student['current_stage']}，"
        f"薄弱点：{weak}，正确率：{int(student['quiz_accuracy']*100)}%，"
        f"连续学习：{student['streak_days']}天，风险：{student['risk_level']}。"
    )
    parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    parts.append(chunk)
    except Exception:
        pass

    diagnosis = "".join(parts).strip()
    if not diagnosis:
        risk = student["risk_level"]
        if risk == "danger":
            diagnosis = f"{student['name']}已多天未学习，建议立即联系，重点补强{weak}。"
        elif risk == "warning":
            diagnosis = f"{student['name']}进展偏慢，{weak}掌握不足，建议安排专项练习。"
        else:
            diagnosis = f"{student['name']}整体良好，可在{weak}方向进一步强化。"

    return ok({"student_id": req.student_id, "name": student["name"], "diagnosis": diagnosis})


@router.post("/ai/daily-report")
async def ai_daily_report():
    """AI 班级日报"""
    students = _build_students()
    total = len(students)
    today = date.today().isoformat()
    active = sum(1 for s in students if s["last_active"] == today)
    danger = [s["name"] for s in students if s["risk_level"] == "danger"]
    warning = [s["name"] for s in students if s["risk_level"] == "warning"]
    avg_acc = round(sum(s["quiz_accuracy"] for s in students) / total * 100)

    prompt = (
        f"你是编程课教师助手。生成今日班级学习日报（100字以内），语气专业亲切，重点突出问题。\n"
        f"班级{total}人，今日活跃{active}人，平均正确率{avg_acc}%，"
        f"高风险：{','.join(danger) if danger else '无'}，"
        f"预警：{','.join(warning) if warning else '无'}。"
    )
    parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    parts.append(chunk)
    except Exception:
        pass

    report = "".join(parts).strip()
    if not report:
        report = (
            f"今日{active}/{total}人活跃，班级平均答题正确率{avg_acc}%。"
            + (f"需重点关注：{'、'.join(danger)}，已连续多天未登录。" if danger else "")
            + (f"建议跟进：{'、'.join(warning)}，学习进度偏慢。" if warning else "")
        )

    return ok({"date": today, "report": report, "active": active, "total": total})
