"use client"

import { useState, useEffect } from "react"
import { Copy, Check, ExternalLink, Terminal, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchJSON } from "@/lib/api"

export default function ApiPage() {
  const [copied, setCopied] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load real API key for current user
  useEffect(() => {
    async function loadApiKey() {
      try {
        setLoading(true)
        // Get current user's API key
        const response = await fetchJSON<{ api_key: string }>("/api/user/api-key")
        setApiKey(response.api_key)
      } catch (error) {
        console.error("Failed to load API key:", error)
        setApiKey(null)
      } finally {
        setLoading(false)
      }
    }
    loadApiKey()
  }, [])

  const handleCopyKey = () => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            {loading ? (
              <div className="text-sm text-muted-foreground">
                Загрузка API ключа...
              </div>
            ) : apiKey ? (
              <>
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
                    title={copied ? "Скопировано!" : "Копировать"}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Храните ключ в секрете. Не публикуйте его в публичных репозиториях.
                </p>
              </>
            ) : (
              <div className="text-sm text-red-600">
                Не удалось загрузить API ключ. Попробуйте перезагрузить страницу.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Formats */}
        <Card>
          <CardHeader>
            <CardTitle>Поддерживаемые форматы</CardTitle>
            <CardDescription>Все форматы стоят 1 кредит за генерацию</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">HTML + Tailwind</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">HTML + CSS</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">React + Tailwind</Badge>
                <span className="text-xs text-muted-foreground">(требует Pro)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Vue + Tailwind</Badge>
                <span className="text-xs text-muted-foreground">(требует Pro)</span>
              </div>
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
