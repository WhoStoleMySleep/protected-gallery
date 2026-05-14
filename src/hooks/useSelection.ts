import { useState, useCallback } from 'react'

export const useSelection = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true)
    setSelected(new Set([id]))
  }, [])

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (next.size === 0) setSelectionMode(false)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setSelectionMode(false)
  }, [])

  return { selected, selectionMode, enterSelection, toggleItem, clearSelection }
}
