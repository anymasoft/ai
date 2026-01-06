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

        {/* Compact Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Key */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key size={18} />
                API ключ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="text-xs text-muted-foreground">
                  Загрузка...
                </div>
              ) : apiKey ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={apiKey}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyKey}
                      title={copied ? "Скопировано!" : "Копировать"}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Храните в секрете
                  </p>
                </>
              ) : (
                <div className="text-xs text-red-600">
                  Ошибка загрузки
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Formats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Форматы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-xs">
                  <Badge variant="secondary" className="text-xs">HTML + Tailwind</Badge>
                </div>
                <div className="text-xs">
                  <Badge variant="secondary" className="text-xs">HTML + CSS</Badge>
                </div>
                <div className="text-xs">
                  <Badge variant="secondary" className="text-xs">React + Tailwind</Badge>
                </div>
                <div className="text-xs">
                  <Badge variant="secondary" className="text-xs">Vue + Tailwind</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
            <CardTitle className="text-lg">Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">POST</Badge>
                <code className="text-xs font-mono">/api/generate</code>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">WS</Badge>
                <code className="text-xs font-mono">/api/stream/:id</code>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">GET</Badge>
                <code className="text-xs font-mono">/api/generations/:id</code>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">GET</Badge>
                <code className="text-xs font-mono">/api/limits</code>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">GET</Badge>
                <code className="text-xs font-mono">/api/formats</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
