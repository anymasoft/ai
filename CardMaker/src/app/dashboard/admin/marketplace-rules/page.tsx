"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Save, AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface MarketplaceRule {
  id: string
  marketplace: string
  content: string
  is_active: number
}

export default function MarketplaceRulesPage() {
  const [rules, setRules] = useState<MarketplaceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Загрузить правила при загрузке страницы
  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/config/marketplace-rules")
      if (!response.ok) throw new Error("Ошибка при загрузке правил")

      const data = await response.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось загрузить правила маркетплейсов")
    } finally {
      setLoading(false)
    }
  }

  const handleRuleChange = (marketplace: string, value: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.marketplace === marketplace
          ? { ...rule, content: value }
          : rule
      )
    )
  }

  const handleSave = async (marketplace: string) => {
    const rule = rules.find((r) => r.marketplace === marketplace)
    if (!rule) return

    setSaving(true)
    try {
      const response = await fetch("/api/admin/config/marketplace-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: [{ marketplace: rule.marketplace, content: rule.content }],
        }),
      })

      if (!response.ok) throw new Error("Ошибка при сохранении")

      setSavedId(marketplace)
      toast.success(`Правила для "${marketplace}" сохранены`)
      setTimeout(() => setSavedId(null), 2000)
    } catch (error) {
      console.error("Ошибка:", error)
      toast.error("Не удалось сохранить правила")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = (marketplace: string) => {
    handleRuleChange(marketplace, "")
    toast.info("Правила очищены")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Загрузка правил маркетплейсов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Правила маркетплейсов</h1>
        <p className="text-muted-foreground mt-1">
          Управляй требованиями для каждого маркетплейса. Эти правила будут учитываться при создании карточек.
        </p>
      </div>

      {rules.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Нет правил для маркетплейсов. Добавь правила через программу или создай их вручную.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Изменения правил будут применены при следующем создании карточек. Уже созданные карточки не изменяются.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue={rules[0]?.marketplace || ""} className="w-full">
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              {rules.map((rule) => (
                <TabsTrigger key={rule.marketplace} value={rule.marketplace}>
                  {rule.marketplace}
                </TabsTrigger>
              ))}
            </TabsList>

            {rules.map((rule) => (
              <TabsContent
                key={rule.marketplace}
                value={rule.marketplace}
                className="space-y-4 mt-4"
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>Правила {rule.marketplace}</CardTitle>
                        <CardDescription>
                          Требования для заголовков, описаний и других полей
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? "Активны" : "Неактивны"}
                        </Badge>
                        <Button
                          onClick={() => handleSave(rule.marketplace)}
                          disabled={saving}
                          size="icon"
                          variant="outline"
                          title="Сохранить правила"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`rules-${rule.marketplace}`}
                        className="text-base font-semibold"
                      >
                        Правила и требования
                      </Label>
                      <Textarea
                        id={`rules-${rule.marketplace}`}
                        value={rule.content}
                        onChange={(e) =>
                          handleRuleChange(rule.marketplace, e.target.value)
                        }
                        placeholder="Опиши требования для этого маркетплейса..."
                        className="min-h-96 resize-none font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Используй форматирование текста для удобства. Все требования будут показаны в интерфейсе при создании карточки.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleClear(rule.marketplace)}
                      >
                        Очистить
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  )
}
