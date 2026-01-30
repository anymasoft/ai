"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconSettings, IconUser, IconBell, IconShield } from "@tabler/icons-react"

export default function SettingsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="@container/main">
            <div className="p-6 space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                <p className="text-muted-foreground">Управляйте настройками аккаунта и системы мониторинга</p>
              </div>

              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile">Профиль</TabsTrigger>
                  <TabsTrigger value="notifications">Уведомления</TabsTrigger>
                  <TabsTrigger value="security">Безопасность</TabsTrigger>
                  <TabsTrigger value="system">Система</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconUser className="h-5 w-5" />
                        Информация профиля
                      </CardTitle>
                      <CardDescription>Обновите информацию вашего профиля</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Имя</Label>
                        <Input id="name" defaultValue="Администратор" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue="admin@telemonitor.ru" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="company">Компания</Label>
                        <Input id="company" defaultValue="TeleMonitor Inc." />
                      </div>
                      <Button>Сохранить изменения</Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconBell className="h-5 w-5" />
                        Настройки уведомлений
                      </CardTitle>
                      <CardDescription>Управляйте типами получаемых уведомлений</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Email уведомления</Label>
                          <p className="text-sm text-muted-foreground">Получать уведомления на email</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Telegram уведомления</Label>
                          <p className="text-sm text-muted-foreground">Получать уведомления в Telegram</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Еженедельные отчеты</Label>
                          <p className="text-sm text-muted-foreground">Получать сводные отчеты каждую неделю</p>
                        </div>
                        <Switch />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconShield className="h-5 w-5" />
                        Безопасность
                      </CardTitle>
                      <CardDescription>Настройки безопасности аккаунта</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="current-password">Текущий пароль</Label>
                        <Input id="current-password" type="password" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="new-password">Новый пароль</Label>
                        <Input id="new-password" type="password" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                        <Input id="confirm-password" type="password" />
                      </div>
                      <Button>Изменить пароль</Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconSettings className="h-5 w-5" />
                        Системные настройки
                      </CardTitle>
                      <CardDescription>Общие настройки системы мониторинга</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Автоматическое обновление</Label>
                          <p className="text-sm text-muted-foreground">Автоматически обновлять данные каналов</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Темная тема</Label>
                          <p className="text-sm text-muted-foreground">Использовать темную тему интерфейса</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="update-interval">Интервал обновления (минуты)</Label>
                        <Input id="update-interval" type="number" defaultValue="5" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
