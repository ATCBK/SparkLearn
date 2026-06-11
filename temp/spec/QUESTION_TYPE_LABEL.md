# 题目类型标注功能

## 功能描述
在每道题目的标题旁边添加题目类型标签，帮助用户快速识别题目类型。

## 实现细节

### 显示位置
题目标题右侧，与题号和题目名称在同一行

### 题型标签

| 题型 | 标签文本 | 颜色 | 代码 |
|------|---------|------|------|
| 单选题 | 单选题 | 蓝色 | `single` |
| 多选题 | 多选题 | 橙色 | `multiple` |
| 填空题 | 填空题 | 绿色 | `fill_blank` |

### 代码实现

```typescript
<div className="mt-3 flex items-center gap-2">
  <h2 className="text-h2 font-bold text-ink">
    第 {currentIndex + 1} 题：{currentQuestion?.title || '题目'}
  </h2>
  <Pill tone={
    currentQuestion?.type === 'single' ? 'blue' :
    currentQuestion?.type === 'multiple' ? 'orange' :
    'green'
  }>
    {currentQuestion?.type === 'single' ? '单选题' :
     currentQuestion?.type === 'multiple' ? '多选题' :
     '填空题'}
  </Pill>
</div>
```

### 视觉效果

```
第 1 题：以下哪个是 Python 的可变数据类型？ [单选题]
                                        ↑
                                    蓝色标签

第 2 题：以下哪些是 Python 内置数据类型？ [多选题]
                                        ↑
                                    橙色标签

第 3 题：在 Python 中，使用 ______ 关键字来导入模块。 [填空题]
                                        ↑
                                    绿色标签
```

## 用户体验改进

1. **快速识别**：用户可以一眼看出题目类型
2. **颜色区分**：不同颜色的标签便于视觉区分
3. **清晰布局**：标签与题目标题在同一行，信息密度合理
4. **一致性**：与系统其他部分的 Pill 组件风格一致

## 修改的文件
- `frontend/src/app/(shell)/practice/page.tsx`

## 验证清单

- [x] 单选题显示"单选题"标签（蓝色）
- [x] 多选题显示"多选题"标签（橙色）
- [x] 填空题显示"填空题"标签（绿色）
- [x] 标签与题目标题在同一行
- [x] 标签之间有适当的间距
- [x] 没有 TypeScript 编译错误
- [x] 没有运行时错误

## 示例场景

### 场景 1：用户浏览单选题
```
第 1 题：以下哪个是 Python 的可变数据类型？ [单选题]
        ○ list
        ○ tuple
        ○ string
```

### 场景 2：用户浏览多选题
```
第 2 题：以下哪些是 Python 内置数据类型？ [多选题]
        ☐ list
        ☐ dict
        ☐ array
        ☐ set
```

### 场景 3：用户浏览填空题
```
第 3 题：在 Python 中，使用 ______ 关键字来导入模块。 [填空题]
        请输入答案：
        [输入框]
        
        参考答案：
        import
        from
```

## 后续扩展

可以考虑在以下地方也添加题型标注：
1. 题号按钮上显示题型图标
2. 答题记录中显示题型标签
3. 错题本中显示题型标签
