import { WS_BACKEND_URL } from "./config"
import {
  APP_ERROR_WEB_SOCKET_CODE,
  USER_CLOSE_WEB_SOCKET_CODE,
} from "./constants"
import type { FullGenerationSettings } from "./types"

const ERROR_MESSAGE =
  "Error generating code. Check the Developer Console AND the backend logs for details. Feel free to open a Github issue."

const CANCEL_MESSAGE = "Code generation cancelled"

// Helper: Get session_id from cookies
function getSessionIdFromCookies(): string | null {
  const cookies = document.cookie.split("; ")
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=")
    if (name === "session_id") {
      return decodeURIComponent(value)
    }
  }
  return null
}

type WebSocketResponse = {
  type:
    | "chunk"
    | "status"
    | "setCode"
    | "error"
    | "variantComplete"
    | "variantError"
    | "variantCount"
  value: string
  variantIndex: number
}

export interface CodeGenerationCallbacks {
  onChange: (chunk: string, variantIndex: number) => void
  onSetCode: (code: string, variantIndex: number) => void
  onStatusUpdate: (status: string, variantIndex: number) => void
  onVariantComplete: (variantIndex: number) => void
  onVariantError: (variantIndex: number, error: string) => void
  onVariantCount: (count: number) => void
  onCancel: () => void
  onComplete: () => void
}

export function generateCode(
  wsRef: React.MutableRefObject<WebSocket | null>,
  params: FullGenerationSettings,
  callbacks: CodeGenerationCallbacks
) {
  const sessionId = getSessionIdFromCookies()

  if (!sessionId) {
    console.error("[WS] No session_id found in cookies")
    callbacks.onVariantError(0, "Session not found. Please log in again.")
    return
  }

  const wsUrl = `${WS_BACKEND_URL}/generate-code?session_id=${encodeURIComponent(sessionId)}`
  console.log("[WS] opening WebSocket", wsUrl)

  const ws = new WebSocket(wsUrl)
  wsRef.current = ws

  ws.addEventListener("open", () => {
    console.log("[WS] ✓ CONNECTED to backend successfully")
    console.log("[DIAG] WS Payload generatedCodeConfig:", (params as any).generatedCodeConfig)
    console.log("[DIAG:WS:SEND] Full payload object=", params)
    console.log("[DIAG:WS:SEND:JSON]", JSON.stringify(params, null, 2))
    ws.send(JSON.stringify(params))
  })

  ws.addEventListener("message", async (event: MessageEvent) => {
    const response = JSON.parse(event.data) as WebSocketResponse
    if (response.type === "chunk") {
      callbacks.onChange(response.value, response.variantIndex)
    } else if (response.type === "status") {
      callbacks.onStatusUpdate(response.value, response.variantIndex)
    } else if (response.type === "setCode") {
      callbacks.onSetCode(response.value, response.variantIndex)
    } else if (response.type === "variantComplete") {
      callbacks.onVariantComplete(response.variantIndex)
    } else if (response.type === "variantError") {
      callbacks.onVariantError(response.variantIndex, response.value)
    } else if (response.type === "variantCount") {
      callbacks.onVariantCount(parseInt(response.value))
    } else if (response.type === "error") {
      console.error("Error generating code", response.value)
      // Toast stub - no notification in this version
    }
  })

  ws.addEventListener("close", (event) => {
    console.log("[WS] Connection closed", event.code, event.reason)
    if (event.code === USER_CLOSE_WEB_SOCKET_CODE) {
      console.log(CANCEL_MESSAGE)
      callbacks.onCancel()
    } else if (event.code === APP_ERROR_WEB_SOCKET_CODE) {
      console.error("Known server error", event)
      callbacks.onCancel()
    } else if (event.code !== 1000) {
      console.error("[WS] ✗ Unknown server or connection error", event)
      console.error(ERROR_MESSAGE)
      callbacks.onCancel()
    } else {
      callbacks.onComplete()
    }
  })

  ws.addEventListener("error", (error) => {
    console.error("[WS] ✗ CONNECTION ERROR - backend unreachable at", wsUrl)
    console.error("[WS] Error details:", error)
    console.error(ERROR_MESSAGE)
  })
}
