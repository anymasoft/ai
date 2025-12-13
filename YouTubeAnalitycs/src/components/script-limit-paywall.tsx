'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import Link from "next/link"

interface ScriptLimitPaywallProps {
  isOpen: boolean
  onClose: () => void
}

export function ScriptLimitPaywall({ isOpen, onClose }: ScriptLimitPaywallProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Закрыть</span>
          </button>
          <DialogTitle className="text-xl font-bold">Вы исчерпали лимит сценариев</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-base text-foreground">
            На бесплатном тарифе доступно до 3 AI-сценариев в месяц.
            <br />
            Вы уже использовали все доступные сценарии.
          </DialogDescription>

          <div className="space-y-3 my-4">
            <p className="text-sm text-muted-foreground">
              Чтобы продолжить создавать сценарии по YouTube-видео и работать без ограничений,
              выберите подходящий тариф.
            </p>

            <ul className="list-disc list-inside space-y-2 ml-1">
              <li className="text-sm">Готовые сценарии под съёмку</li>
              <li className="text-sm">Подходит для регулярного выпуска видео</li>
              <li className="text-sm">Один сценарий — один готовый результат</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link href="/settings/billing" onClick={onClose} className="w-full">
              <Button className="w-full" size="lg">
                Выбрать тариф
              </Button>
            </Link>
            <Link href="/settings/billing" onClick={onClose} className="w-full">
              <Button variant="outline" className="w-full" size="lg">
                Посмотреть тарифы
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
