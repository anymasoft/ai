import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { fetchJSON } from "@/lib/api"

interface Tariff {
  key: string
  name: string
  price_rub: number
  credits: number
  is_active: boolean
}

interface EditingTariff {
  key: string
  price_rub: number | string
  credits: number | string
}

export default function AdminTariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingTariff | null>(null)

  useEffect(() => {
    fetchTariffs()
  }, [])

  async function fetchTariffs() {
    try {
      setLoading(true)
      const data = await fetchJSON<{ tariffs: Tariff[] }>("/api/billing/tariffs")
      setTariffs(data.tariffs || [])
    } catch (error) {
      console.error("Error loading tariffs:", error)
      toast.error("Ошибка при загрузке тарифов")
    } finally {
      setLoading(false)
    }
  }

  function startEditing(tariff: Tariff) {
    setEditingId(tariff.key)
    setEditing({
      key: tariff.key,
      price_rub: tariff.price_rub,
      credits: tariff.credits,
    })
  }

  function cancelEditing() {
    setEditingId(null)
    setEditing(null)
  }

  async function saveTariff() {
    if (!editing) return

    try {
      setSaving(true)

      const price_rub = parseFloat(editing.price_rub as string)
      const credits = parseInt(editing.credits as string)

      if (isNaN(price_rub) || isNaN(credits)) {
        toast.error("Цена и количество преобразований должны быть числами")
        return
      }

      if (price_rub < 0 || credits < 0) {
        toast.error("Цена и количество преобразований не могут быть отрицательными")
        return
      }

      const response = await fetchJSON(`/api/admin/tariffs/${editing.key}`, {
        method: "PUT",
        body: JSON.stringify({
          price_rub,
          credits,
        }),
      })

      if (response.success) {
        toast.success(`Тариф ${editing.key} обновлен`)
        setEditingId(null)
        setEditing(null)
        await fetchTariffs()
      }
    } catch (error) {
      console.error("Error saving tariff:", error)
      toast.error("Ошибка при сохранении тарифа")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Управление тарифами</h1>
          <p className="text-muted-foreground">Редактируйте цены и количество преобразований</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchTariffs}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Тарифы</CardTitle>
          <CardDescription>
            Изменения будут применены сразу на все новые платежи
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Цена (₽)</TableHead>
                    <TableHead>Генерации</TableHead>
                    <TableHead className="w-[100px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tariffs.map((tariff) => (
                    <TableRow key={tariff.key}>
                      <TableCell className="font-medium">{tariff.name}</TableCell>
                      <TableCell>
                        {editingId === tariff.key ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editing?.price_rub}
                            onChange={(e) =>
                              setEditing({
                                ...editing!,
                                price_rub: e.target.value,
                              })
                            }
                            className="w-[120px]"
                          />
                        ) : (
                          tariff.price_rub.toFixed(2)
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tariff.key ? (
                          <Input
                            type="number"
                            min="0"
                            value={editing?.credits}
                            onChange={(e) =>
                              setEditing({
                                ...editing!,
                                credits: e.target.value,
                              })
                            }
                            className="w-[120px]"
                          />
                        ) : (
                          tariff.credits
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === tariff.key ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={saveTariff}
                              disabled={saving}
                            >
                              {saving && (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(tariff)}
                          >
                            Изменить
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
