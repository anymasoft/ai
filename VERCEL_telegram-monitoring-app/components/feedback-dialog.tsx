"use client"

import { useEffect, useRef } from "react"
import { IconMail } from "@tabler/icons-react"

export function FeedbackDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const handleClose = () => {
    dialogRef.current?.close()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Здесь будет логика отправки формы
    console.log("Форма обратной связи отправлена")
    handleClose()
  }

  // Функция для открытия диалога из других компонентов
  useEffect(() => {
    // Глобальная функция для открытия диалога
    ;(window as any).openFeedbackDialog = () => {
      dialogRef.current?.showModal()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className="rounded-lg shadow-xl backdrop:bg-black/50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <IconMail className="h-5 w-5" />
              Обратная связь
            </h3>
            <button 
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ✕
            </button>
          </div>
          
          <div>
            <label htmlFor="feedback-email" className="block text-sm font-medium mb-1">
              Email для ответа
            </label>
            <input
              id="feedback-email"
              type="email"
              className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label htmlFor="feedback-message" className="block text-sm font-medium mb-1">
              Сообщение
            </label>
            <textarea
              id="feedback-message"
              rows={4}
              className="w-full p-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Опишите вашу проблему или предложение..."
              required
            ></textarea>
          </div>
          
          <div className="flex justify-end gap-2">
            <button 
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Отмена
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Отправить
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
