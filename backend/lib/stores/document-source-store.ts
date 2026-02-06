/**
 * Document Source Store - 文件源勾选状态管理
 */

import { create } from 'zustand'

interface DocumentSourceStore {
  // 当前选中的源 ID 集合
  selectedSourceIds: Set<string>

  // 操作
  toggleSource: (sourceId: string) => void
  selectMultiple: (sourceIds: string[]) => void
  clearSelection: () => void
  isSelected: (sourceId: string) => boolean
  getSelectedIds: () => string[]
  setSelectedIds: (ids: string[]) => void
}

export const useDocumentSourceStore = create<DocumentSourceStore>((set, get) => ({
  // 初始状态
  selectedSourceIds: new Set<string>(),

  // 切换源的选中状态
  toggleSource: (sourceId) =>
    set((state) => {
      const newSet = new Set(state.selectedSourceIds)
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId)
      } else {
        newSet.add(sourceId)
      }
      return { selectedSourceIds: newSet }
    }),

  // 选中多个源
  selectMultiple: (sourceIds) =>
    set({
      selectedSourceIds: new Set(sourceIds),
    }),

  // 清空选中
  clearSelection: () =>
    set({
      selectedSourceIds: new Set(),
    }),

  // 检查是否选中
  isSelected: (sourceId) => get().selectedSourceIds.has(sourceId),

  // 获取选中的 ID 数组
  getSelectedIds: () => Array.from(get().selectedSourceIds),

  // 直接设置选中的 ID
  setSelectedIds: (ids) =>
    set({
      selectedSourceIds: new Set(ids),
    }),
}))
