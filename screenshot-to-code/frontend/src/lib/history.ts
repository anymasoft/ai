export interface HistoryItem {
  id: string
  createdAt: string
  sourceType: "image" | "url"
  sourceLabel: string
  instructions?: string
  result: string
}

const HISTORY_KEY = "generation_history"
const MAX_HISTORY_ITEMS = 20

export function getHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    if (!stored) return []
    return JSON.parse(stored) as HistoryItem[]
  } catch {
    return []
  }
}

export function addHistoryItem(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  const history = getHistory()
  const newItem: HistoryItem = {
    ...item,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }

  // Add to beginning of history
  const updated = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  return newItem
}

export function getHistoryItem(id: string): HistoryItem | null {
  const history = getHistory()
  return history.find((item) => item.id === id) || null
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString()
  } catch {
    return isoString
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname || url
  } catch {
    return url
  }
}
