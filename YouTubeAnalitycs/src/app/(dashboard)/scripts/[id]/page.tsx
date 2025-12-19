import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Calendar, Video, FileText } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import type { SavedScript } from "@/types/scripts";

interface ScriptWithVideos extends SavedScript {
  sourceVideosData?: Array<{ id: string; title: string }>;
}



async function getScript(scriptId: string): Promise<ScriptWithVideos> {
  // ЧАСТЬ 1: Проверка авторизации ДО запроса в БД
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const userId = session.user.id;

  // ЧАСТЬ 2: Загрузка сценария
  const result = await db.execute({
    sql: `
      SELECT
        id, userId, title, hook, outline, scriptText, whyItShouldWork,
        sourceVideos, createdAt
      FROM generated_scripts
      WHERE id = ?
      LIMIT 1
    `,
    args: [scriptId],
  });

  if (result.rows.length === 0) {
    redirect("/scripts");
  }

  const row = result.rows[0];

  // ЧАСТЬ 3: Проверка доступа - принадлежит ли сценарий пользователю
  if (row.userId !== userId) {
    redirect("/scripts");
  }

  const sourceVideoIds: string[] = JSON.parse(row.sourceVideos as string);

  // Загрузить названия видео
  let sourceVideosData: Array<{ id: string; title: string }> = [];
  if (sourceVideoIds.length > 0) {
    const placeholders = sourceVideoIds.map(() => "?").join(",");
    const videosResult = await db.execute({
      sql: `SELECT videoId, title FROM channel_videos WHERE videoId IN (${placeholders})`,
      args: sourceVideoIds,
    });

    const videoTitlesMap = new Map<string, string>();
    console.log("[DEBUG] videosResult.rows structure:", JSON.stringify(videosResult.rows, null, 2));
    console.log("[DEBUG] First row keys:", Object.keys(videosResult.rows[0] || {}));

    videosResult.rows.forEach((vRow, idx) => {
      console.log(`[DEBUG] Row ${idx}:`, { videoId: vRow.videoId, title: vRow.title, raw: vRow });
      videoTitlesMap.set(vRow.videoId as string, vRow.title as string);
    });

    console.log("[DEBUG] videoTitlesMap:", Array.from(videoTitlesMap.entries()));

    sourceVideosData = sourceVideoIds.map((id) => ({
      id,
      title: videoTitlesMap.get(id) || id,
    }));

    console.log("[DEBUG] final sourceVideosData:", JSON.stringify(sourceVideosData, null, 2));
  }

  const script: ScriptWithVideos = {
    id: row.id as string,
    userId: row.userId as string,
    title: row.title as string,
    hook: row.hook as string,
    outline: JSON.parse(row.outline as string),
    scriptText: row.scriptText as string,
    whyItShouldWork: row.whyItShouldWork as string,
    sourceVideos: sourceVideoIds,
    createdAt: row.createdAt as number,
    sourceVideosData,
  };

  return script;
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
};

export default async function ScriptViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: scriptId } = await params;
  const script = await getScript(scriptId);

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
            <Badge variant="outline" className="gap-1 min-w-fit max-w-none whitespace-nowrap">
              <FileText className="h-3 w-3" />
              ID: {script.id}
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
            <div className="bg-muted/30 p-4 rounded-md whitespace-pre-wrap font-mono text-sm space-y-3">
              {script.scriptText.split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph || "\u00A0"}</p>
              ))}
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
            <div className="bg-primary/5 p-4 rounded-md border border-primary/20 space-y-3">
              {script.whyItShouldWork.split("\n").map((paragraph, index) => (
                <p key={index} className="text-foreground">
                  {paragraph || "\u00A0"}
                </p>
              ))}
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
              {(script.sourceVideosData || script.sourceVideos.map((id) => ({ id, title: id }))).map(
                (video, index) => (
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
                )
              )}
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
