"""
Shared report service module.

Extracted from tutor_eval.py to avoid circular imports between
learning.py and tutor_eval.py.
"""

from ..schemas import ok


async def get_evaluation_report(period: str = 'week'):
    """Generate evaluation report data for the given period."""
    period_map = {
        'week': ('本周', 12.5, 0.78, 0.85, 12, [('04-10', 2.0), ('04-11', 1.5), ('04-12', 2.5)]),
        'day': ('今日', 1.2, 0.82, 0.80, 12, [('08:00', 0.2), ('12:00', 0.3), ('20:00', 0.7)]),
        'month': ('本月', 28.0, 0.76, 0.71, 12, [('第1周', 6.5), ('第2周', 7.0), ('第3周', 6.2), ('第4周', 8.3)]),
    }
    label, hours, completion, accuracy, streak, daily = period_map.get(period, period_map['week'])
    return ok(
        {
            'period': label,
            'stats': {'total_hours': hours, 'task_completion_rate': completion, 'quiz_accuracy': accuracy, 'streak_days': streak},
            'daily_hours': [{'date': d, 'hours': h} for d, h in daily],
            'time_distribution': [
                {'category': '视频学习', 'minutes': 120},
                {'category': '练习题', 'minutes': 90},
                {'category': '阅读讲义', 'minutes': 60},
                {'category': '代码实践', 'minutes': 80},
            ],
            'weak_points': [{'name': '闭包', 'score': 0.45}, {'name': '装饰器', 'score': 0.38}, {'name': '类与继承', 'score': 0.30}],
            'ai_summary': f'{label}你在基础语法上进步明显，函数返回值和作用域仍是主要卡点，建议先看补弱资源再做达标题。',
            'recommended_actions': ['回看函数返回值讲义', '完成8道补弱练习', '确认下一阶段路径'],
            'profile_update_suggestions': ['将"函数返回值"标记为当前薄弱点', '提高实践型学习偏好权重'],
            'path_adjustment_suggestions': ['模块导入节点延后', '函数与作用域节点保持当前优先级'],
        }
    )
