export interface HistoryItem {
  id: string
  createdAt: string
  sourceType: "image" | "url"
  sourceLabel: string
  instructions?: string
  result: string
  format?: "html_tailwind" | "html_css" | "react_tailwind" | "vue_tailwind"
}

interface ApiGeneration {
  generation_id: string
  created_at: string
  input_type: "image" | "url"
  input_label: string
  format: string
  result_code: string
  status: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7001'

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    console.log("Fetching history from /api/generations")
    const response = await fetch(`${API_URL}/api/generations`, {
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        console.log("Not authenticated")
        return []
      }
      throw new Error(`Failed to fetch history: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("History fetched from API. Items:", data.data?.length || 0)

    // Transform API response to HistoryItem format
    const items: HistoryItem[] = (data.data || []).map((gen: ApiGeneration) => ({
      id: gen.generation_id,
      createdAt: gen.created_at,
      sourceType: gen.input_type,
      sourceLabel: gen.input_label,
      result: gen.result_code || "",
      format: gen.format as any,
    }))

    return items
  } catch (error) {
    console.error("Error retrieving history from API:", error)
    return []
  }
}

export function addHistoryItem(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  // This function is kept for backward compatibility but doesn't store to localStorage
  // History is now automatically saved by the backend when a generation is created
  console.log("addHistoryItem: History is now saved by the backend API")
  return {
    ...item,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
}

export async function getHistoryItem(id: string): Promise<HistoryItem | null> {
  const history = await getHistory()
  return history.find((item) => item.id === id) || null
}

export async function deleteHistoryItem(id: string): Promise<boolean> {
  try {
    console.log(`Deleting history item: ${id}`)
    const response = await fetch(`${API_URL}/api/generations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to delete history item: ${response.statusText}`)
    }

    console.log(`History item deleted: ${id}`)
    return true
  } catch (error) {
    console.error("Error deleting history item:", error)
    return false
  }
}

export async function clearHistory(): Promise<boolean> {
  try {
    console.log("Clearing all history")
    const response = await fetch(`${API_URL}/api/history`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to clear history: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`History cleared. Deleted ${data.data?.deleted_count || 0} items`)
    return true
  } catch (error) {
    console.error("Error clearing history:", error)
    return false
  }
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

export function getFormatDisplay(format?: string): string {
  switch (format) {
    case "html_tailwind":
      return "HTML"
    case "html_css":
      return "CSS"
    case "react_tailwind":
      return "React"
    case "vue_tailwind":
      return "Vue"
    default:
      return "Code"
  }
}
