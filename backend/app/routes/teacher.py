"""
教师端大屏数据 API
提供班级聚合数据、学生列表、知识点掌握分布等供大屏消费
"""
from __future__ import annotations

import csv
import io
import json
import uuid
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import settings
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok
from ..storage import read_json

router = APIRouter(prefix="/api/teacher", tags=["teacher"])
student_class_router = APIRouter(prefix="/api/classes", tags=["classes"])


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
            "major": real_student["major"] or "Python",
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
        f"你是学科教师助手。生成今日班级学习日报（100字以内），语气专业亲切，重点突出问题。\n"
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


def _teacher_material_dir() -> Path:
    base = settings.data_dir / "users" / settings.single_user_id / "teacher" / "materials"
    base.mkdir(parents=True, exist_ok=True)
    return base


class TeacherBroadcastCreateReq(BaseModel):
    title: str
    content: str
    target_type: str = "all"  # all | specific | class
    student_ids: list[str] = []
    class_ids: list[int] = []
    material_file_ids: list[int] = []


class TeacherSubjectReq(BaseModel):
    name: str
    code: str = ""
    description: str = ""
    enabled: bool = True


class TeacherSubjectImportReq(BaseModel):
    items: list[TeacherSubjectReq]


class TeacherClassReq(BaseModel):
    name: str
    subject_id: int = 0
    subject_name: str = ""
    grade: str = ""
    description: str = ""
    status: str = "active"


class TeacherClassMemberImportReq(BaseModel):
    student_ids: list[str] = []
    phones: list[str] = []


class StudentJoinClassReq(BaseModel):
    invite_code: str


def _safe_json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(str(value))
    except Exception:
        return default


def _class_row(row: Any, member_count: int | None = None) -> dict[str, Any]:
    class_id = int(row["id"])
    if member_count is None:
        count_row = fetch_one(
            "SELECT COUNT(1) AS cnt FROM teacher_class_members WHERE class_id = ? AND status = 'active'",
            (class_id,),
        )
        member_count = int(count_row["cnt"] if count_row else 0)
    return {
        "id": class_id,
        "user_id": str(row["user_id"]),
        "name": str(row["name"] or ""),
        "subject_id": int(row["subject_id"] or 0),
        "subject_name": str(row["subject_name"] or ""),
        "grade": str(row["grade"] or ""),
        "description": str(row["description"] or ""),
        "invite_code": str(row["invite_code"] or ""),
        "status": str(row["status"] or "active"),
        "member_count": member_count,
        "active_member_count": member_count,
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


def _generate_invite_code() -> str:
    for _ in range(20):
        code = uuid.uuid4().hex[:8].upper()
        if not fetch_one("SELECT id FROM teacher_classes WHERE invite_code = ?", (code,)):
            return code
    raise HTTPException(status_code=500, detail="failed to generate invite code")


def _get_owned_class(class_id: int) -> Any:
    row = fetch_one(
        "SELECT * FROM teacher_classes WHERE id = ? AND user_id = ? AND status != 'archived'",
        (class_id, settings.single_user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="class not found")
    return row


def _student_identity(user_id: str) -> dict[str, str]:
    row = fetch_one("SELECT * FROM students WHERE user_id = ?", (user_id,))
    if not row:
        return {"id": user_id, "name": user_id, "phone": "", "major": "", "grade": "", "avatar": user_id[:1].upper()}
    name = str(row["name"] or user_id)
    return {
        "id": user_id,
        "name": name,
        "phone": str(row["phone"] if "phone" in row.keys() and row["phone"] else ""),
        "major": str(row["major"] or ""),
        "grade": str(row["grade"] or ""),
        "avatar": str(row["avatar"] if "avatar" in row.keys() and row["avatar"] else name[:1]),
    }


def _student_learning_summary(user_id: str) -> dict[str, Any]:
    identity = _student_identity(user_id)
    profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    mastery_rows = fetch_all(
        "SELECT knowledge_point_id, knowledge_point_name, score FROM mastery_records WHERE user_id = ?",
        (user_id,),
    )
    contrib_rows = fetch_all(
        "SELECT date, count FROM contribution_days WHERE user_id = ? ORDER BY date DESC LIMIT 30",
        (user_id,),
    )
    quiz_records = read_json(user_id, "quiz_records.json", [])
    tasks = read_json(user_id, "task_progress.json", [])

    total_tasks = len(tasks) if isinstance(tasks, list) else 0
    done_tasks = len([item for item in tasks if isinstance(item, dict) and item.get("done")]) if isinstance(tasks, list) else 0
    task_completion = round(done_tasks / total_tasks, 2) if total_tasks else 0.0

    quiz_accuracy = 0.0
    if isinstance(quiz_records, list) and quiz_records:
        ratios: list[float] = []
        for item in quiz_records:
            if not isinstance(item, dict):
                continue
            total = int(item.get("total") or len(item.get("questions", []) or []) or 0)
            correct = int(item.get("correct") or item.get("correct_count") or 0)
            if total > 0:
                ratios.append(correct / total)
        if ratios:
            quiz_accuracy = round(sum(ratios) / len(ratios), 2)

    mastery = {
        str(row["knowledge_point_id"]): float(row["score"])
        for row in mastery_rows
    }
    weak_points = []
    if profile:
        weak_points = _safe_json(profile["weak_points"], [])
    if not weak_points and mastery_rows:
        weak_points = [
            str(row["knowledge_point_name"])
            for row in sorted(mastery_rows, key=lambda item: float(item["score"]))[:3]
        ]

    last_active = str(contrib_rows[0]["date"]) if contrib_rows else ""
    streak = 0
    for row in contrib_rows:
        if int(row["count"] or 0) > 0:
            streak += 1
        else:
            break

    risk_level = "normal"
    if task_completion and task_completion < 0.45 or quiz_accuracy and quiz_accuracy < 0.5 or streak == 0:
        risk_level = "danger"
    elif task_completion and task_completion < 0.7 or quiz_accuracy and quiz_accuracy < 0.7 or streak < 3:
        risk_level = "warning"

    return {
        **identity,
        "current_stage": str(profile["current_stage"] or "") if profile else "",
        "knowledge_level": str(profile["knowledge_level"] or "") if profile else "",
        "weak_points": weak_points,
        "learning_preference": _safe_json(profile["learning_preference"], []) if profile else [],
        "daily_time": int(profile["daily_time"] or 60) if profile else 60,
        "streak_days": streak,
        "risk_level": risk_level,
        "last_active": last_active,
        "mastery": mastery,
        "quiz_accuracy": quiz_accuracy,
        "total_hours": round(sum(int(row["count"] or 0) for row in contrib_rows) * 0.5, 1),
        "task_completion": task_completion,
    }


def _upsert_class_member(conn: Any, class_id: int, student_id: str, source: str) -> bool:
    identity = _student_identity(student_id)
    existing = conn.execute(
        "SELECT id, status FROM teacher_class_members WHERE class_id = ? AND student_id = ?",
        (class_id, student_id),
    ).fetchone()
    ts = now_iso()
    if existing:
        conn.execute(
            """
            UPDATE teacher_class_members
            SET display_name = ?, phone = ?, source = ?, status = 'active', updated_at = ?
            WHERE id = ?
            """,
            (identity["name"], identity["phone"], source, ts, int(existing["id"])),
        )
        return str(existing["status"]) != "active"
    conn.execute(
        """
        INSERT INTO teacher_class_members(class_id, student_id, display_name, phone, source, status, joined_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
        """,
        (class_id, student_id, identity["name"], identity["phone"], source, ts, ts),
    )
    return True


def _decode_text_payload(payload: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue
    return payload.decode("utf-8", errors="ignore")


def _flatten_json_values(value: Any) -> list[str]:
    if isinstance(value, dict):
        items: list[str] = []
        for child in value.values():
            items.extend(_flatten_json_values(child))
        return items
    if isinstance(value, list):
        items = []
        for child in value:
            items.extend(_flatten_json_values(child))
        return items
    if value is None:
        return []
    return [str(value)]


def _split_identifier_text(text: str) -> list[str]:
    raw = text.replace("\ufeff", " ")
    for sep in ["，", "；", ";", "\t", "\r", "\n", ",", "|"]:
        raw = raw.replace(sep, " ")
    return [item.strip() for item in raw.split() if item.strip()]


def _extract_xlsx_values(payload: bytes) -> list[str]:
    values: list[str] = []
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.iter():
                if item.tag.endswith("}t") and item.text:
                    shared_strings.append(item.text)

        sheet_names = [
            name
            for name in archive.namelist()
            if name.startswith("xl/worksheets/") and name.endswith(".xml")
        ]
        for sheet_name in sheet_names:
            root = ElementTree.fromstring(archive.read(sheet_name))
            for cell in root.iter():
                if not cell.tag.endswith("}c"):
                    continue
                cell_type = cell.attrib.get("t")
                text = ""
                if cell_type == "inlineStr":
                    text = " ".join(node.text or "" for node in cell.iter() if node.tag.endswith("}t")).strip()
                else:
                    value_node = next((node for node in cell if node.tag.endswith("}v")), None)
                    if value_node is not None and value_node.text is not None:
                        text = value_node.text.strip()
                        if cell_type == "s":
                            try:
                                text = shared_strings[int(text)]
                            except Exception:
                                pass
                if text:
                    values.append(text)
    return values


def _extract_identifiers_from_file(filename: str, payload: bytes) -> list[str]:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".xlsx", ".xlsm"}:
        return _extract_xlsx_values(payload)
    text = _decode_text_payload(payload)
    if suffix == ".json":
        try:
            return _flatten_json_values(json.loads(text))
        except Exception:
            return _split_identifier_text(text)
    if suffix in {".csv", ".tsv"}:
        delimiter = "\t" if suffix == ".tsv" else ","
        values: list[str] = []
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        for row in reader:
            values.extend(row)
        return values
    return _split_identifier_text(text)


def _import_class_members_by_identifiers(class_id: int, identifiers: list[str], source: str) -> dict[str, Any]:
    normalized = list(dict.fromkeys(item.strip() for item in identifiers if item and item.strip()))
    if not normalized:
        return {"added_count": 0, "skipped_count": 0, "added": [], "skipped": []}

    added: list[str] = []
    skipped: list[str] = []
    with get_conn() as conn:
        for token in normalized:
            rows = conn.execute(
                """
                SELECT user_id FROM students
                WHERE user_id = ? OR phone = ? OR email = ?
                ORDER BY user_id ASC
                """,
                (token, token, token),
            ).fetchall()
            if not rows:
                skipped.append(token)
                continue
            for row in rows:
                student_id = str(row["user_id"])
                changed = _upsert_class_member(conn, class_id, student_id, source)
                if changed:
                    added.append(student_id)
                else:
                    skipped.append(token)

    added_unique = list(dict.fromkeys(added))
    skipped_unique = list(dict.fromkeys(skipped))
    return {
        "added_count": len(added_unique),
        "skipped_count": len(skipped_unique),
        "added": added_unique,
        "skipped": skipped_unique,
    }


def _material_rows(material_ids: list[int]) -> list[dict[str, Any]]:
    if not material_ids:
        return []
    placeholders = ",".join(["?"] * len(material_ids))
    rows = fetch_all(
        f"SELECT id, filename, mime_type, size_bytes, created_at FROM teacher_material_files WHERE id IN ({placeholders})",
        tuple(material_ids),
    )
    return [
        {
            "id": int(row["id"]),
            "filename": row["filename"],
            "mime_type": row["mime_type"],
            "size_bytes": int(row["size_bytes"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def _subject_row(row: Any) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": str(row["name"]),
        "code": str(row["code"] or ""),
        "description": str(row["description"] or ""),
        "enabled": bool(row["enabled"]),
        "sort_order": int(row["sort_order"] or 0),
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


@router.get("/subjects")
async def list_teacher_subjects(enabled_only: bool = False):
    if enabled_only:
        rows = fetch_all(
            """
            SELECT * FROM teacher_subjects
            WHERE user_id = ? AND enabled = 1 AND COALESCE(deleted, 0) = 0
            ORDER BY sort_order ASC, id ASC
            """,
            (settings.single_user_id,),
        )
    else:
        rows = fetch_all(
            """
            SELECT * FROM teacher_subjects
            WHERE user_id = ? AND COALESCE(deleted, 0) = 0
            ORDER BY sort_order ASC, id ASC
            """,
            (settings.single_user_id,),
        )
    return ok([_subject_row(row) for row in rows])


@router.post("/subjects")
async def create_teacher_subject(req: TeacherSubjectReq):
    name = req.name.strip()
    code = req.code.strip()
    description = req.description.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    existing = fetch_one(
        "SELECT * FROM teacher_subjects WHERE user_id = ? AND name = ?",
        (settings.single_user_id, name),
    )
    if existing:
        if int(existing["deleted"] or 0) == 0:
            raise HTTPException(status_code=400, detail="subject already exists")
        execute(
            """
            UPDATE teacher_subjects
            SET code = ?, description = ?, enabled = ?, deleted = 0, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                code,
                description,
                1 if req.enabled else 0,
                now_iso(),
                int(existing["id"]),
                settings.single_user_id,
            ),
        )
        restored = fetch_one("SELECT * FROM teacher_subjects WHERE id = ? AND user_id = ?", (int(existing["id"]), settings.single_user_id))
        return ok(_subject_row(restored))

    ts = now_iso()
    max_row = fetch_one(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM teacher_subjects WHERE user_id = ?",
        (settings.single_user_id,),
    )
    sort_order = int(max_row["max_order"] if max_row else 0) + 1
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO teacher_subjects(
                user_id, name, code, description, enabled, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.single_user_id,
                name,
                code,
                description,
                1 if req.enabled else 0,
                sort_order,
                ts,
                ts,
            ),
        )
        row = conn.execute("SELECT * FROM teacher_subjects WHERE id = last_insert_rowid()").fetchone()
    return ok(_subject_row(row))


@router.put("/subjects/{subject_id}")
async def update_teacher_subject(subject_id: int, req: TeacherSubjectReq):
    subject = fetch_one(
        "SELECT * FROM teacher_subjects WHERE id = ? AND user_id = ? AND COALESCE(deleted, 0) = 0",
        (subject_id, settings.single_user_id),
    )
    if not subject:
        raise HTTPException(status_code=404, detail="subject not found")

    name = req.name.strip()
    code = req.code.strip()
    description = req.description.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    duplicated = fetch_one(
        """
        SELECT id FROM teacher_subjects
        WHERE user_id = ? AND name = ? AND id != ? AND COALESCE(deleted, 0) = 0
        """,
        (settings.single_user_id, name, subject_id),
    )
    if duplicated:
        raise HTTPException(status_code=400, detail="subject already exists")

    execute(
        """
        UPDATE teacher_subjects
        SET name = ?, code = ?, description = ?, enabled = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            name,
            code,
            description,
            1 if req.enabled else 0,
            now_iso(),
            subject_id,
            settings.single_user_id,
        ),
    )
    row = fetch_one("SELECT * FROM teacher_subjects WHERE id = ? AND user_id = ?", (subject_id, settings.single_user_id))
    return ok(_subject_row(row))


@router.delete("/subjects/{subject_id}")
async def delete_teacher_subject(subject_id: int):
    subject = fetch_one(
        "SELECT id FROM teacher_subjects WHERE id = ? AND user_id = ? AND COALESCE(deleted, 0) = 0",
        (subject_id, settings.single_user_id),
    )
    if not subject:
        raise HTTPException(status_code=404, detail="subject not found")
    execute(
        """
        UPDATE teacher_subjects
        SET enabled = 0, deleted = 1, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (now_iso(), subject_id, settings.single_user_id),
    )
    return ok({"deleted": True, "id": subject_id})


@router.post("/subjects/import")
async def import_teacher_subjects(req: TeacherSubjectImportReq):
    created = []
    skipped = []
    ts = now_iso()
    with get_conn() as conn:
        existing_names = {
            str(row["name"])
            for row in conn.execute(
                "SELECT name FROM teacher_subjects WHERE user_id = ?",
                (settings.single_user_id,),
            ).fetchall()
        }
        max_row = conn.execute(
            "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM teacher_subjects WHERE user_id = ?",
            (settings.single_user_id,),
        ).fetchone()
        sort_order = int(max_row["max_order"] if max_row else 0)

        for item in req.items:
            name = item.name.strip()
            if not name or name in existing_names:
                if name:
                    skipped.append(name)
                continue
            sort_order += 1
            conn.execute(
                """
                INSERT INTO teacher_subjects(
                    user_id, name, code, description, enabled, sort_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    settings.single_user_id,
                    name,
                    item.code.strip(),
                    item.description.strip(),
                    1 if item.enabled else 0,
                    sort_order,
                    ts,
                    ts,
                ),
            )
            existing_names.add(name)
            created.append(name)

    return ok(
        {
            "created_count": len(created),
            "skipped_count": len(skipped),
            "created": created,
            "skipped": skipped,
        }
    )


@router.get("/classes")
async def list_teacher_classes(include_archived: bool = False):
    if include_archived:
        rows = fetch_all(
            """
            SELECT c.*, COUNT(CASE WHEN m.status = 'active' THEN 1 END) AS member_count
            FROM teacher_classes c
            LEFT JOIN teacher_class_members m ON m.class_id = c.id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.status ASC, c.updated_at DESC
            """,
            (settings.single_user_id,),
        )
    else:
        rows = fetch_all(
            """
            SELECT c.*, COUNT(CASE WHEN m.status = 'active' THEN 1 END) AS member_count
            FROM teacher_classes c
            LEFT JOIN teacher_class_members m ON m.class_id = c.id
            WHERE c.user_id = ? AND c.status != 'archived'
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            """,
            (settings.single_user_id,),
        )
    return ok([_class_row(row, int(row["member_count"] or 0)) for row in rows])


@router.post("/classes")
async def create_teacher_class(req: TeacherClassReq):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    status = req.status if req.status in {"active", "paused"} else "active"
    ts = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO teacher_classes(
              user_id, name, subject_id, subject_name, grade, description, invite_code, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.single_user_id,
                name,
                int(req.subject_id or 0),
                req.subject_name.strip(),
                req.grade.strip(),
                req.description.strip(),
                _generate_invite_code(),
                status,
                ts,
                ts,
            ),
        )
        row = conn.execute("SELECT * FROM teacher_classes WHERE id = last_insert_rowid()").fetchone()
    return ok(_class_row(row, 0))


@router.put("/classes/{class_id}")
async def update_teacher_class(class_id: int, req: TeacherClassReq):
    _get_owned_class(class_id)
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    status = req.status if req.status in {"active", "paused", "archived"} else "active"
    execute(
        """
        UPDATE teacher_classes
        SET name = ?, subject_id = ?, subject_name = ?, grade = ?, description = ?, status = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            name,
            int(req.subject_id or 0),
            req.subject_name.strip(),
            req.grade.strip(),
            req.description.strip(),
            status,
            now_iso(),
            class_id,
            settings.single_user_id,
        ),
    )
    row = fetch_one("SELECT * FROM teacher_classes WHERE id = ? AND user_id = ?", (class_id, settings.single_user_id))
    return ok(_class_row(row))


@router.delete("/classes/{class_id}")
async def archive_teacher_class(class_id: int):
    _get_owned_class(class_id)
    execute(
        "UPDATE teacher_classes SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?",
        (now_iso(), class_id, settings.single_user_id),
    )
    return ok({"archived": True, "id": class_id})


@router.post("/classes/{class_id}/invite-code")
async def regenerate_teacher_class_invite_code(class_id: int):
    _get_owned_class(class_id)
    code = _generate_invite_code()
    execute(
        "UPDATE teacher_classes SET invite_code = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (code, now_iso(), class_id, settings.single_user_id),
    )
    row = fetch_one("SELECT * FROM teacher_classes WHERE id = ? AND user_id = ?", (class_id, settings.single_user_id))
    return ok(_class_row(row))


@router.get("/classes/{class_id}/members")
async def list_teacher_class_members(class_id: int):
    _get_owned_class(class_id)
    rows = fetch_all(
        """
        SELECT * FROM teacher_class_members
        WHERE class_id = ? AND status = 'active'
        ORDER BY joined_at DESC
        """,
        (class_id,),
    )
    items = []
    for row in rows:
        summary = _student_learning_summary(str(row["student_id"]))
        items.append(
            {
                **summary,
                "member_id": int(row["id"]),
                "class_id": class_id,
                "source": str(row["source"] or "invite"),
                "joined_at": str(row["joined_at"]),
            }
        )
    return ok(items)


@router.post("/classes/{class_id}/members/import")
async def import_teacher_class_members(class_id: int, req: TeacherClassMemberImportReq):
    _get_owned_class(class_id)
    identifiers = [item.strip() for item in [*req.student_ids, *req.phones] if item.strip()]
    return ok(_import_class_members_by_identifiers(class_id, identifiers, "teacher"))


@router.post("/classes/{class_id}/members/import-file")
async def import_teacher_class_members_file(class_id: int, files: list[UploadFile] = File(...)):
    _get_owned_class(class_id)
    if not files:
        raise HTTPException(status_code=400, detail="files are required")

    supported = {".xlsx", ".xlsm", ".csv", ".tsv", ".txt", ".json", ".md", ".log"}
    identifiers: list[str] = []
    skipped_files: list[str] = []
    for file in files:
        filename = file.filename or "students.txt"
        suffix = Path(filename).suffix.lower()
        payload = await file.read()
        if suffix not in supported:
            skipped_files.append(filename)
            continue
        try:
            identifiers.extend(_extract_identifiers_from_file(filename, payload))
        except Exception:
            skipped_files.append(filename)

    result = _import_class_members_by_identifiers(class_id, identifiers, "file")
    return ok(
        {
            **result,
            "file_count": len(files),
            "parsed_count": len(list(dict.fromkeys(item.strip() for item in identifiers if item and item.strip()))),
            "skipped_files": skipped_files,
            "supported_extensions": sorted(supported),
        }
    )


@router.delete("/classes/{class_id}/members/{student_id}")
async def remove_teacher_class_member(class_id: int, student_id: str):
    _get_owned_class(class_id)
    execute(
        """
        UPDATE teacher_class_members
        SET status = 'removed', updated_at = ?
        WHERE class_id = ? AND student_id = ?
        """,
        (now_iso(), class_id, student_id),
    )
    return ok({"removed": True, "student_id": student_id})


@student_class_router.get("/my")
async def list_my_classes(current_user: dict = Depends(get_current_user)):
    rows = fetch_all(
        """
        SELECT c.*, m.joined_at
        FROM teacher_class_members m
        JOIN teacher_classes c ON c.id = m.class_id
        WHERE m.student_id = ? AND m.status = 'active' AND c.status = 'active'
        ORDER BY m.joined_at DESC
        """,
        (current_user["user_id"],),
    )
    return ok([{**_class_row(row), "joined_at": str(row["joined_at"])} for row in rows])


@student_class_router.post("/join")
async def join_class(req: StudentJoinClassReq, current_user: dict = Depends(get_current_user)):
    code = req.invite_code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="invite_code is required")
    class_row = fetch_one(
        "SELECT * FROM teacher_classes WHERE invite_code = ? AND status = 'active'",
        (code,),
    )
    if not class_row:
        raise HTTPException(status_code=404, detail="class not found")
    class_id = int(class_row["id"])
    with get_conn() as conn:
        _upsert_class_member(conn, class_id, current_user["user_id"], "invite")
    row = fetch_one("SELECT * FROM teacher_classes WHERE id = ?", (class_id,))
    return ok(_class_row(row))


@student_class_router.delete("/my/{class_id}")
async def leave_class(class_id: int, current_user: dict = Depends(get_current_user)):
    execute(
        """
        UPDATE teacher_class_members
        SET status = 'removed', updated_at = ?
        WHERE class_id = ? AND student_id = ?
        """,
        (now_iso(), class_id, current_user["user_id"]),
    )
    return ok({"left": True, "id": class_id})


@student_class_router.get("/broadcasts")
async def list_my_class_broadcasts(class_id: int | None = None, current_user: dict = Depends(get_current_user)):
    params: list[Any] = [current_user["user_id"]]
    class_join = ""
    if class_id is not None:
        class_join = """
        JOIN teacher_class_members m ON m.student_id = d.student_id
          AND m.class_id = ?
          AND m.status = 'active'
        """
        params = [class_id, current_user["user_id"]]

    rows = fetch_all(
        f"""
        SELECT b.*, d.read_at, d.delivered_at
        FROM broadcast_deliveries d
        JOIN teacher_broadcasts b ON b.id = d.broadcast_id
        {class_join}
        WHERE d.student_id = ?
        ORDER BY b.created_at DESC
        """,
        tuple(params),
    )
    items = []
    for row in rows:
        material_ids = _safe_json(row["material_file_ids"], [])
        target_class_ids = _safe_json(row["target_class_ids"], [])
        if class_id is not None and (row["target_type"] != "class" or class_id not in target_class_ids):
            continue
        items.append(
            {
                "id": int(row["id"]),
                "title": row["title"],
                "content": row["content"],
                "target_type": row["target_type"],
                "target_student_ids": _safe_json(row["target_student_ids"], []),
                "target_class_ids": target_class_ids,
                "material_file_ids": material_ids,
                "materials": _material_rows(material_ids),
                "created_at": row["created_at"],
                "delivered_at": row["delivered_at"],
                "read_at": row["read_at"],
            }
        )
    return ok(items)


@student_class_router.post("/broadcasts/{broadcast_id}/read")
async def mark_my_class_broadcast_read(broadcast_id: int, current_user: dict = Depends(get_current_user)):
    execute(
        """
        UPDATE broadcast_deliveries
        SET read_at = COALESCE(read_at, ?)
        WHERE broadcast_id = ? AND student_id = ?
        """,
        (now_iso(), broadcast_id, current_user["user_id"]),
    )
    return ok({"read": True, "id": broadcast_id})


@router.get("/broadcast/recipients")
async def list_broadcast_recipients(class_id: int | None = None):
    if class_id is not None:
        _get_owned_class(class_id)
        rows = fetch_all(
            "SELECT student_id FROM teacher_class_members WHERE class_id = ? AND status = 'active' ORDER BY joined_at DESC",
            (class_id,),
        )
        return ok([
            {
                "id": summary["id"],
                "name": summary["name"],
                "grade": summary["grade"],
                "major": summary["major"],
            }
            for summary in (_student_learning_summary(str(row["student_id"])) for row in rows)
        ])
    students = _build_students()
    return ok([{"id": s["id"], "name": s["name"], "grade": s["grade"], "major": s["major"]} for s in students])


@router.post("/broadcast/materials")
async def upload_broadcast_materials(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="files are required")

    created = []
    base_dir = _teacher_material_dir()
    ts = now_iso()
    with get_conn() as conn:
        for file in files:
            raw_name = (file.filename or "material.bin").replace("\n", "").replace("\r", "").strip()
            safe_name = "".join(ch if ch not in '\\/:*?"<>|' else "_" for ch in raw_name)[:120] or "material.bin"
            payload = await file.read()
            stored_name = f"{ts.replace(':', '').replace('.', '')}_{safe_name}"
            stored_path = base_dir / stored_name
            stored_path.write_bytes(payload)

            conn.execute(
                """
                INSERT INTO teacher_material_files(user_id, filename, stored_path, mime_type, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    settings.single_user_id,
                    safe_name,
                    str(stored_path),
                    file.content_type or "application/octet-stream",
                    len(payload),
                    ts,
                ),
            )
            row = conn.execute("SELECT * FROM teacher_material_files WHERE id = last_insert_rowid()").fetchone()
            created.append(
                {
                    "id": int(row["id"]),
                    "filename": row["filename"],
                    "mime_type": row["mime_type"],
                    "size_bytes": int(row["size_bytes"]),
                    "created_at": row["created_at"],
                }
            )
    return ok(created)


@router.get("/broadcast/materials")
async def list_broadcast_materials():
    rows = fetch_all(
        "SELECT id, filename, mime_type, size_bytes, created_at FROM teacher_material_files WHERE user_id = ? ORDER BY id DESC",
        (settings.single_user_id,),
    )
    return ok(
        [
            {
                "id": int(r["id"]),
                "filename": r["filename"],
                "mime_type": r["mime_type"],
                "size_bytes": int(r["size_bytes"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    )


@router.get("/broadcast/materials/{file_id}/download")
async def download_broadcast_material(file_id: int):
    row = fetch_one(
        "SELECT id, filename, stored_path, mime_type FROM teacher_material_files WHERE id = ? AND user_id = ?",
        (file_id, settings.single_user_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail="material not found")
    path = Path(str(row["stored_path"]))
    if not path.exists():
        raise HTTPException(status_code=404, detail="material file missing")
    return FileResponse(path=str(path), filename=str(row["filename"]), media_type=str(row["mime_type"] or "application/octet-stream"))


@router.post("/broadcasts")
async def create_broadcast(req: TeacherBroadcastCreateReq):
    title = req.title.strip()
    content = req.content.strip()
    target_type = (req.target_type or "all").strip()

    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    if target_type not in {"all", "specific", "class"}:
        raise HTTPException(status_code=400, detail="invalid target_type")
    if target_type == "specific" and not req.student_ids:
        raise HTTPException(status_code=400, detail="student_ids required when target_type is specific")
    if target_type == "class" and not req.class_ids:
        raise HTTPException(status_code=400, detail="class_ids required when target_type is class")

    all_student_ids = {s["id"] for s in _build_students()}
    if target_type == "specific":
        invalid = [sid for sid in req.student_ids if sid not in all_student_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"invalid student_ids: {', '.join(invalid)}")
        target_student_ids = list(dict.fromkeys(req.student_ids))
    elif target_type == "class":
        placeholders = ",".join(["?"] * len(req.class_ids))
        rows = fetch_all(
            f"""
            SELECT id FROM teacher_classes
            WHERE id IN ({placeholders}) AND user_id = ? AND status = 'active'
            """,
            tuple(req.class_ids + [settings.single_user_id]),
        )
        found_ids = {int(row["id"]) for row in rows}
        invalid_classes = [str(cid) for cid in req.class_ids if cid not in found_ids]
        if invalid_classes:
            raise HTTPException(status_code=400, detail=f"invalid class_ids: {', '.join(invalid_classes)}")
        member_rows = fetch_all(
            f"""
            SELECT DISTINCT student_id FROM teacher_class_members
            WHERE class_id IN ({placeholders}) AND status = 'active'
            """,
            tuple(req.class_ids),
        )
        target_student_ids = [str(row["student_id"]) for row in member_rows]
        if not target_student_ids:
            raise HTTPException(status_code=400, detail="selected classes have no members")
    else:
        target_student_ids = list(all_student_ids)

    ts = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO teacher_broadcasts(
                user_id, title, content, target_type, target_student_ids, target_class_ids, material_file_ids, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.single_user_id,
                title,
                content,
                target_type,
                json.dumps(target_student_ids if target_type != "all" else [], ensure_ascii=False),
                json.dumps(req.class_ids if target_type == "class" else [], ensure_ascii=False),
                json.dumps(req.material_file_ids, ensure_ascii=False),
                ts,
            ),
        )
        row = conn.execute("SELECT * FROM teacher_broadcasts WHERE id = last_insert_rowid()").fetchone()
        for student_id in target_student_ids:
            existing = conn.execute(
                "SELECT id FROM broadcast_deliveries WHERE broadcast_id = ? AND student_id = ?",
                (int(row["id"]), student_id),
            ).fetchone()
            if not existing:
                conn.execute(
                    """
                    INSERT INTO broadcast_deliveries(broadcast_id, student_id, delivered_at)
                    VALUES (?, ?, ?)
                    """,
                    (int(row["id"]), student_id, ts),
                )

    return ok(
        {
            "id": int(row["id"]),
            "title": row["title"],
            "content": row["content"],
            "target_type": row["target_type"],
            "target_student_ids": json.loads(row["target_student_ids"] or "[]"),
            "target_class_ids": json.loads(row["target_class_ids"] or "[]"),
            "material_file_ids": json.loads(row["material_file_ids"] or "[]"),
            "materials": _material_rows(json.loads(row["material_file_ids"] or "[]")),
            "created_at": row["created_at"],
        }
    )


@router.get("/broadcasts")
async def list_broadcasts():
    rows = fetch_all(
        "SELECT * FROM teacher_broadcasts WHERE user_id = ? ORDER BY id DESC",
        (settings.single_user_id,),
    )
    items = []
    for row in rows:
        mids = json.loads(row["material_file_ids"] or "[]")
        materials = _material_rows(mids)
        items.append(
            {
                "id": int(row["id"]),
                "title": row["title"],
                "content": row["content"],
                "target_type": row["target_type"],
                "target_student_ids": json.loads(row["target_student_ids"] or "[]"),
                "target_class_ids": json.loads(row["target_class_ids"] or "[]"),
                "material_file_ids": mids,
                "materials": materials,
                "created_at": row["created_at"],
            }
        )
    return ok(items)
