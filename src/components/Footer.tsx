"use client";

import { Bot } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-16 px-4 bg-gray-900 text-white" id="contacts">
      <div className="container max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-2xl font-bold mb-4">
              <Bot className="w-8 h-8" />
              ReplIQ
            </div>
            <p className="text-gray-400">
              Автоматизация ответов на отзывы для маркетплейсов
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Контакты</h3>
            <ul className="space-y-2 text-gray-400">
              <li>support@repliq.ru</li>
              <li>+7 (495) 123-45-67</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Документы</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-white">Политика конфиденциальности</a></li>
              <li><a href="#" className="hover:text-white">Условия использования</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
          <p>© 2025 ReplIQ. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}