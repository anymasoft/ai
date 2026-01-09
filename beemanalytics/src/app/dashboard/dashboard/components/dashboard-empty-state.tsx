import { Plus, Users, TrendingUp, Zap, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="relative mb-8">
        {/* Decorative background circles */}
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-3xl rounded-full" />
        <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <TrendingUp className="w-12 h-12 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center mb-3">
        Добро пожаловать в YouTube Аналитику
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-8 text-base leading-relaxed">
        Начните отслеживать каналы конкурентов, чтобы раскрыть инсайты, найти тренды и генерировать идеи для контента.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-12">
        <Button size="lg" asChild className="gap-2 px-6">
          <Link href="/dashboard/competitors">
            <Plus className="w-4 h-4" />
            Добавить первый канал
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <CardTitle className="text-base">Отслеживать конкурентов</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-relaxed">
              Мониторьте рост каналов: подписчики, просмотры, частота публикаций — всё в одном месте.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <CardTitle className="text-base">Откройте новые возможности</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-relaxed">
              Ловите вирусные видео до того, как о них узнают остальные.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
          <CardHeader className="pb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <CardTitle className="text-base">Генерировать сценарии</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-relaxed">
              Генерируйте сценарии, которые повторяют структуру самых быстрорастущих видео.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
