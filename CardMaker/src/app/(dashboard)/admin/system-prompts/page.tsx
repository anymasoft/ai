"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface SystemPrompts {
  gen_base: string
  validate_base: string
}

export default function SystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompts>({
    gen_base: "",
    validate_base: "",
  })
  const [originalPrompts, setOriginalPrompts] = useState<SystemPrompts>({
    gen_base: "",
    validate_base: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загрузить текущие промпты
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/admin/config/prompts")

        if (!response.ok) {
          throw new Error("Ошибка при загрузке промптов")
        }

        const data = await response.json()
        setPrompts({
          gen_base: data.gen_base || "",
          validate_base: data.validate_base || "",
        })
        setOriginalPrompts({
          gen_base: data.gen_base || "",
          validate_base: data.validate_base || "",
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка")
        toast.error("Ошибка при загрузке промптов")
      } finally {
        setLoading(false)
      }
    }

    loadPrompts()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/config/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ошибка при сохранении промптов")
      }

      setOriginalPrompts(prompts)
      toast.success("Промпты сохранены")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const isDirty = JSON.stringify(prompts) !== JSON.stringify(originalPrompts)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка промптов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Prompts</h1>
        <p className="text-muted-foreground mt-1">
          Управляй системными промптами для генерации и валидации описаний товаров. Эти промпты будут использоваться при обработке запросов.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Промпт для генерации */}
        <Card>
          <CardHeader>
            <CardTitle>Промпт генерации (gen_base)</CardTitle>
            <CardDescription>
              Базовый промпт для генерации описаний товаров. Будет использоваться при создании карточек.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="gen_base" className="text-sm font-medium">
              Текст промпта
            </Label>
            <Textarea
              id="gen_base"
              placeholder="Введите базовый промпт для генерации описаний..."
              value={prompts.gen_base}
              onChange={(e) => setPrompts({ ...prompts, gen_base: e.target.value })}
              disabled={saving}
              rows={8}
              className="min-h-40 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Символов: {prompts.gen_base.length} | Строк: {prompts.gen_base.split("\n").length}
            </p>
          </CardContent>
        </Card>

        {/* Промпт для валидации */}
        <Card>
          <CardHeader>
            <CardTitle>Промпт валидации (validate_base)</CardTitle>
            <CardDescription>
              Базовый промпт для проверки описаний товаров. Будет использоваться при валидации.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="validate_base" className="text-sm font-medium">
              Текст промпта
            </Label>
            <Textarea
              id="validate_base"
              placeholder="Введите базовый промпт для валидации описаний..."
              value={prompts.validate_base}
              onChange={(e) => setPrompts({ ...prompts, validate_base: e.target.value })}
              disabled={saving}
              rows={8}
              className="min-h-40 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Символов: {prompts.validate_base.length} | Строк: {prompts.validate_base.split("\n").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm">
          {isDirty ? (
            <p className="text-yellow-600 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-600" />
              Есть несохранённые изменения
            </p>
          ) : (
            <p className="text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Все сохранено
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !isDirty}
          size="lg"
          className="gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>
    </div>
  )
}
