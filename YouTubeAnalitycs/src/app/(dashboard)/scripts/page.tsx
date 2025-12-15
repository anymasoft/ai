import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Calendar, Video, Copy, Eye, CheckCircle, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import type { SavedScript } from "@/types/scripts";

async function getScripts(userId: string): Promise<SavedScript[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, userId, title, hook, outline, scriptText, whyItShouldWork, sourceVideos, createdAt
        FROM generated_scripts
        WHERE userId = ?
        ORDER BY createdAt DESC
      `,
      args: [userId],
    });

    return (result.rows || []).map((row) => ({
      id: row.id as string,
      userId: row.userId as string,
      title: row.title as string,
      hook: row.hook as string,
      outline: JSON.parse(row.outline as string),
      scriptText: row.scriptText as string,
      whyItShouldWork: row.whyItShouldWork as string,
      sourceVideos: JSON.parse(row.sourceVideos as string),
      createdAt: row.createdAt as number,
    }));
  } catch (error) {
    console.error("Error fetching scripts:", error);
    return [];
  }
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
};

export default async function ScriptsHistoryPage() {
  // Проверка авторизации ДО загрузки данных
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const userId = session.user.id;
  const scripts = await getScripts(userId);

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
                    <Link key={script.id} href={`/scripts/${script.id}`} className="contents">
                      <TableRow className="cursor-pointer hover:bg-muted/50">
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
                        <TableCell className="text-right">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    </Link>
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
