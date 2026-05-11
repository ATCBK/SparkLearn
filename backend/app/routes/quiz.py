from __future__ import annotations

import json
import re
import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json

router = APIRouter(prefix='/api/quiz', tags=['quiz'])


class SubmitReq(BaseModel):
    quiz_id: str
    answer: str | list[str]


class FavoriteReq(BaseModel):
    quiz_id: str
    favorite: bool = True


_DEFAULT_QUIZ_SET = [
    # 单选题 - 数据类型 (5题)
    {'id': 'q1', 'type': 'single', 'content': '以下哪个是 Python 的可变数据类型？', 'options': ['tuple', 'list', 'string', 'int'], 'correct_answer': 'list', 'explanation': 'list 是可变类型，可以修改其元素。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q2', 'type': 'single', 'content': 'Python 中哪个数据类型是不可变的？', 'options': ['list', 'dict', 'tuple', 'set'], 'correct_answer': 'tuple', 'explanation': 'tuple 是不可变的序列类型。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q3', 'type': 'single', 'content': '字典（dict）中的键必须是什么类型？', 'options': ['任何类型', '可哈希的不可变类型', '字符串', '整数'], 'correct_answer': '可哈希的不可变类型', 'explanation': '字典的键必须是可哈希的不可变类型，如字符串、数字、元组等。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q4', 'type': 'single', 'content': '集合（set）中的元素有什么特点？', 'options': ['有序且可重复', '无序且不可重复', '有序且不可重复', '无序且可重复'], 'correct_answer': '无序且不可重复', 'explanation': '集合中的元素是无序的，且不允许重复。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q5', 'type': 'single', 'content': '以下哪个函数可以获取对象的类型？', 'options': ['isinstance()', 'type()', 'len()', 'id()'], 'correct_answer': 'type()', 'explanation': 'type() 函数返回对象的类型。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    
    # 单选题 - 函数 (5题)
    {'id': 'q6', 'type': 'single', 'content': 'Python 中用于定义函数的关键字是？', 'options': ['function', 'def', 'func', 'define'], 'correct_answer': 'def', 'explanation': 'Python 使用 def 关键字定义函数。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    {'id': 'q7', 'type': 'single', 'content': '函数中 return 语句的作用是什么？', 'options': ['结束程序', '返回值并退出函数', '打印结果', '声明变量'], 'correct_answer': '返回值并退出函数', 'explanation': 'return 语句用于返回函数的结果值并退出函数。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    {'id': 'q8', 'type': 'single', 'content': '以下哪个是函数的默认参数？', 'options': ['def func(a, b=5):', 'def func(a=5, b):', 'def func(a, b):', 'def func(a=5, b=10):'], 'correct_answer': 'def func(a, b=5):', 'explanation': '默认参数必须在非默认参数之后。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    {'id': 'q9', 'type': 'single', 'content': '函数中 *args 的作用是什么？', 'options': ['接收关键字参数', '接收可变数量的位置参数', '接收单个参数', '接收列表参数'], 'correct_answer': '接收可变数量的位置参数', 'explanation': '*args 用于接收任意数量的位置参数，作为元组存储。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    {'id': 'q10', 'type': 'single', 'content': '函数中 **kwargs 的作用是什么？', 'options': ['接收位置参数', '接收可变数量的关键字参数', '接收单个参数', '接收字典参数'], 'correct_answer': '接收可变数量的关键字参数', 'explanation': '**kwargs 用于接收任意数量的关键字参数，作为字典存储。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    
    # 单选题 - 循环 (5题)
    {'id': 'q11', 'type': 'single', 'content': 'for 循环中 range(5) 会生成什么？', 'options': ['0到5', '0到4', '1到5', '1到4'], 'correct_answer': '0到4', 'explanation': 'range(5) 生成 0, 1, 2, 3, 4。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    {'id': 'q12', 'type': 'single', 'content': 'break 语句的作用是什么？', 'options': ['跳过当前迭代', '退出循环', '暂停循环', '重新开始循环'], 'correct_answer': '退出循环', 'explanation': 'break 语句用于立即退出循环。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    {'id': 'q13', 'type': 'single', 'content': 'continue 语句的作用是什么？', 'options': ['退出循环', '跳过当前迭代', '暂停循环', '重新开始循环'], 'correct_answer': '跳过当前迭代', 'explanation': 'continue 语句用于跳过当前迭代，继续下一次迭代。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    {'id': 'q14', 'type': 'single', 'content': 'while 循环和 for 循环的主要区别是什么？', 'options': ['while 更快', 'for 用于已知次数，while 用于条件判断', '没有区别', 'while 只能用于列表'], 'correct_answer': 'for 用于已知次数，while 用于条件判断', 'explanation': 'for 循环通常用于遍历序列，while 循环用于条件判断。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    {'id': 'q15', 'type': 'single', 'content': 'enumerate() 函数的作用是什么？', 'options': ['计数', '获取索引和值', '排序', '过滤'], 'correct_answer': '获取索引和值', 'explanation': 'enumerate() 返回索引和对应的值。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    
    # 单选题 - 条件判断 (5题)
    {'id': 'q16', 'type': 'single', 'content': 'if 语句中 elif 的作用是什么？', 'options': ['结束条件', '否则', '否则如果', '重复条件'], 'correct_answer': '否则如果', 'explanation': 'elif 用于检查多个条件。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q17', 'type': 'single', 'content': '以下哪个是 Python 中的逻辑运算符？', 'options': ['&', '|', 'and', '&&'], 'correct_answer': 'and', 'explanation': 'Python 使用 and、or、not 作为逻辑运算符。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q18', 'type': 'single', 'content': '三元表达式的语法是什么？', 'options': ['a if b else c', 'if b then a else c', 'b ? a : c', 'a unless b else c'], 'correct_answer': 'a if b else c', 'explanation': 'Python 的三元表达式格式为 a if condition else b。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q19', 'type': 'single', 'content': '以下哪个值在 Python 中被认为是 False？', 'options': ['1', '[]', 'True', '"0"'], 'correct_answer': '[]', 'explanation': '空列表、空字符串、0、None 等被认为是 False。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q20', 'type': 'single', 'content': 'not 运算符的作用是什么？', 'options': ['逻辑与', '逻辑或', '逻辑非', '比较'], 'correct_answer': '逻辑非', 'explanation': 'not 运算符用于逻辑非操作。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    
    # 单选题 - 列表操作 (5题)
    {'id': 'q21', 'type': 'single', 'content': '列表的 append() 方法的作用是什么？', 'options': ['删除元素', '添加元素到末尾', '插入元素', '排序'], 'correct_answer': '添加元素到末尾', 'explanation': 'append() 方法将元素添加到列表的末尾。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q22', 'type': 'single', 'content': '列表的 insert() 方法需要几个参数？', 'options': ['1个', '2个', '3个', '可变'], 'correct_answer': '2个', 'explanation': 'insert(index, value) 需要索引和值两个参数。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q23', 'type': 'single', 'content': '列表的 remove() 方法和 pop() 方法的区别是什么？', 'options': ['没有区别', 'remove 按值删除，pop 按索引删除', 'pop 按值删除，remove 按索引删除', 'remove 返回值，pop 不返回'], 'correct_answer': 'remove 按值删除，pop 按索引删除', 'explanation': 'remove(value) 按值删除，pop(index) 按索引删除并返回该元素。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q24', 'type': 'single', 'content': '列表切片 list[1:3] 会返回什么？', 'options': ['第1和第3个元素', '第1到第3个元素', '第2和第3个元素', '第2到第4个元素'], 'correct_answer': '第2和第3个元素', 'explanation': '切片 [1:3] 返回索引 1 和 2 的元素（不包括 3）。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q25', 'type': 'single', 'content': '列表的 sort() 方法会改变原列表吗？', 'options': ['不会', '会', '取决于参数', '取决于列表大小'], 'correct_answer': '会', 'explanation': 'sort() 方法会原地排序列表，改变原列表。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    
    # 多选题 (15题)
    {'id': 'q26', 'type': 'multiple', 'content': '以下哪些是 Python 内置数据类型？', 'options': ['list', 'dict', 'array', 'set'], 'correct_answer': ['list', 'dict', 'set'], 'explanation': 'list、dict、set 是内置类型，array 需要导入 array 模块。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q27', 'type': 'multiple', 'content': '以下哪些是可变数据类型？', 'options': ['list', 'tuple', 'dict', 'string'], 'correct_answer': ['list', 'dict'], 'explanation': 'list 和 dict 是可变的，tuple 和 string 是不可变的。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q28', 'type': 'multiple', 'content': '以下哪些是不可变数据类型？', 'options': ['list', 'tuple', 'string', 'dict'], 'correct_answer': ['tuple', 'string'], 'explanation': 'tuple 和 string 是不可变的。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q29', 'type': 'multiple', 'content': '以下哪些方法可以用于字符串？', 'options': ['upper()', 'lower()', 'append()', 'sort()'], 'correct_answer': ['upper()', 'lower()'], 'explanation': 'upper() 和 lower() 是字符串方法，append() 和 sort() 是列表方法。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q30', 'type': 'multiple', 'content': '以下哪些是函数的特点？', 'options': ['可重用', '可接收参数', '必须有返回值', '可以嵌套'], 'correct_answer': ['可重用', '可接收参数', '可以嵌套'], 'explanation': '函数可重用、可接收参数、可嵌套，但不一定有返回值。', 'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义'},
    {'id': 'q31', 'type': 'multiple', 'content': '以下哪些是循环控制语句？', 'options': ['break', 'continue', 'pass', 'return'], 'correct_answer': ['break', 'continue', 'pass'], 'explanation': 'break、continue、pass 是循环控制语句，return 是函数返回语句。', 'knowledge_point_id': '2.1', 'knowledge_point_name': '循环语句'},
    {'id': 'q32', 'type': 'multiple', 'content': '以下哪些是列表的方法？', 'options': ['append()', 'extend()', 'add()', 'insert()'], 'correct_answer': ['append()', 'extend()', 'insert()'], 'explanation': 'append()、extend()、insert() 是列表方法，add() 是集合方法。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q33', 'type': 'multiple', 'content': '以下哪些是字典的方法？', 'options': ['keys()', 'values()', 'items()', 'append()'], 'correct_answer': ['keys()', 'values()', 'items()'], 'explanation': 'keys()、values()、items() 是字典方法，append() 是列表方法。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q34', 'type': 'multiple', 'content': '以下哪些是集合的方法？', 'options': ['add()', 'remove()', 'union()', 'append()'], 'correct_answer': ['add()', 'remove()', 'union()'], 'explanation': 'add()、remove()、union() 是集合方法，append() 是列表方法。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q35', 'type': 'multiple', 'content': '以下哪些操作会改变原列表？', 'options': ['sort()', 'reverse()', 'append()', 'sorted()'], 'correct_answer': ['sort()', 'reverse()', 'append()'], 'explanation': 'sort()、reverse()、append() 会改变原列表，sorted() 返回新列表。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q36', 'type': 'multiple', 'content': '以下哪些是字符串的方法？', 'options': ['split()', 'join()', 'replace()', 'append()'], 'correct_answer': ['split()', 'join()', 'replace()'], 'explanation': 'split()、join()、replace() 是字符串方法，append() 是列表方法。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q37', 'type': 'multiple', 'content': '以下哪些是条件判断中的逻辑运算符？', 'options': ['and', 'or', 'not', '&'], 'correct_answer': ['and', 'or', 'not'], 'explanation': 'and、or、not 是逻辑运算符，& 是位运算符。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q38', 'type': 'multiple', 'content': '以下哪些是比较运算符？', 'options': ['==', '!=', '>', '<'], 'correct_answer': ['==', '!=', '>', '<'], 'explanation': '这些都是比较运算符。', 'knowledge_point_id': '2.2', 'knowledge_point_name': '条件判断'},
    {'id': 'q39', 'type': 'multiple', 'content': '以下哪些是赋值运算符？', 'options': ['=', '+=', '-=', '=='], 'correct_answer': ['=', '+=', '-='], 'explanation': '=、+=、-= 是赋值运算符，== 是比较运算符。', 'knowledge_point_id': '1.1', 'knowledge_point_name': '基础语法'},
    {'id': 'q40', 'type': 'multiple', 'content': '以下哪些是算术运算符？', 'options': ['+', '-', '*', '=='], 'correct_answer': ['+', '-', '*'], 'explanation': '+、-、* 是算术运算符，== 是比较运算符。', 'knowledge_point_id': '1.1', 'knowledge_point_name': '基础语法'},
    
    # 填空题 (10题)
    {'id': 'q41', 'type': 'fill_blank', 'content': '在 Python 中，使用 ______ 关键字来导入模块。', 'correct_answer': 'import', 'explanation': 'import 用于导入模块。', 'knowledge_point_id': '1.1', 'knowledge_point_name': '基础语法'},
    {'id': 'q42', 'type': 'fill_blank', 'content': '列表的 ______ 方法可以获取元素的索引。', 'correct_answer': 'index', 'explanation': 'index() 方法返回指定元素的索引。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q43', 'type': 'fill_blank', 'content': '字符串的 ______ 方法可以将字符串转换为大写。', 'correct_answer': 'upper', 'explanation': 'upper() 方法将字符串转换为大写。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q44', 'type': 'fill_blank', 'content': '字典的 ______ 方法可以获取所有的键。', 'correct_answer': 'keys', 'explanation': 'keys() 方法返回字典的所有键。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q45', 'type': 'fill_blank', 'content': '集合的 ______ 方法可以添加元素。', 'correct_answer': 'add', 'explanation': 'add() 方法向集合添加元素。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q46', 'type': 'fill_blank', 'content': '列表的 ______ 方法可以删除指定索引的元素。', 'correct_answer': 'pop', 'explanation': 'pop() 方法删除并返回指定索引的元素。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q47', 'type': 'fill_blank', 'content': '字符串的 ______ 方法可以将字符串分割成列表。', 'correct_answer': 'split', 'explanation': 'split() 方法将字符串分割成列表。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q48', 'type': 'fill_blank', 'content': '列表的 ______ 方法可以反转列表。', 'correct_answer': 'reverse', 'explanation': 'reverse() 方法反转列表中的元素顺序。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    {'id': 'q49', 'type': 'fill_blank', 'content': '字典的 ______ 方法可以获取指定键的值，如果键不存在则返回默认值。', 'correct_answer': 'get', 'explanation': 'get() 方法安全地获取字典值，避免 KeyError。', 'knowledge_point_id': '1.2', 'knowledge_point_name': '数据类型'},
    {'id': 'q50', 'type': 'fill_blank', 'content': '列表的 ______ 方法可以清空列表中的所有元素。', 'correct_answer': 'clear', 'explanation': 'clear() 方法删除列表中的所有元素。', 'knowledge_point_id': '1.3', 'knowledge_point_name': '列表操作'},
    
    # 额外的单选题 - 字符串处理 (10题)
    {'id': 'q51', 'type': 'single', 'content': '字符串的 find() 方法返回什么？', 'options': ['字符串长度', '子字符串的索引', '布尔值', '字符数'], 'correct_answer': '子字符串的索引', 'explanation': 'find() 返回子字符串第一次出现的索引，如果不存在返回 -1。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q52', 'type': 'single', 'content': '字符串的 startswith() 方法的作用是什么？', 'options': ['获取长度', '检查是否以指定字符串开头', '替换字符串', '分割字符串'], 'correct_answer': '检查是否以指定字符串开头', 'explanation': 'startswith() 检查字符串是否以指定字符串开头，返回布尔值。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q53', 'type': 'single', 'content': '字符串的 strip() 方法的作用是什么？', 'options': ['转换大小写', '删除两端空格', '替换字符', '分割字符串'], 'correct_answer': '删除两端空格', 'explanation': 'strip() 删除字符串两端的空格和换行符。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q54', 'type': 'single', 'content': '字符串的 count() 方法的作用是什么？', 'options': ['获取长度', '计算子字符串出现次数', '查找位置', '替换字符'], 'correct_answer': '计算子字符串出现次数', 'explanation': 'count() 返回子字符串在字符串中出现的次数。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q55', 'type': 'single', 'content': '字符串的 isdigit() 方法的作用是什么？', 'options': ['检查是否为字母', '检查是否全为数字', '检查是否为空', '检查长度'], 'correct_answer': '检查是否全为数字', 'explanation': 'isdigit() 检查字符串是否全由数字组成。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q56', 'type': 'single', 'content': '字符串的 isalpha() 方法的作用是什么？', 'options': ['检查是否为数字', '检查是否全为字母', '检查是否为空', '检查长度'], 'correct_answer': '检查是否全为字母', 'explanation': 'isalpha() 检查字符串是否全由字母组成。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q57', 'type': 'single', 'content': '字符串的 format() 方法的作用是什么？', 'options': ['转换大小写', '格式化字符串', '分割字符串', '替换字符'], 'correct_answer': '格式化字符串', 'explanation': 'format() 用于格式化字符串，替换占位符。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q58', 'type': 'single', 'content': '字符串的 center() 方法的作用是什么？', 'options': ['左对齐', '右对齐', '居中对齐', '删除空格'], 'correct_answer': '居中对齐', 'explanation': 'center() 将字符串居中对齐，用指定字符填充。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q59', 'type': 'single', 'content': '字符串的 swapcase() 方法的作用是什么？', 'options': ['转换为大写', '转换为小写', '交换大小写', '删除空格'], 'correct_answer': '交换大小写', 'explanation': 'swapcase() 将大写字母转为小写，小写转为大写。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    {'id': 'q60', 'type': 'single', 'content': '字符串的 title() 方法的作用是什么？', 'options': ['转换为大写', '转换为小写', '每个单词首字母大写', '删除空格'], 'correct_answer': '每个单词首字母大写', 'explanation': 'title() 将每个单词的首字母转为大写。', 'knowledge_point_id': '1.4', 'knowledge_point_name': '字符串处理'},
    
    # 额外的单选题 - 异常处理 (10题)
    {'id': 'q61', 'type': 'single', 'content': 'Python 中用于捕获异常的关键字是？', 'options': ['catch', 'try', 'except', 'handle'], 'correct_answer': 'except', 'explanation': 'Python 使用 try-except 语句捕获异常。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q62', 'type': 'single', 'content': 'try-except-finally 中 finally 的作用是什么？', 'options': ['捕获异常', '处理异常', '无论是否异常都执行', '结束程序'], 'correct_answer': '无论是否异常都执行', 'explanation': 'finally 块中的代码无论是否发生异常都会执行。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q63', 'type': 'single', 'content': '以下哪个是 Python 的内置异常？', 'options': ['CustomError', 'ValueError', 'MyError', 'UnknownError'], 'correct_answer': 'ValueError', 'explanation': 'ValueError 是 Python 的内置异常，表示值错误。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q64', 'type': 'single', 'content': 'IndexError 异常表示什么？', 'options': ['值错误', '索引超出范围', '键不存在', '类型错误'], 'correct_answer': '索引超出范围', 'explanation': 'IndexError 表示列表或序列的索引超出范围。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q65', 'type': 'single', 'content': 'KeyError 异常表示什么？', 'options': ['值错误', '索引超出范围', '字典键不存在', '类型错误'], 'correct_answer': '字典键不存在', 'explanation': 'KeyError 表示字典中访问的键不存在。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q66', 'type': 'single', 'content': 'TypeError 异常表示什么？', 'options': ['值错误', '索引超出范围', '类型不匹配', '键不存在'], 'correct_answer': '类型不匹配', 'explanation': 'TypeError 表示操作或函数应用于不适当类型的对象。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q67', 'type': 'single', 'content': 'ZeroDivisionError 异常表示什么？', 'options': ['值错误', '除以零', '索引超出范围', '类型错误'], 'correct_answer': '除以零', 'explanation': 'ZeroDivisionError 表示除数为零。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q68', 'type': 'single', 'content': 'raise 语句的作用是什么？', 'options': ['捕获异常', '抛出异常', '处理异常', '忽略异常'], 'correct_answer': '抛出异常', 'explanation': 'raise 语句用于主动抛出异常。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q69', 'type': 'single', 'content': '以下哪个是自定义异常的正确方式？', 'options': ['class MyError(Exception):', 'class MyError(Error):', 'class MyError(BaseException):', 'class MyError(object):'], 'correct_answer': 'class MyError(Exception):', 'explanation': '自定义异常应该继承 Exception 类。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    {'id': 'q70', 'type': 'single', 'content': 'AttributeError 异常表示什么？', 'options': ['值错误', '属性不存在', '索引超出范围', '类型错误'], 'correct_answer': '属性不存在', 'explanation': 'AttributeError 表示对象没有指定的属性。', 'knowledge_point_id': '4.1', 'knowledge_point_name': '异常处理'},
    
    # 额外的单选题 - 文件操作 (10题)
    {'id': 'q71', 'type': 'single', 'content': 'open() 函数的第二个参数是什么？', 'options': ['文件名', '打开模式', '编码方式', '缓冲大小'], 'correct_answer': '打开模式', 'explanation': 'open() 的第二个参数指定文件打开模式，如 r、w、a 等。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q72', 'type': 'single', 'content': '文件打开模式 "r" 表示什么？', 'options': ['写入', '读取', '追加', '二进制'], 'correct_answer': '读取', 'explanation': '"r" 模式表示以读取模式打开文件。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q73', 'type': 'single', 'content': '文件打开模式 "w" 表示什么？', 'options': ['读取', '写入', '追加', '二进制'], 'correct_answer': '写入', 'explanation': '"w" 模式表示以写入模式打开文件，会覆盖原内容。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q74', 'type': 'single', 'content': '文件打开模式 "a" 表示什么？', 'options': ['读取', '写入', '追加', '二进制'], 'correct_answer': '追加', 'explanation': '"a" 模式表示以追加模式打开文件，在末尾添加内容。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q75', 'type': 'single', 'content': 'read() 方法的作用是什么？', 'options': ['写入文件', '读取整个文件', '读取一行', '关闭文件'], 'correct_answer': '读取整个文件', 'explanation': 'read() 方法读取文件的全部内容。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q76', 'type': 'single', 'content': 'readline() 方法的作用是什么？', 'options': ['写入文件', '读取整个文件', '读取一行', '关闭文件'], 'correct_answer': '读取一行', 'explanation': 'readline() 方法读取文件的一行。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q77', 'type': 'single', 'content': 'readlines() 方法的作用是什么？', 'options': ['写入文件', '读取整个文件', '读取所有行作为列表', '关闭文件'], 'correct_answer': '读取所有行作为列表', 'explanation': 'readlines() 方法读取文件的所有行，返回列表。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q78', 'type': 'single', 'content': 'write() 方法的作用是什么？', 'options': ['读取文件', '写入字符串', '读取一行', '关闭文件'], 'correct_answer': '写入字符串', 'explanation': 'write() 方法将字符串写入文件。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q79', 'type': 'single', 'content': 'close() 方法的作用是什么？', 'options': ['打开文件', '读取文件', '关闭文件', '删除文件'], 'correct_answer': '关闭文件', 'explanation': 'close() 方法关闭文件，释放资源。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
    {'id': 'q80', 'type': 'single', 'content': 'with 语句的作用是什么？', 'options': ['条件判断', '自动管理文件资源', '循环', '异常处理'], 'correct_answer': '自动管理文件资源', 'explanation': 'with 语句自动打开和关闭文件，确保资源正确释放。', 'knowledge_point_id': '5.1', 'knowledge_point_name': '文件操作'},
]


@router.get('')
async def get_quiz(chapter: str | None = None, count: int = 4, use_llm: bool = False):
    """
    获取练习题目
    
    参数：
    - chapter: 章节/主题（可选）
    - count: 题目数量（1-50，默认4）
    - use_llm: 是否使用 LLM 生成（默认 False，使用预设题库）
    """
    print(f"DEBUG: get_quiz called with chapter={chapter}, count={count}, use_llm={use_llm}")
    requested_count = max(1, min(count, 50))
    batch_id = uuid.uuid4().hex[:8]
    print(f"DEBUG: requested_count={requested_count}, batch_id={batch_id}")

    # 策略：优先使用预设题库，只在明确要求时才使用 LLM
    quiz_set = None
    
    if use_llm:
        # 用户明确要求使用 LLM 生成
        print(f"DEBUG: User requested LLM generation")
        generated = await _generate_quiz_with_llm(chapter, requested_count, batch_id)
        quiz_set = generated
    
    # 如果 LLM 生成失败或未使用，使用预设题库
    if not quiz_set:
        print(f"DEBUG: Using default quiz set")
        quiz_set = _build_default_batch(requested_count, batch_id)
    
    print(f"DEBUG: quiz_set generated with {len(quiz_set)} questions")

    write_json(settings.single_user_id, 'latest_quiz_set.json', quiz_set)
    print(f"DEBUG: quiz_set written to JSON")
    
    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {'type': 'quiz_generated', 'count': len(quiz_set), 'chapter': chapter or '', 'batch_id': batch_id, 'use_llm': use_llm},
    )
    print(f"DEBUG: learning event appended")

    slim = [
        {
            'id': q['id'],
            'type': q['type'],
            'content': q['content'],
            'options': q.get('options'),
            'correct_answer': q.get('correct_answer'),
            'explanation': q.get('explanation', ''),
            'knowledge_point_id': q.get('knowledge_point_id', ''),
            'knowledge_point_name': q.get('knowledge_point_name', ''),
        }
        for q in quiz_set[:requested_count]
    ]
    print(f"DEBUG: slim list created with {len(slim)} items")
    return ok(slim)


@router.post('/submit')
async def submit_quiz(req: SubmitReq):
    """
    提交答案并判题
    """
    quiz_set = _latest_quiz_set()
    target = next((q for q in quiz_set if q['id'] == req.quiz_id), None) or quiz_set[0]

    print(f"DEBUG: Submitting answer for quiz_id={req.quiz_id}, answer={req.answer}")
    
    # 第1步：规则判题
    rule_correct = _is_correct_rule(target, req.answer)
    print(f"DEBUG: Rule-based judge result: {rule_correct}")
    
    # 第2步：如果规则判题失败，尝试 LLM 辅助判题（仅填空题）
    llm_judge = None
    if not rule_correct and target.get('type') == 'fill_blank':
        print(f"DEBUG: Rule judge failed, trying LLM assist for fill_blank question")
        llm_judge = await _judge_with_llm(target, req.answer)
    
    # 第3步：确定最终判题结果
    correct = rule_correct
    judge_mode = 'rule'
    
    if not rule_correct and llm_judge is not None:
        # LLM 认为正确且置信度高
        if bool(llm_judge.get('correct', False)) and float(llm_judge.get('confidence', 0.0)) >= 0.8:
            correct = True
            judge_mode = 'llm_assist'
            print(f"DEBUG: LLM assist changed result to correct")

    # 第4步：构建解析
    explanation = str(target.get('explanation', '')).strip()
    if llm_judge and llm_judge.get('reason'):
        explanation = f"{explanation} {str(llm_judge.get('reason')).strip()}".strip()

    # 第5步：保存答题记录
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    records.append(
        {
            'quiz_id': req.quiz_id,
            'answer': req.answer,
            'correct': correct,
            'correct_answer': target['correct_answer'],
            'knowledge_point_id': target['knowledge_point_id'],
            'judge_mode': judge_mode,
            'question': {
                'id': target['id'],
                'type': target['type'],
                'content': target['content'],
                'options': target.get('options'),
                'explanation': target.get('explanation', ''),
                'knowledge_point_id': target.get('knowledge_point_id', ''),
                'knowledge_point_name': target.get('knowledge_point_name', ''),
            },
            'at': date.today().isoformat(),
        }
    )
    write_json(settings.single_user_id, 'quiz_records.json', records)

    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {'type': 'submit_quiz', 'quiz_id': req.quiz_id, 'correct': correct, 'judge_mode': judge_mode},
    )

    # 第6步：更新掌握度
    _update_mastery(target['knowledge_point_id'], 0.05 if correct else -0.03)
    mastery_row = fetch_one(
        'SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?',
        (settings.single_user_id, target['knowledge_point_id']),
    )

    print(f"DEBUG: Final result - correct={correct}, judge_mode={judge_mode}, mastery={mastery_row['score'] if mastery_row else 0.5}")

    return ok(
        {
            'quiz_id': req.quiz_id,
            'correct': correct,
            'correct_answer': target['correct_answer'],
            'explanation': explanation,
            'knowledge_point_id': target['knowledge_point_id'],
            'mastery_delta': 0.05 if correct else -0.03,
            'current_mastery': mastery_row['score'] if mastery_row else 0.5,
            'judge_mode': judge_mode,
        }
    )


@router.get('/records')
async def get_quiz_records():
    """
    获取所有答题记录
    """
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    if not isinstance(records, list):
        records = []
    
    # 按时间倒序排列
    records = sorted(records, key=lambda r: r.get('at', ''), reverse=True)
    
    return ok(records)


@router.get('/records/stats')
async def get_quiz_records_stats():
    """
    获取答题统计
    """
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    if not isinstance(records, list):
        records = []
    
    total = len(records)
    correct = sum(1 for r in records if bool(r.get('correct', False)))
    wrong = total - correct
    accuracy = (correct / total * 100) if total > 0 else 0
    
    return ok({
        'total': total,
        'correct': correct,
        'wrong': wrong,
        'accuracy': round(accuracy, 2),
    })


@router.delete('/records/{quiz_id}')
async def delete_quiz_record(quiz_id: str):
    """
    删除特定的答题记录
    """
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    if not isinstance(records, list):
        records = []
    
    before = len(records)
    filtered = [r for r in records if str(r.get('quiz_id', '')) != quiz_id]
    after = len(filtered)
    removed = before - after
    
    write_json(settings.single_user_id, 'quiz_records.json', filtered)
    
    return ok({'quiz_id': quiz_id, 'removed_count': removed})
async def get_wrong_quiz():
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    wrong = [r for r in records if not r.get('correct', False)]

    grouped: dict[str, dict[str, Any]] = {}
    for item in wrong:
        quiz_id = str(item.get('quiz_id', ''))
        question = item.get('question') if isinstance(item.get('question'), dict) else {}
        grouped.setdefault(
            quiz_id,
            {
                'quiz_id': quiz_id,
                'content': str(question.get('content', '题目已失效')),
                'question': question,
                'user_answer': item.get('answer'),
                'correct_answer': item.get('correct_answer'),
                'count': 0,
                'variant_quizzes': [f'{quiz_id}_v1', f'{quiz_id}_v2'],
            },
        )
        grouped[quiz_id]['count'] += 1

    return ok(list(grouped.values()))


@router.delete('/wrong/{quiz_id}')
async def delete_wrong_quiz(quiz_id: str):
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    if not isinstance(records, list):
        records = []

    before = len(records)
    filtered = [r for r in records if not (str(r.get('quiz_id', '')) == quiz_id and not bool(r.get('correct', False)))]
    after = len(filtered)
    removed = before - after

    write_json(settings.single_user_id, 'quiz_records.json', filtered)
    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {'type': 'delete_wrong_quiz', 'quiz_id': quiz_id, 'removed_count': removed},
    )
    return ok({'quiz_id': quiz_id, 'removed_count': removed})


@router.get('/favorites')
async def get_favorites():
    favorites = read_json(settings.single_user_id, 'quiz_favorites.json', [])
    if not isinstance(favorites, list):
        favorites = []
    return ok(favorites)


@router.post('/favorites')
async def set_favorite(req: FavoriteReq):
    favorites = read_json(settings.single_user_id, 'quiz_favorites.json', [])
    if not isinstance(favorites, list):
        favorites = []

    existing_index = next((i for i, item in enumerate(favorites) if str(item.get('quiz_id')) == req.quiz_id), None)

    if req.favorite:
        if existing_index is None:
            question = _find_question_snapshot(req.quiz_id)
            favorites.append(
                {
                    'quiz_id': req.quiz_id,
                    'question': question,
                    'created_at': date.today().isoformat(),
                }
            )
    else:
        if existing_index is not None:
            favorites.pop(existing_index)

    write_json(settings.single_user_id, 'quiz_favorites.json', favorites)
    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {'type': 'quiz_favorite', 'quiz_id': req.quiz_id, 'favorite': req.favorite},
    )

    return ok({'quiz_id': req.quiz_id, 'favorite': req.favorite})


def _find_question_snapshot(quiz_id: str) -> dict[str, Any]:
    latest = _latest_quiz_set()
    from_latest = next((q for q in latest if str(q.get('id')) == quiz_id), None)
    if from_latest:
        return {
            'id': from_latest.get('id', ''),
            'type': from_latest.get('type', 'single'),
            'content': from_latest.get('content', ''),
            'options': from_latest.get('options'),
            'explanation': from_latest.get('explanation', ''),
            'knowledge_point_id': from_latest.get('knowledge_point_id', ''),
            'knowledge_point_name': from_latest.get('knowledge_point_name', ''),
        }

    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    for item in reversed(records if isinstance(records, list) else []):
        if str(item.get('quiz_id')) == quiz_id and isinstance(item.get('question'), dict):
            return item['question']

    return {'id': quiz_id, 'type': 'single', 'content': '题目内容暂不可用', 'options': None, 'explanation': ''}


async def _generate_quiz_with_llm(chapter: str | None, count: int, batch_id: str) -> list[dict[str, Any]] | None:
    import asyncio
    
    chapter_text = chapter or 'Python 基础'
    context = _build_personalized_quiz_context()
    
    # 计算题型分布
    single_count = max(1, count // 2)
    multiple_count = max(0, count // 3)
    fill_blank_count = count - single_count - multiple_count
    
    prompt = (
        '你是个性化题库引擎。请基于用户画像和作答轨迹，实时生成一组新题。'
        '必须输出严格 JSON 数组，不要任何额外文本。\n'
        f'要求：共 {count} 题，其中单选题 {single_count} 道、多选题 {multiple_count} 道、填空题 {fill_blank_count} 道。\n'
        '字段必须有：type, content, options(填空可省略), correct_answer, explanation, knowledge_point_id, knowledge_point_name。\n'
        '约束：\n'
        '1) 题目必须多样化，不要重复相同的题干或考点；\n'
        '2) 每道题考察不同的知识点或不同的难度；\n'
        '3) 难度要符合用户当前水平（' + context.get('difficulty_band', 'balanced') + '），错题相关考点优先；\n'
        '4) 题目要能直接用于自动判题，答案明确、唯一；\n'
        '5) 语言简洁，避免歧义；\n'
        '6) 单选题和多选题的选项要有明显区别，不要太相似。\n'
        f'主题：{chapter_text}\n'
        f'用户上下文：{json.dumps(context, ensure_ascii=False)}\n'
        '请确保生成的题目多样化、有趣、符合用户水平。'
    )
    
    # 添加重试机制（最多 2 次）
    max_retries = 2
    for attempt in range(max_retries):
        try:
            # 添加超时保护（3秒）
            text = await asyncio.wait_for(_collect_llm_text(prompt), timeout=3.0)
            
            if not text:
                print(f"DEBUG: LLM returned empty text on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    continue
                return None

            raw_list = _extract_json_list(text)
            if not raw_list:
                print(f"DEBUG: Failed to extract JSON list from LLM response on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    continue
                return None

            result: list[dict[str, Any]] = []
            for i, raw in enumerate(raw_list[:count], start=1):
                normalized = _normalize_question(raw, i, batch_id)
                if normalized:
                    result.append(normalized)

            if result:
                print(f"DEBUG: Generated {len(result)} valid questions from LLM on attempt {attempt + 1}")
                return result
            elif attempt < max_retries - 1:
                print(f"DEBUG: No valid questions generated on attempt {attempt + 1}, retrying...")
                continue
            else:
                print(f"DEBUG: Failed to generate valid questions after {max_retries} attempts")
                return None
                
        except asyncio.TimeoutError:
            print(f"DEBUG: LLM generation timeout on attempt {attempt + 1}/{max_retries}, falling back to default")
            return None
        except Exception as e:
            print(f"DEBUG: LLM generation error on attempt {attempt + 1}/{max_retries}: {e}")
            return None
    
    return None


async def _judge_with_llm(question: dict[str, Any], answer: str | list[str]) -> dict[str, Any] | None:
    """
    使用 LLM 辅助判题（仅用于填空题）
    """
    import asyncio
    
    q_type = question.get('type')
    
    # 只对填空题使用 LLM 辅助判题
    if q_type != 'fill_blank':
        return None
    
    prompt = (
        '你是判题助手。请只输出 JSON 对象，不要任何额外文本。\n'
        '字段: correct(bool), confidence(0~1), reason(string)。\n'
        f"题目: {question.get('content')}\n"
        f"标准答案: {json.dumps(question.get('correct_answer'), ensure_ascii=False)}\n"
        f"用户答案: {json.dumps(answer, ensure_ascii=False)}\n"
        '请判断用户答案是否正确。考虑同义词、近似表达等。'
    )
    
    try:
        # 添加超时保护（5秒）
        text = await asyncio.wait_for(_collect_llm_text(prompt), timeout=5.0)
    except asyncio.TimeoutError:
        print(f"DEBUG: LLM judge timeout")
        return None
    except Exception as e:
        print(f"DEBUG: LLM judge error: {e}")
        return None
    
    if not text:
        return None

    obj = _extract_json_object(text)
    if not isinstance(obj, dict):
        print(f"DEBUG: Failed to extract JSON object from LLM judge response: {text}")
        return None

    result = {
        'correct': bool(obj.get('correct', False)),
        'confidence': float(obj.get('confidence', 0.0)),
        'reason': str(obj.get('reason', '')).strip(),
    }
    print(f"DEBUG: LLM judge result: {result}")
    return result


async def _collect_llm_text(prompt: str) -> str:
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
    return ''.join(parts).strip()


def _extract_json_list(text: str) -> list[dict[str, Any]] | None:
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except json.JSONDecodeError:
        pass

    m = re.search(r'\[[\s\S]*\]', text)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    return [x for x in data if isinstance(x, dict)]


def _extract_json_object(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    m = re.search(r'\{[\s\S]*\}', text)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_question(raw: dict[str, Any], idx: int, batch_id: str) -> dict[str, Any] | None:
    q_type = str(raw.get('type', 'single')).strip()
    if q_type not in {'single', 'multiple', 'fill_blank'}:
        q_type = 'single'

    content = str(raw.get('content', '')).strip()
    if not content:
        return None

    options: list[str] | None = None
    if q_type in {'single', 'multiple'}:
        raw_options = raw.get('options')
        if not isinstance(raw_options, list):
            return None
        options = [str(x).strip() for x in raw_options if str(x).strip()]
        if len(options) < 2:
            return None

    correct_answer = raw.get('correct_answer')
    if q_type == 'single':
        correct_answer = str(correct_answer or '').strip()
        if not correct_answer:
            return None
    elif q_type == 'multiple':
        if not isinstance(correct_answer, list):
            return None
        correct_answer = [str(x).strip() for x in correct_answer if str(x).strip()]
        if not correct_answer:
            return None
    else:
        correct_answer = str(correct_answer or '').strip()
        if not correct_answer:
            return None

    return {
        'id': f'gq_{batch_id}_{idx}',
        'type': q_type,
        'content': content,
        'options': options,
        'correct_answer': correct_answer,
        'explanation': str(raw.get('explanation', '')).strip() or '建议回顾相关知识点并对比标准答案。',
        'knowledge_point_id': str(raw.get('knowledge_point_id', 'general')).strip() or 'general',
        'knowledge_point_name': str(raw.get('knowledge_point_name', '通用能力')).strip() or '通用能力',
    }


def _build_default_batch(count: int, batch_id: str) -> list[dict[str, Any]]:
    """
    从预设题库中随机选择题目
    """
    import random
    
    src = _DEFAULT_QUIZ_SET
    if not src:
        print(f"DEBUG: Default quiz set is empty!")
        return []
    
    # 随机选择题目，允许重复（因为题库足够大）
    selected = random.choices(src, k=count)
    
    out: list[dict[str, Any]] = []
    for i, base in enumerate(selected, start=1):
        q = dict(base)
        q['id'] = f"dq_{batch_id}_{i}"
        out.append(q)
    
    print(f"DEBUG: Selected {len(out)} questions from default set (total available: {len(src)})")
    return out


def _build_personalized_quiz_context() -> dict[str, Any]:
    profile = read_json(settings.single_user_id, 'profile_snapshot.json', {})
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    if not isinstance(records, list):
        records = []

    recent = records[-30:]
    total = len(recent)
    correct_num = sum(1 for r in recent if bool(r.get('correct', False)))
    accuracy = (correct_num / total) if total > 0 else 0.0

    weak_counter: dict[str, int] = {}
    for r in reversed(recent):
        if bool(r.get('correct', False)):
            continue
        kp = str(r.get('knowledge_point_id', '')).strip() or 'general'
        weak_counter[kp] = weak_counter.get(kp, 0) + 1

    weak_kps = [k for k, _ in sorted(weak_counter.items(), key=lambda x: x[1], reverse=True)[:5]]

    mastery_rows = fetch_all(
        """
        SELECT knowledge_point_id, knowledge_point_name, score
        FROM mastery_records
        WHERE user_id = ?
        ORDER BY score ASC
        LIMIT 5
        """,
        (settings.single_user_id,),
    )
    weakest_mastery = [
        {
            'knowledge_point_id': str(r['knowledge_point_id']),
            'knowledge_point_name': str(r['knowledge_point_name']),
            'score': float(r['score']),
        }
        for r in mastery_rows
    ]

    # difficulty band for adaptive generation
    if accuracy >= 0.85:
        difficulty = 'higher'
    elif accuracy <= 0.45:
        difficulty = 'easier'
    else:
        difficulty = 'balanced'

    return {
        'goal': profile.get('goal', []),
        'knowledge_level': profile.get('knowledge_level', ''),
        'learning_preference': profile.get('learning_preference', []),
        'recent_accuracy': round(accuracy, 4),
        'difficulty_band': difficulty,
        'recent_wrong_knowledge_points': weak_kps,
        'weakest_mastery_points': weakest_mastery,
    }


def _latest_quiz_set() -> list[dict[str, Any]]:
    latest = read_json(settings.single_user_id, 'latest_quiz_set.json', [])
    if isinstance(latest, list) and latest:
        valid = [q for q in latest if isinstance(q, dict) and q.get('id')]
        if valid:
            return valid
    return _build_default_batch(5, 'fallback')


def _is_correct_rule(q: dict[str, Any], answer: str | list[str]) -> bool:
    """
    判题逻辑：检查用户答案是否正确
    支持单选、多选、填空三种题型
    """
    q_type = q.get('type')
    correct_answer = q.get('correct_answer')
    
    print(f"DEBUG: Judging question type={q_type}, correct_answer={correct_answer}, user_answer={answer}")
    
    # 多选题：答案必须是列表，且集合相等
    if q_type == 'multiple':
        if not isinstance(answer, list):
            print(f"DEBUG: Multiple choice but answer is not list: {type(answer)}")
            return False
        
        # 规范化期望答案
        if not isinstance(correct_answer, list):
            print(f"DEBUG: Multiple choice but correct_answer is not list: {correct_answer}")
            return False
        
        expected = set(str(x).strip().lower() for x in correct_answer)
        actual = set(str(x).strip().lower() for x in answer)
        
        result = expected == actual
        print(f"DEBUG: Multiple choice - expected={expected}, actual={actual}, result={result}")
        return result
    
    # 单选题和填空题：答案必须是字符串
    if isinstance(answer, list):
        print(f"DEBUG: Single/fill_blank but answer is list: {answer}")
        return False
    
    expected_str = str(correct_answer or '').strip()
    actual_str = str(answer or '').strip()
    
    # 填空题：忽略空格和大小写
    if q_type == 'fill_blank':
        # 多种规范化方式，提高容错率
        normalize = lambda s: re.sub(r'\s+', '', s).lower()
        
        expected_normalized = normalize(expected_str)
        actual_normalized = normalize(actual_str)
        
        result = expected_normalized == actual_normalized
        print(f"DEBUG: Fill blank - expected={expected_normalized}, actual={actual_normalized}, result={result}")
        return result
    
    # 单选题：不区分大小写，但保留空格
    expected_lower = expected_str.lower()
    actual_lower = actual_str.lower()
    
    result = expected_lower == actual_lower
    print(f"DEBUG: Single choice - expected={expected_lower}, actual={actual_lower}, result={result}")
    return result


def _update_mastery(kp_id: str, delta: float) -> None:
    row = fetch_one(
        'SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?',
        (settings.single_user_id, kp_id),
    )
    if not row:
        return

    score = max(0.0, min(1.0, float(row['score']) + delta))
    execute(
        "UPDATE mastery_records SET score = ?, last_updated = datetime('now') WHERE user_id = ? AND knowledge_point_id = ?",
        (score, settings.single_user_id, kp_id),
    )
