"use client"

import { useState, useEffect } from "react"
import { Copy, Check, ExternalLink, Terminal, Key, Activity, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ApiPage() {
  const [copied, setCopied] = useState(false)
  const [apiKey, setApiKey] = useState("sk_test_•••••••••••••••••••••")
  const [limits, setLimits] = useState<any>(null)
  const [formats, setFormats] = useState<any[]>([])

  // TODO: Replace with real API key from backend
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fetch limits from API
  useEffect(() => {
    // TODO: Add real API call
    // fetch('/api/limits', {
    //   headers: { 'X-API-Key': realApiKey }
    // }).then(r => r.json()).then(setLimits)

    // Mock data for now
    setLimits({
      credits: {
        total: 10000,
        used: 2340,
        remaining: 7660,
      },
      rate_limits: {
        concurrent_generations: { limit: 10, current: 2 },
        generations_per_hour: { limit: 100, current: 47, reset_at: new Date(Date.now() + 1800000) },
      },
      tier: "pro",
    })
  }, [])

  // Fetch formats from API
  useEffect(() => {
    // TODO: Add real API call
    // fetch('/api/formats').then(r => r.json()).then(setFormats)

    // Mock data for now
    setFormats([
      { id: "html_tailwind", name: "HTML + Tailwind", cost: 10 },
      { id: "html_css", name: "HTML + CSS", cost: 10 },
      { id: "react_tailwind", name: "React + Tailwind", cost: 15 },
      { id: "vue_tailwind", name: "Vue + Tailwind", cost: 15 },
    ])
  }, [])

  const creditsProgress = limits
    ? (limits.credits.used / limits.credits.total) * 100
    : 0

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API</h1>
            <p className="text-muted-foreground mt-1">
              Интегрируйте Screen2Code в ваши приложения
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/docs" className="flex items-center gap-2">
              <ExternalLink size={16} />
              Полная документация
            </a>
          </Button>
        </div>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal size={20} />
              Что такое Screen2Code API?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Преобразовывайте скриншоты и URL в готовый код через REST API.
              Поддержка HTML, CSS, Tailwind, React и Vue.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">WebSocket потоковая передача</Badge>
              <Badge variant="secondary">Биллинг на основе кредитов</Badge>
              <Badge variant="secondary">Ограничение скорости</Badge>
              <Badge variant="secondary">Множество форматов</Badge>
            </div>
          </CardContent>
        </Card>

        {/* API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key size={20} />
              Ваш API ключ
            </CardTitle>
            <CardDescription>
              Используйте этот ключ для аутентификации в API запросах
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyKey}
                className="shrink-0"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Храните ключ в секрете. Не публикуйте его в публичных репозиториях.
            </p>
          </CardContent>
        </Card>

        {/* Usage & Limits */}
        {limits && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Credits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity size={20} />
                  Использование кредитов
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Использовано / Всего</span>
                    <span className="font-medium">
                      {limits.credits.used.toLocaleString()} / {limits.credits.total.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={creditsProgress} className="h-2" />
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Осталось: </span>
                  <span className="font-semibold text-lg">
                    {limits.credits.remaining.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground ml-1">кредитов</span>
                </div>
              </CardContent>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={20} />
                  Лимиты скорости
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Одновременные генерации</span>
                  <span className="font-medium">
                    {limits.rate_limits.concurrent_generations.current} /{" "}
                    {limits.rate_limits.concurrent_generations.limit}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Генераций в час</span>
                  <span className="font-medium">
                    {limits.rate_limits.generations_per_hour.current} /{" "}
                    {limits.rate_limits.generations_per_hour.limit}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Переустанавливается через{" "}
                  {Math.round((limits.rate_limits.generations_per_hour.reset_at - Date.now()) / 60000)}{" "}
                  минут
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Available Formats */}
        <Card>
          <CardHeader>
            <CardTitle>Доступные форматы</CardTitle>
            <CardDescription>Стоимость в кредитах за генерацию</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {formats.map((format) => (
                <div
                  key={format.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="font-medium text-sm">{format.name}</span>
                  <Badge variant="secondary">{format.cost} cr</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Примеры быстрого старта</CardTitle>
            <CardDescription>
              Примеры использования API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="mt-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`# Generate code from URL
curl -X POST http://localhost:8000/api/generate \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "type": "url",
      "data": "https://example.com"
    },
    "format": "html_tailwind",
    "instructions": "Make it beautiful"
  }'`}
                </pre>
              </TabsContent>

              <TabsContent value="javascript" className="mt-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`// Generate code from screenshot
const response = await fetch('http://localhost:8000/api/generate', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    input: {
      type: 'image',
      data: 'data:image/png;base64,...'
    },
    format: 'react_tailwind',
    instructions: 'Add dark mode support'
  })
});

const { generation_id, stream_url } = await response.json();

// Stream results via WebSocket
const ws = new WebSocket(stream_url + '?api_key=YOUR_API_KEY');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chunk') {
    console.log('Code chunk:', data.value);
  }
};`}
                </pre>
              </TabsContent>

              <TabsContent value="python" className="mt-4">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`import requests

# Generate code
response = requests.post(
    'http://localhost:8000/api/generate',
    headers={'X-API-Key': 'YOUR_API_KEY'},
    json={
        'input': {
            'type': 'url',
            'data': 'https://example.com'
        },
        'format': 'vue_tailwind',
        'instructions': 'Use composition API'
    }
)

result = response.json()
generation_id = result['generation_id']

# Get result
result = requests.get(
    f'http://localhost:8000/api/generations/{generation_id}',
    headers={'X-API-Key': 'YOUR_API_KEY'}
)

print(result.json()['result_code'])`}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Endpoints Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Конечные точки API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono">POST</Badge>
                <code className="text-xs">/api/generate</code>
                <span className="text-muted-foreground">- Начать генерирование кода</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono">WS</Badge>
                <code className="text-xs">/api/stream/:id</code>
                <span className="text-muted-foreground">- Потоковая передача прогресса генерирования</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-xs">/api/generations/:id</code>
                <span className="text-muted-foreground">- Получить результат генерирования</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-xs">/api/limits</code>
                <span className="text-muted-foreground">- Проверить использование и лимиты</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-xs">/api/formats</code>
                <span className="text-muted-foreground">- Список доступных форматов</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
