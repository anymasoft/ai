"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, Zap, Clock, FileCode, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function DocsPage() {
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Документация API</h1>
          <p className="text-muted-foreground mt-1">
            Полное описание REST API для Screenshot-to-Code
          </p>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline">Версия 1.0</Badge>
            <Badge variant="outline">Обновлено: 24.12.2024</Badge>
          </div>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Аутентификация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Все запросы (кроме <code className="bg-muted px-1.5 py-0.5 rounded">/api/health</code>)
              требуют API ключ в заголовке:
            </p>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>X-API-Key: your_api_key_here</code>
            </pre>
            <div className="space-y-2">
              <p className="text-sm font-medium">Коды ответов:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <code className="bg-muted px-1.5 py-0.5 rounded">401 Unauthorized</code> - отсутствует или невалидный API ключ</li>
                <li>• <code className="bg-muted px-1.5 py-0.5 rounded">403 Forbidden</code> - валидный ключ, но недостаточно credits</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Эндпоинты API</CardTitle>
            <CardDescription>Все доступные методы REST API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Health */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-sm">/api/health</code>
              </div>
              <p className="text-sm text-muted-foreground">Health check endpoint. Не требует аутентификации.</p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Ответ: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">200 OK</code></p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "status": "ok",
  "version": "1.0"
}`}
                </pre>
              </div>
            </div>

            <Separator />

            {/* Formats */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-sm">/api/formats</code>
              </div>
              <p className="text-sm text-muted-foreground">Список доступных форматов вывода и их стоимость.</p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Ответ: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">200 OK</code></p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "formats": [
    {
      "id": "html_tailwind",
      "name": "HTML + Tailwind",
      "tier": "free",
      "cost": 1
    },
    {
      "id": "react_tailwind",
      "name": "React + Tailwind",
      "tier": "pro",
      "cost": 2
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <Separator />

            {/* Generate */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="font-mono">POST</Badge>
                <code className="text-sm">/api/generate</code>
              </div>
              <div className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-4">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Credits списываются немедленно</strong> при успешном старте преобразования.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Запуск преобразования кода.</p>

              <div className="space-y-2">
                <p className="text-sm font-medium">Тело запроса:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "input": {
    "type": "image | url",
    "data": "base64_image_data | https://example.com"
  },
  "format": "html_tailwind",
  "instructions": "Опциональные инструкции"
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Валидация:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">input.type</code>: обязательно, одно из <code className="bg-muted px-1 py-0.5 rounded">["image", "url"]</code></li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">input.data</code>: обязательно (base64 для image, URL для url)</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">format</code>: обязательно, один из доступных форматов</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">instructions</code>: опционально, макс. 500 символов</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Ответ: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">201 Created</code></p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "generation_id": "gen_abc123def456",
  "status": "processing",
  "credits_charged": 2,
  "stream_url": "ws://api.example.com/api/stream/gen_abc123def456"
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Возможные ошибки:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">400</code> - невалидный input</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">402</code> - недостаточно credits</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">429</code> - превышен rate limit</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* WebSocket */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">WS</Badge>
                <code className="text-sm">/api/stream/:id</code>
              </div>
              <p className="text-sm text-muted-foreground">WebSocket stream для получения обновлений в реальном времени.</p>

              <div className="space-y-2">
                <p className="text-sm font-medium">Подключение:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  <code>ws://api.example.com/api/stream/gen_abc123?api_key=xxx</code>
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Типы сообщений от сервера:</p>
                <ul className="text-xs text-muted-foreground space-y-2 ml-4">
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">chunk</code> - фрагмент кода</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">status</code> - обновление статуса</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">code</code> - полный код</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">variant_complete</code> - вариант завершён</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">complete</code> - преобразование завершено</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">error</code> - ошибка</li>
                </ul>
              </div>

              <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Соединение закрывается после завершения преобразования или через 10 минут таймаута.
                </p>
              </div>
            </div>

            <Separator />

            {/* Get Generation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-sm">/api/generations/:id</code>
              </div>
              <p className="text-sm text-muted-foreground">Получить результат и метаданные преобразования.</p>

              <div className="space-y-2">
                <p className="text-sm font-medium">Ответ: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">200 OK</code></p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "id": "gen_abc123def456",
  "status": "completed",
  "format": "html_tailwind",
  "created_at": "2024-12-24T10:30:00Z",
  "completed_at": "2024-12-24T10:30:15Z",
  "result": {
    "code": "<html>...</html>"
  },
  "credits_charged": 1
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Возможные статусы:</p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">processing</code> - преобразование в процессе</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">completed</code> - успешно завершена</li>
                  <li>• <code className="bg-muted px-1 py-0.5 rounded">failed</code> - произошла ошибка</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Limits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">GET</Badge>
                <code className="text-sm">/api/limits</code>
              </div>
              <p className="text-sm text-muted-foreground">Текущее использование и лимиты API ключа.</p>

              <div className="space-y-2">
                <p className="text-sm font-medium">Ответ: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">200 OK</code></p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "credits": {
    "available": 1000,
    "total": 1000,
    "used": 0
  },
  "rate_limits": {
    "concurrent_generations": {
      "limit": 10,
      "current": 2
    },
    "generations_per_hour": {
      "limit": 100,
      "current": 5,
      "reset_at": "2024-12-24T11:00:00Z"
    }
  },
  "tier": "pro"
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Logic */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode size={20} />
              Логика списания Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Credits списываются немедленно</strong> при успешном запуске преобразования (до её завершения).
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Когда списываются credits:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• ✅ При успешном <code className="bg-muted px-1 py-0.5 rounded">POST /api/generate</code></li>
                <li>• ❌ НЕ списываются при ошибке запроса (400/429)</li>
                <li>• ❌ НЕ возвращаются при неудачном преобразовании</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Стоимость форматов:</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Формат</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">html_tailwind</TableCell>
                    <TableCell className="text-right">1</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">html_css</TableCell>
                    <TableCell className="text-right">1</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">react_tailwind</TableCell>
                    <TableCell className="text-right">2</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">vue_tailwind</TableCell>
                    <TableCell className="text-right">2</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Почему без возвратов:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Вызовы к API моделей происходят сразу</li>
                <li>• Затраты есть даже при неудаче</li>
                <li>• Простая система учёта без edge cases</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Коды Ошибок</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono">400</TableCell>
                  <TableCell className="font-mono text-xs">invalid_input</TableCell>
                  <TableCell>Ошибка валидации</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">401</TableCell>
                  <TableCell className="font-mono text-xs">unauthorized</TableCell>
                  <TableCell>Отсутствует/невалидный API ключ</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">402</TableCell>
                  <TableCell className="font-mono text-xs">insufficient_credits</TableCell>
                  <TableCell>Недостаточно credits</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">403</TableCell>
                  <TableCell className="font-mono text-xs">forbidden</TableCell>
                  <TableCell>Валидный ключ, доступ запрещён</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">404</TableCell>
                  <TableCell className="font-mono text-xs">not_found</TableCell>
                  <TableCell>Ресурс не найден</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">429</TableCell>
                  <TableCell className="font-mono text-xs">rate_limit</TableCell>
                  <TableCell>Слишком много запросов</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">500</TableCell>
                  <TableCell className="font-mono text-xs">internal_error</TableCell>
                  <TableCell>Ошибка сервера</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={20} />
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">На один API ключ:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>Одновременных преобразований:</strong> 10</li>
                <li>• <strong>Преобразований в час:</strong> 100</li>
                <li>• <strong>Макс. размер изображения:</strong> 10MB</li>
                <li>• <strong>Таймауты:</strong> 60s (HTTP), 600s (WebSocket)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Важные Заметки</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Все временные метки в формате ISO 8601 UTC</li>
              <li>• Все ID используют префиксы: <code className="bg-muted px-1 py-0.5 rounded">gen_</code>, <code className="bg-muted px-1 py-0.5 rounded">key_</code></li>
              <li>• Base64 изображения должны включать data URI: <code className="bg-muted px-1 py-0.5 rounded">data:image/png;base64,...</code></li>
              <li>• WebSocket переподключение не поддерживается - используйте polling</li>
              <li>• Результаты преобразований хранятся 30 дней</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
