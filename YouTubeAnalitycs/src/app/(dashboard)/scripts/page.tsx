"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Calendar, Video, Copy, Eye, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import type { SavedScript } from "@/types/scripts";

export default function ScriptsHistoryPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchScripts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/scripts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch scripts");
      }

      setScripts(data.scripts || []);
    } catch (err) {
      console.error("Error fetching scripts:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleCopyScript = async (script: SavedScript) => {
    try {
      setCopyingId(script.id);

      const scriptText = `Заголовок: ${script.title}\n\nХук: ${script.hook}\n\nСтруктура:\n${script.outline.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\nТекст сценария:\n${script.scriptText}\n\nПочему должно выстрелить:\n${script.whyItShouldWork}`;

      await navigator.clipboard.writeText(scriptText);

      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Не удалось скопировать сценарий");
    } finally {
      setCopyingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
  };

  if (loading && scripts.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">История сценариев</h1>
          <p className="text-muted-foreground">Просмотр всех сгенерированных сценариев YouTube</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка сценариев...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && scripts.length === 0) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">История сценариев</h1>
          <p className="text-muted-foreground">Просмотр всех сгенерированных сценариев YouTube</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-2">Ошибка загрузки сценариев</p>
              <p className="text-muted-foreground text-sm mb-4">{error}</p>
              <Button onClick={fetchScripts}>Попробовать снова</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6">
      <div className="mb-8">
        <div className="flex flex-col gap-6">
          {/* Заголовок */}
          <div>
            <h1 className="text-3xl font-bold">История сценариев</h1>
            <p className="text-muted-foreground mt-1">
              Просмотр всех сгенерированных сценариев YouTube
            </p>
          </div>

          {/* Кнопка обновления */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchScripts}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Обновление...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Обновить список
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {scripts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Сценариев пока нет</CardTitle>
            <CardDescription>
              Сгенерируйте свой первый сценарий на основе видео конкурентов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Чтобы создать сценарий:
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground space-y-1">
              <li>Перейдите в раздел "Trending"</li>
              <li>Выберите видео конкурентов с высоким momentum</li>
              <li>Нажмите "Сгенерировать сценарий на основе выбранных видео"</li>
              <li>Ваш сценарий появится здесь после генерации</li>
            </ul>
            <div className="mt-4">
              <Link href="/trending">
                <Button className="gap-2">
                  <Video className="h-4 w-4" />
                  Перейти к Trending
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Все сценарии</CardTitle>
            <CardDescription>
              Показано {scripts.length} сценариев. Сортировка по дате создания (новые сверху)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Сценарий
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Создан
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Видео
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scripts.map((script) => (
                    <TableRow
                      key={script.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/scripts/${script.id}`)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium line-clamp-2 max-w-[300px] truncate" title={script.title}>
                            {script.title}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-1 max-w-[300px] truncate" title={script.hook}>
                            {script.hook}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {formatDate(script.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(script.createdAt * 1000), "dd MMMM yyyy", { locale: ru })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            <Badge variant="outline" className="gap-1">
                              <Video className="h-3 w-3" />
                              {script.sourceVideos.length}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            исходных видео
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Link href={`/scripts/${script.id}`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Eye className="h-3 w-3" />
                              Открыть
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleCopyScript(script)}
                            disabled={copyingId === script.id}
                          >
                            {copyingId === script.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : copiedId === script.id ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Скопировано!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Копировать
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              <p>
                <strong>Всего сценариев:</strong> {scripts.length}
              </p>
              <p className="mt-1">
                Чтобы сгенерировать новый сценарий, перейдите в раздел "Trending" и выберите видео конкурентов.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
