"use client"

import { useRef, useState } from "react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  generateCode,
  type FullGenerationSettings,
  type CodeGenerationCallbacks,
  EditorTheme,
  Stack,
  CodeGenerationModel,
  USER_CLOSE_WEB_SOCKET_CODE,
} from "@/logic/generation"

export default function PlaygroundPage() {
  const wsRef = useRef<WebSocket | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chunks, setChunks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = () => {
    setIsStreaming(true)
    setChunks([])
    setError(null)

    // Minimal mock data
    const mockParams: FullGenerationSettings = {
      // CodeGenerationParams
      generationType: "create",
      inputMode: "text",
      prompt: {
        text: "Generate a simple HTML page with a button and form",
        images: [],
      },
      // Settings
      openAiApiKey: null,
      openAiBaseURL: null,
      screenshotOneApiKey: null,
      isImageGenerationEnabled: false,
      editorTheme: EditorTheme.COBALT,
      generatedCodeConfig: Stack.HTML_TAILWIND,
      codeGenerationModel: CodeGenerationModel.CLAUDE_4_5_SONNET_2025_09_29,
      isTermOfServiceAccepted: true,
      anthropicApiKey: null,
    }

    const callbacks: CodeGenerationCallbacks = {
      onChange: (chunk, variantIndex) => {
        setChunks((prev) => [...prev, chunk])
      },
      onSetCode: (code, variantIndex) => {
        setChunks([code])
      },
      onStatusUpdate: (status, variantIndex) => {
        console.log("Status:", status)
      },
      onVariantComplete: (variantIndex) => {
        console.log("Variant complete")
      },
      onVariantError: (variantIndex, error) => {
        setError(error)
        setIsStreaming(false)
      },
      onVariantCount: (count) => {
        console.log("Variant count:", count)
      },
      onCancel: () => {
        setIsStreaming(false)
      },
      onComplete: () => {
        setIsStreaming(false)
      },
    }

    generateCode(wsRef, mockParams, callbacks)
  }

  const handleCancel = () => {
    if (wsRef.current) {
      wsRef.current.close(USER_CLOSE_WEB_SOCKET_CODE)
    }
  }

  return (
    <BaseLayout
      title="Playground"
      description="Code generation workspace"
    >
      <div className="@container/main px-4 lg:px-6 space-y-6">
        <Card className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the button to test code generation streaming. Results will appear below.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={isStreaming ? handleCancel : handleGenerate}
                variant={isStreaming ? "destructive" : "default"}
              >
                {isStreaming ? "Cancel" : "Generate"}
              </Button>
            </div>
          </div>
        </Card>

        {chunks.length > 0 && (
          <Card className="p-6">
            <div className="space-y-2">
              <h3 className="font-semibold">
                Generated Code {isStreaming && <span className="text-muted-foreground">(streaming...)</span>}
              </h3>
              <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                <code>{chunks.join("")}</code>
              </pre>
            </div>
          </Card>
        )}

        {error && (
          <Card className="p-6 border-destructive">
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">Error</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </Card>
        )}
      </div>
    </BaseLayout>
  )
}
