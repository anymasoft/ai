import toast from "react-hot-toast";
import { WS_BACKEND_URL } from "./config";
import {
  APP_ERROR_WEB_SOCKET_CODE,
  USER_CLOSE_WEB_SOCKET_CODE,
} from "./constants";
import { FullGenerationSettings } from "./types";

const ERROR_MESSAGE =
  "Error generating code. Check the Developer Console AND the backend logs for details. Feel free to open a Github issue.";

const CANCEL_MESSAGE = "Code generation cancelled";

type WebSocketResponse = {
  type:
    | "chunk"
    | "status"
    | "setCode"
    | "error"
    | "variantComplete"
    | "variantError"
    | "variantCount"
    | "generation_complete"
    | "partial_element_html"
    | "partial_success"
    | "partial_failed";
  value?: string;
  variantIndex?: number;
};

interface CodeGenerationCallbacks {
  onChange: (chunk: string, variantIndex: number) => void;
  onSetCode: (code: string, variantIndex: number) => void;
  onStatusUpdate: (status: string, variantIndex: number) => void;
  onVariantComplete: (variantIndex: number) => void;
  onVariantError: (variantIndex: number, error: string) => void;
  onVariantCount: (count: number) => void;
  onGenerationComplete: () => void;
  // 🔧 PARTIAL UPDATE: Callbacks for element-level updates
  onPartialSuccess: (html: string) => void;
  onPartialFailed: () => void;
  onCancel: () => void;
  onComplete: () => void;
}

export function generateCode(
  wsRef: React.MutableRefObject<WebSocket | null>,
  params: FullGenerationSettings,
  callbacks: CodeGenerationCallbacks
) {
  const wsUrl = `${WS_BACKEND_URL}/generate-code`;
  console.log("Connecting to backend @ ", wsUrl);

  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;

  // 🔧 Track if we received generation_complete signal
  let receivedGenerationComplete = false;
  // 🔧 PARTIAL UPDATE: Store partial element HTML from backend
  let partialElementHtml = "";
  // 🔧 PARTIAL UPDATE: Check if this is a partial update
  const isPartialUpdate = (params as any).updateMode === "partial";

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify(params));
  });

  ws.addEventListener("message", async (event: MessageEvent) => {
    const response = JSON.parse(event.data) as WebSocketResponse;

    // 🔧 PARTIAL UPDATE: Separate protocol for element mutations
    if (isPartialUpdate) {
      // In partial mode, ONLY handle partial-specific messages
      if (response.type === "partial_element_html") {
        console.log("Received partial element HTML");
        partialElementHtml = response.value || "";
      } else if (response.type === "partial_success") {
        console.log("Partial update succeeded, applying element to DOM");
        callbacks.onPartialSuccess(partialElementHtml);
        receivedGenerationComplete = true;
      } else if (response.type === "partial_failed") {
        console.log("Partial update failed, falling back to full regenerate");
        callbacks.onPartialFailed();
        receivedGenerationComplete = true;
      } else if (response.type === "error") {
        console.error("Error in partial update", response.value);
        toast.error(response.value!);
      }
      // Ignore: chunk, status, setCode, variantComplete, variantError, variantCount, generation_complete
      return;
    }

    // Standard full-document generation protocol
    if (response.type === "chunk") {
      callbacks.onChange(response.value!, response.variantIndex!);
    } else if (response.type === "status") {
      callbacks.onStatusUpdate(response.value!, response.variantIndex!);
    } else if (response.type === "setCode") {
      callbacks.onSetCode(response.value!, response.variantIndex!);
    } else if (response.type === "variantComplete") {
      callbacks.onVariantComplete(response.variantIndex!);
    } else if (response.type === "variantError") {
      callbacks.onVariantError(response.variantIndex!, response.value!);
    } else if (response.type === "variantCount") {
      callbacks.onVariantCount(parseInt(response.value!));
    } else if (response.type === "error") {
      console.error("Error generating code", response.value);
      toast.error(response.value!);
    } else if (response.type === "generation_complete") {
      // 🔧 Mark that we received the final signal from backend
      console.log("Received generation_complete signal from backend");
      receivedGenerationComplete = true;
      // Notify app that generation is complete (complete all pending variants)
      callbacks.onGenerationComplete();
    }
  });

  ws.addEventListener("close", (event) => {
    console.log("Connection closed", event.code, event.reason);
    if (event.code === USER_CLOSE_WEB_SOCKET_CODE) {
      toast.success(CANCEL_MESSAGE);
      callbacks.onCancel();
    } else if (event.code === APP_ERROR_WEB_SOCKET_CODE) {
      console.error("Known server error", event);
      callbacks.onCancel();
    } else if (event.code !== 1000) {
      console.error("Unknown server or connection error", event);
      toast.error(ERROR_MESSAGE);
      callbacks.onCancel();
    } else if (!receivedGenerationComplete) {
      // 🔧 Connection closed cleanly (1000) but without generation_complete signal
      console.warn(
        "WebSocket closed without generation_complete signal - generation may have failed silently"
      );
      toast.error("Generation completed but confirmation signal was not received");
      callbacks.onCancel();
    } else {
      // 🔧 Normal completion with generation_complete signal received
      callbacks.onComplete();
    }
  });

  ws.addEventListener("error", (error) => {
    console.error("WebSocket error", error);
    toast.error(ERROR_MESSAGE);
  });
}
