"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Copy, Calendar, Video, FileText, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import type { SavedScript } from "@/types/scripts";

interface ScriptWithVideos extends SavedScript {
  sourceVideosData?: Array<{ id: string; title: string }>;
}

export default function ScriptViewPage() {
  const params = useParams();
  const router = useRouter();
  const [script, setScript] = useState<ScriptWithVideos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const scriptId = params.id as string;

  const fetchScript = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/scripts/${scriptId}`);
      const data = await response.json();

      if (!response.ok) {
        setError({
          message: data.error || "Failed to fetch script",
          statusCode: response.status,
        });
        return;
      }

      setScript(data);
    } catch (err) {
      console.error("Error fetching script:", err);
      setError({
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scriptId) {
      fetchScript();
    }
  }, [scriptId]);

  const handleCopyScript = async () => {
    if (!script) return;

    try {
      setCopying(true);

      const scriptText = `Заголовок: ${script.title}\n\nХук: ${script.hook}\n\nСтруктура:\n${script.outline.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\nТекст сценария:\n${script.scriptText}\n\nПочему должно выстрелить:\n${script.whyItShouldWork}`;

      await navigator.clipboard.writeText(scriptText);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Не удалось скопировать сценарий");
    } finally {
      setCopying(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
  };

  if (loading && !script) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Просмотр сценария</h1>
          <p className="text-muted-foreground">Загрузка деталей сценария...</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка сценария...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Редиректим на 404 при неавторизованном доступе или если сценарий не найден
  if (error && !script && (error.statusCode === 401 || error.statusCode === 404)) {
    notFound();
  }

  // Показываем ошибку для других типов ошибок
  if (error && !script) {
    return (
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Ошибка загрузки сценария</h1>
          <p className="text-muted-foreground">Произошла ошибка при загрузке сценария</p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-2">Ошибка загрузки сценария</p>
              <p className="text-muted-foreground text-sm mb-4">{error.message}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={fetchScript}>Попробовать снова</Button>
                <Link href="/scripts">
                  <Button variant="outline">Назад к списку</Button>
                </Link>
              </div>
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
          {/* Заголовок и навигация */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/scripts">
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    Назад
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold">Просмотр сценария</h1>
              </div>
              <p className="text-muted-foreground">
                Детальный просмотр сгенерированного сценария YouTube
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCopyScript}
                disabled={copying}
                size="icon"
                title={copied ? "Скопировано!" : "Копировать сценарий"}
              >
                {copying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : copied ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Мета-информация */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              Создан: {formatDate(script.createdAt)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Video className="h-3 w-3" />
              Исходных видео: {script.sourceVideos.length}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              ID: {script.id.substring(0, 8)}...
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Заголовок сценария */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{script.title}</CardTitle>
            <CardDescription className="text-lg">{script.hook}</CardDescription>
          </CardHeader>
        </Card>

        {/* Структура сценария */}
        <Card>
          <CardHeader>
            <CardTitle>Структура сценария</CardTitle>
            <CardDescription>Пошаговый план видео</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-2">
              {script.outline.map((item, index) => (
                <li key={index} className="pl-2">
                  <div className="bg-muted/50 p-3 rounded-md">
                    <span className="font-medium">{item}</span>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Текст сценария */}
        <Card>
          <CardHeader>
            <CardTitle>Текст сценария</CardTitle>
            <CardDescription>Полный текст для создания видео</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 p-4 rounded-md whitespace-pre-wrap font-mono text-sm">
              {script.scriptText}
            </div>
          </CardContent>
        </Card>

        {/* Почему должно выстрелить */}
        <Card>
          <CardHeader>
            <CardTitle>Почему этот сценарий должен выстрелить</CardTitle>
            <CardDescription>Анализ потенциала сценария</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
              <p className="text-foreground">{script.whyItShouldWork}</p>
            </div>
          </CardContent>
        </Card>

        {/* Исходные видео */}
        <Card>
          <CardHeader>
            <CardTitle>Исходные видео</CardTitle>
            <CardDescription>Видео конкурентов, на основе которых был сгенерирован сценарий</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(script.sourceVideosData || script.sourceVideos.map(id => ({ id, title: id }))).map((video, index) => (
                <div key={video.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <a
                    href={`https://www.youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline line-clamp-1"
                    title={video.title}
                  >
                    {video.title}
                  </a>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Всего использовано {script.sourceVideos.length} видео для анализа и генерации этого сценария.
            </p>
          </CardContent>
        </Card>

        {/* Кнопки действий */}
        <div className="flex justify-between">
          <Link href="/scripts">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Назад к списку
            </Button>
          </Link>
          <Link href="/trending">
            <Button className="gap-2">
              <Video className="h-4 w-4" />
              Создать новый сценарий
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
