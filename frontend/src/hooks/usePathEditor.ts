import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { EditablePhase, EditablePathNode } from '@/lib/api/types'

const MAX_NODES = 12
const MIN_NODES = 1
const SAVE_DEBOUNCE_MS = 300

/**
 * 路径编辑器 Hook
 * 管理路径节点的增删改移操作，实时保存到后端
 */
export function usePathEditor(
  initialPhases: EditablePhase[],
  pathId: string,
  target: string,
) {
  const [phases, setPhases] = useState<EditablePhase[]>(initialPhases)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const pathIdRef = useRef(pathId)
  const targetRef = useRef(target)

  // 同步外部传入的 pathId/target 变化
  pathIdRef.current = pathId
  targetRef.current = target

  // 计算总节点数
  const totalNodes = phases.reduce((sum, p) => sum + p.nodes.length, 0)

  // 防抖保存
  const debouncedSave = useCallback((nextPhases: EditablePhase[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      api
        .savePathPlanning({
          pathId: pathIdRef.current,
          target: targetRef.current,
          phases: nextPhases,
        })
        .catch((err) => console.error('路径保存失败:', err))
    }, SAVE_DEBOUNCE_MS)
  }, [])

  // 生成唯一 ID
  const genId = () =>
    `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  // 添加节点
  const addNode = useCallback(
    (phaseId: 1 | 2 | 3, title: string) => {
      if (totalNodes >= MAX_NODES || !title.trim()) return false
      const newNode: EditablePathNode = {
        id: genId(),
        title: title.trim(),
        source: 'user',
      }
      setPhases((prev) => {
        const next = prev.map((p) =>
          p.id === phaseId ? { ...p, nodes: [...p.nodes, newNode] } : p,
        )
        debouncedSave(next)
        return next
      })
      return true
    },
    [totalNodes, debouncedSave],
  )

  // 删除节点
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (totalNodes <= MIN_NODES) return false
      setPhases((prev) => {
        const next = prev.map((p) => ({
          ...p,
          nodes: p.nodes.filter((n) => n.id !== nodeId),
        }))
        debouncedSave(next)
        return next
      })
      return true
    },
    [totalNodes, debouncedSave],
  )

  // 编辑节点标题
  const editNodeTitle = useCallback(
    (nodeId: string, newTitle: string) => {
      if (!newTitle.trim()) return
      setPhases((prev) => {
        const next = prev.map((p) => ({
          ...p,
          nodes: p.nodes.map((n) =>
            n.id === nodeId ? { ...n, title: newTitle.trim() } : n,
          ),
        }))
        debouncedSave(next)
        return next
      })
    },
    [debouncedSave],
  )

  // 移动节点（上移/下移）
  const moveNode = useCallback(
    (nodeId: string, direction: 'up' | 'down') => {
      setPhases((prev) => {
        // 找到节点所在的阶段和位置
        let srcPhaseIdx = -1
        let srcNodeIdx = -1
        for (let pi = 0; pi < prev.length; pi++) {
          const ni = prev[pi].nodes.findIndex((n) => n.id === nodeId)
          if (ni !== -1) {
            srcPhaseIdx = pi
            srcNodeIdx = ni
            break
          }
        }
        if (srcPhaseIdx === -1) return prev

        // 深拷贝
        const next = prev.map((p) => ({ ...p, nodes: [...p.nodes] }))

        if (direction === 'up') {
          if (srcNodeIdx > 0) {
            // 同阶段内上移：与前一个交换
            const arr = next[srcPhaseIdx].nodes
            ;[arr[srcNodeIdx - 1], arr[srcNodeIdx]] = [
              arr[srcNodeIdx],
              arr[srcNodeIdx - 1],
            ]
          } else if (srcPhaseIdx > 0) {
            // 跨阶段上移：移到上一个阶段末尾
            const [node] = next[srcPhaseIdx].nodes.splice(srcNodeIdx, 1)
            next[srcPhaseIdx - 1].nodes.push(node)
          }
        } else {
          const arr = next[srcPhaseIdx].nodes
          if (srcNodeIdx < arr.length - 1) {
            // 同阶段内下移：与后一个交换
            ;[arr[srcNodeIdx], arr[srcNodeIdx + 1]] = [
              arr[srcNodeIdx + 1],
              arr[srcNodeIdx],
            ]
          } else if (srcPhaseIdx < next.length - 1) {
            // 跨阶段下移：移到下一个阶段开头
            const [node] = next[srcPhaseIdx].nodes.splice(srcNodeIdx, 1)
            next[srcPhaseIdx + 1].nodes.unshift(node)
          }
        }

        debouncedSave(next)
        return next
      })
    },
    [debouncedSave],
  )

  // 整体替换（用于重新生成覆盖）
  const replaceAll = useCallback(
    (newPhases: EditablePhase[]) => {
      setPhases(newPhases)
      // 立即保存，不防抖
      api
        .savePathPlanning({
          pathId: pathIdRef.current,
          target: targetRef.current,
          phases: newPhases,
        })
        .catch((err) => console.error('路径保存失败:', err))
    },
    [],
  )

  return {
    phases,
    totalNodes,
    canAdd: totalNodes < MAX_NODES,
    canDelete: totalNodes > MIN_NODES,
    addNode,
    deleteNode,
    editNodeTitle,
    moveNode,
    replaceAll,
    setPhases,
  }
}
