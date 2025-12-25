import { useRef, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { X, Copy, Download, FileArchive, Check, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { fetchJSON } from "@/lib/api"
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
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chunksRef = useRef<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [chunks, setChunks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Billing state
  const [credits, setCredits] = useState<number | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [loadingCredits, setLoadingCredits] = useState(true)

  // Input state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const [instructions, setInstructions] = useState("")
  const [selectedFormat, setSelectedFormat] = useState<"html_tailwind" | "html_css" | "react_tailwind" | "vue_tailwind">(
    "html_tailwind"
  )

  // Load credits balance
  useEffect(() => {
    async function loadCredits() {
      try {
        const data = await fetchJSON<{ credits: number }>("/api/billing/balance")
        setCredits(data.credits)
        if (data.credits === 0) {
          setShowPaywall(true)
        }
      } catch (err) {
        console.error("[BILLING] Error loading credits:", err)
        setCredits(0)
      } finally {
        setLoadingCredits(false)
      }
    }

    loadCredits()
  }, [])

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

  // Sync chunks state with ref for use in callbacks
  useEffect(() => {
    chunksRef.current = chunks
  }, [chunks])

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
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleGenerate = async () => {
    // Check credits
    if (credits === null || credits === 0) {
      setShowPaywall(true)
      return
    }

    // Validation
    if (!imageFile && !url) {
      setValidationError("Пожалуйста, предоставьте либо изображение, либо URL")
      return
    }

    setValidationError(null)
    setIsStreaming(true)
    setChunks([])
    setError(null)

    // DEDUCT CREDITS IMMEDIATELY (atomically, before generation)
    try {
      console.log("[CREDITS] Deducting 1 credit before generation. Current:", credits)
      const deductResponse = await fetchJSON<{
        success: boolean
        remaining_credits: number
        message: string
      }>("/api/billing/deduct-credits", {
        method: "POST",
        body: JSON.stringify({ format: selectedFormat }),
      })

      if (!deductResponse.success) {
        throw new Error(deductResponse.message || "Не удалось списать кредиты")
      }

      const newCredits = deductResponse.remaining_credits
      setCredits(newCredits)
      console.log("[CREDITS] Successfully deducted. Remaining:", newCredits)
      toast.success(`Списано 1 кредит. Осталось: ${newCredits}`)

      // Show paywall if no more credits
      if (newCredits === 0) {
        setTimeout(() => {
          setShowPaywall(true)
        }, 1000)
      }
    } catch (err) {
      console.error("[CREDITS] Error deducting credits:", err)
      setIsStreaming(false)
      toast.error(err instanceof Error ? err.message : "Ошибка при списании кредитов")
      return
    }

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
      generatedCodeConfig: selectedFormat,
      codeGenerationModel: CodeGenerationModel.CLAUDE_4_5_SONNET_2025_09_29,
      isTermOfServiceAccepted: true,
      anthropicApiKey: null,
    }

    const callbacks: CodeGenerationCallbacks = {
      onChange: (chunk, variantIndex) => {
        console.log("Chunk received:", chunk.slice(0, 50) + "...")
        setChunks((prev) => [...prev, chunk])
      },
      onSetCode: (code, variantIndex) => {
        console.log("Code set:", code.slice(0, 50) + "...")
        setChunks([code])
      },
      onStatusUpdate: (status, variantIndex) => {
        console.log("Status:", status)
      },
      onVariantComplete: (variantIndex) => {
        console.log("Variant complete")
      },
      onVariantError: (variantIndex, error) => {
        console.error("Variant error:", error)
        setError(error)
        setIsStreaming(false)
      },
      onVariantCount: (count) => {
        console.log("Variant count:", count)
      },
      onCancel: () => {
        console.log("Generation cancelled")
        setIsStreaming(false)
      },
      onComplete: async () => {
        console.log("Generation complete. Chunks ref length:", chunksRef.current.length)
        setIsStreaming(false)

        // Save to history - use chunksRef to avoid stale closure
        if (chunksRef.current.length > 0) {
          const result = chunksRef.current.join("")
          console.log("Saving to history. Result length:", result.length)
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
            format: selectedFormat,
          })
          console.log("History item added successfully")
        } else {
          console.warn("No chunks to save - chunksRef.current is empty")
        }

        // Credits already deducted before generation started
        console.log("[CREDITS] Generation completed. Credits already deducted upfront.")
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

  const handleCopyCode = async () => {
    const code = chunks.join("")
    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success("Код скопирован в буфер обмена")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Не удалось скопировать код")
    }
  }

  const handleDownloadHTML = () => {
    const code = chunks.join("")
    if (!code) return

    const blob = new Blob([code], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "index.html"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("HTML файл загружен")
  }

  const handleDownloadZIP = () => {
    const code = chunks.join("")
    if (!code) return

    // Create a simple ZIP file with index.html
    // Using basic ZIP structure without external library
    const filename = "index.html"
    const content = new TextEncoder().encode(code)

    // ZIP file structure (simplified for single file)
    const createZipBlob = () => {
      // Local file header
      const header = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04, // Signature
        0x14, 0x00, // Version
        0x00, 0x00, // Flags
        0x00, 0x00, // Compression (0 = none)
        0x00, 0x00, // Time
        0x00, 0x00, // Date
        0x00, 0x00, 0x00, 0x00, // CRC32 (placeholder)
        ...new Uint8Array(new Uint32Array([content.length]).buffer), // Compressed size
        ...new Uint8Array(new Uint32Array([content.length]).buffer), // Uncompressed size
        ...new Uint8Array(new Uint16Array([filename.length]).buffer), // Filename length
        0x00, 0x00, // Extra field length
      ])

      const filenameBytes = new TextEncoder().encode(filename)

      // Central directory header
      const centralHeader = new Uint8Array([
        0x50, 0x4b, 0x01, 0x02, // Signature
        0x14, 0x00, // Version made by
        0x14, 0x00, // Version needed
        0x00, 0x00, // Flags
        0x00, 0x00, // Compression
        0x00, 0x00, // Time
        0x00, 0x00, // Date
        0x00, 0x00, 0x00, 0x00, // CRC32
        ...new Uint8Array(new Uint32Array([content.length]).buffer), // Compressed size
        ...new Uint8Array(new Uint32Array([content.length]).buffer), // Uncompressed size
        ...new Uint8Array(new Uint16Array([filename.length]).buffer), // Filename length
        0x00, 0x00, // Extra field length
        0x00, 0x00, // Comment length
        0x00, 0x00, // Disk number
        0x00, 0x00, // Internal attributes
        0x00, 0x00, 0x00, 0x00, // External attributes
        0x00, 0x00, 0x00, 0x00, // Offset of local header
      ])

      // End of central directory
      const endRecord = new Uint8Array([
        0x50, 0x4b, 0x05, 0x06, // Signature
        0x00, 0x00, // Disk number
        0x00, 0x00, // Start disk
        0x01, 0x00, // Entries on disk
        0x01, 0x00, // Total entries
        ...new Uint8Array(new Uint32Array([centralHeader.length + filenameBytes.length]).buffer), // Central dir size
        ...new Uint8Array(new Uint32Array([header.length + filenameBytes.length + content.length]).buffer), // Offset
        0x00, 0x00, // Comment length
      ])

      // Combine all parts
      const zipData = new Uint8Array(
        header.length + filenameBytes.length + content.length +
        centralHeader.length + filenameBytes.length +
        endRecord.length
      )

      let offset = 0
      zipData.set(header, offset)
      offset += header.length
      zipData.set(filenameBytes, offset)
      offset += filenameBytes.length
      zipData.set(content, offset)
      offset += content.length
      zipData.set(centralHeader, offset)
      offset += centralHeader.length
      zipData.set(filenameBytes, offset)
      offset += filenameBytes.length
      zipData.set(endRecord, offset)

      return new Blob([zipData], { type: "application/zip" })
    }

    const blob = createZipBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "project.zip"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("ZIP архив загружен")
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Сайт из скриншота</h1>
          <p className="text-muted-foreground">Загрузите скриншот или вставьте URL — получите готовый код</p>
        </div>
      </div>
      <div className="@container/main px-4 lg:px-6 space-y-6">
        {/* Input Form Card */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Генерировать код</h3>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Загрузить изображение</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              <Button
                onClick={() => !isStreaming && !url && fileInputRef.current?.click()}
                variant="outline"
                disabled={isStreaming || !!url}
                className="w-full justify-start text-muted-foreground"
              >
                {imageFile ? imageFile.name : "Выберите файл изображения"}
              </Button>
              {url && (
                <p className="text-xs text-muted-foreground/70">URL используется в качестве источника</p>
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
              <label className="text-sm font-medium">Или введите URL</label>
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
                    Очистить
                  </Button>
                )}
              </div>
              {imageFile && (
                <p className="text-xs text-muted-foreground/70">Изображение используется в качестве источника</p>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Инструкции для генерации</label>
              <Textarea
                placeholder="Например, сосредоточьтесь на точности макета, сохраняйте классы Tailwind, избегайте встроенных стилей…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isStreaming}
                rows={4}
                className="placeholder:text-muted-foreground/60"
              />
              <p className="text-xs text-muted-foreground/80">
                Опционально: опишите, что должно быть изменено или выделено в сгенерированном коде.
              </p>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Формат вывода</label>
              <Select value={selectedFormat} onValueChange={(value: any) => setSelectedFormat(value)}>
                <SelectTrigger disabled={isStreaming}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html_tailwind">
                    <div className="flex items-center gap-2">
                      Статический HTML (Tailwind)
                    </div>
                  </SelectItem>
                  <SelectItem value="html_css">
                    <div className="flex items-center gap-2">
                      Статический HTML (CSS)
                    </div>
                  </SelectItem>
                  <SelectItem value="react_tailwind">
                    <div className="flex items-center gap-2">
                      React + Tailwind
                      <Badge variant="secondary" className="ml-1">Pro</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="vue_tailwind">
                    <div className="flex items-center gap-2">
                      Vue + Tailwind
                      <Badge variant="secondary" className="ml-1">Pro</Badge>
                      <Badge variant="outline" className="ml-1 text-xs">Бета</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
                className="gap-2"
                disabled={!isStreaming && (credits === null || credits === 0)}
              >
                {isStreaming && <Loader2 size={16} className="animate-spin" />}
                {isStreaming ? "Отменить" : (credits === 0 || credits === null) ? "Кредиты закончились" : "Генерировать"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Generating Indicator */}
        {isStreaming && chunks.length === 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              <div>
                <p className="font-medium">Генерирование кода...</p>
                <p className="text-sm">Это может занять несколько минут</p>
              </div>
            </div>
          </Card>
        )}

        {/* Preview / Code Tabs */}
        {chunks.length > 0 && (
          <Card className="p-6">
            <Tabs defaultValue="preview" className="w-full">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    Результат
                    {isStreaming && (
                      <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-normal">
                        <Loader2 size={14} className="animate-spin" />
                        генерирование...
                      </span>
                    )}
                  </h3>
                  <TabsList>
                    <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
                    <TabsTrigger value="code">Код</TabsTrigger>
                  </TabsList>
                </div>

                {/* Preview Tab */}
                <TabsContent value="preview" className="mt-4">
                  <iframe
                    srcDoc={chunks.join("")}
                    className="w-full border rounded bg-white"
                    style={{ minHeight: "600px" }}
                    title="Preview"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </TabsContent>

                {/* Code Tab */}
                <TabsContent value="code" className="mt-4">
                  <div className="space-y-3">
                    {/* Export buttons */}
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleCopyCode}
                            variant="ghost"
                            size="sm"
                            disabled={!chunks.length || isStreaming}
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copied ? "Скопировано!" : "Копировать"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleDownloadHTML}
                            variant="ghost"
                            size="sm"
                            disabled={!chunks.length || isStreaming}
                          >
                            <Download size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Загрузить HTML</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleDownloadZIP}
                            variant="ghost"
                            size="sm"
                            disabled={!chunks.length || isStreaming}
                          >
                            <FileArchive size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Загрузить ZIP</TooltipContent>
                      </Tooltip>
                    </div>
                    {/* Code block */}
                    <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
                      <code>{chunks.join("")}</code>
                    </pre>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        )}

        {/* Error Card */}
        {error && (
          <Card className="p-6 border-destructive">
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">Ошибка</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Paywall Dialog */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>У вас закончились генерации</DialogTitle>
            <DialogDescription>
              Для продолжения работы необходимо купить пакет генераций.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Каждая генерация требует 1 кредит. Выберите пакет, который вам нужен.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowPaywall(false)
                  navigate("/settings/billing")
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Перейти к покупке
              </button>
              <button
                onClick={() => setShowPaywall(false)}
                className="w-full px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition"
              >
                Позже
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
