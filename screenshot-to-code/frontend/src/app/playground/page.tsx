"use client"

import { useRef, useState, useEffect } from "react"
import { X } from "lucide-react"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addHistoryItem, extractDomain, type HistoryItem } from "@/lib/history"
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
  const [validationError, setValidationError] = useState<string | null>(null)

  // Input state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const [instructions, setInstructions] = useState("")

  // Load from history if available
  useEffect(() => {
    const loadedItem = sessionStorage.getItem("playground_load")
    if (loadedItem) {
      try {
        const item: HistoryItem = JSON.parse(loadedItem)
        setInstructions(item.instructions || "")
        setChunks([item.result])
        sessionStorage.removeItem("playground_load")
      } catch (e) {
        console.error("Failed to load history item:", e)
      }
    }
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    // Clear file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const handleGenerate = async () => {
    // Validation
    if (!imageFile && !url) {
      setValidationError("Please provide either an image or a URL")
      return
    }

    setValidationError(null)
    setIsStreaming(true)
    setChunks([])
    setError(null)

    // Prepare images array (convert file to data URL if present)
    let images: string[] = []
    if (imageFile && imagePreview) {
      images = [imagePreview]
    }

    // Build params with real data
    const params: FullGenerationSettings = {
      // CodeGenerationParams
      generationType: "create",
      inputMode: imageFile ? "image" : url ? "text" : "text",
      prompt: {
        text: instructions || (url ? `Generate code based on this URL: ${url}` : "Generate code from the provided image"),
        images: images,
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
        // Save to history
        if (chunks.length > 0) {
          const result = chunks.join("")
          const sourceLabel = imageFile
            ? imageFile.name
            : url
              ? extractDomain(url)
              : "Unknown"
          addHistoryItem({
            sourceType: imageFile ? "image" : "url",
            sourceLabel,
            instructions,
            result,
          })
        }
      },
    }

    generateCode(wsRef, params, callbacks)
  }

  const handleCancel = () => {
    if (wsRef.current) {
      wsRef.current.close(USER_CLOSE_WEB_SOCKET_CODE)
    }
  }

  const handleClearUrl = () => {
    setUrl("")
  }

  return (
    <BaseLayout
      title="Playground"
      description="Code generation workspace"
    >
      <div className="@container/main px-4 lg:px-6 space-y-6">
        {/* Input Form Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Generate Code</h3>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload Image</label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                disabled={isStreaming || !!url}
              />
              {url && (
                <p className="text-xs text-muted-foreground/70">URL is used as source</p>
              )}
              {imagePreview && (
                <div className="mt-2 relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-32 rounded border" />
                  <button
                    onClick={handleRemoveImage}
                    disabled={isStreaming}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors disabled:opacity-50"
                    aria-label="Remove image"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Or Enter URL</label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isStreaming || !!imageFile}
                  className="placeholder:text-muted-foreground/60"
                />
                {url && (
                  <Button
                    onClick={handleClearUrl}
                    variant="outline"
                    size="sm"
                    disabled={isStreaming}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {imageFile && (
                <p className="text-xs text-muted-foreground/70">Image is used as source</p>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Generation instructions</label>
              <Textarea
                placeholder="E.g. focus on layout accuracy, keep Tailwind classes, avoid inline styles…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isStreaming}
                rows={4}
                className="placeholder:text-muted-foreground/60"
              />
              <p className="text-xs text-muted-foreground/80">
                Optional: describe what should be changed or emphasized in the generated code.
              </p>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
                {validationError}
              </div>
            )}

            {/* Generate/Cancel Button */}
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

        {/* Generated Code Card */}
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

        {/* Error Card */}
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
