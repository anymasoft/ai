import { Metadata } from "next"
import ReactMarkdown from "react-markdown"

const termsContent = `# Условия использования

**Дата вступления в силу:** 01 января 2024 г.

## 1. Принятие условий

Используя платформу Beem Analytics, вы соглашаетесь с настоящими Условиями использования. Если вы не согласны с какой-либо частью этих условий, пожалуйста, не используйте наш сервис.

## 2. Описание услуги

Beem Analytics предоставляет инструмент для подготовки описаний товаров в соответствии с требованиями маркетплейсов Ozon и Wildberries. Сервис включает:
- Анализ описаний товаров
- Выявление ошибок и несоответствий требованиям
- Автоматическое исправление и оптимизацию текстов
- Проверку соответствия стандартам платформ

## 3. Лицензия на использование

Мы предоставляем вам личную, неисключительную, неподлежащую передаче лицензию на использование платформы в соответствии с этими Условиями. Вы не можете:
- Копировать, модифицировать или создавать производные работы
- Сдавать в аренду, кредит или передавать платформу
- Удалять или изменять уведомления об авторских правах
- Использовать платформу в незаконных целях

## 4. Учетные записи пользователей

Вы отвечаете за:
- Конфиденциальность учетных данных
- Все действия, выполняемые под вашей учетной записью
- Соблюдение всех применимых законов и нормативных актов

## 5. Содержание пользователя

Вы сохраняете все права на содержание, которое загружаете. Вы предоставляете нам лицензию на использование вашего содержания для предоставления услуг.

## 6. Ограничение ответственности

В максимальной степени, разрешенной законом, Beem Analytics не несет ответственность за:
- Косвенные, случайные, штрафные убытки
- Потерю прибыли или данных
- Перебои в обслуживании

## 7. Отказ от гарантий

ПЛАТФОРМА ПРЕДОСТАВЛЯЕТСЯ НА УСЛОВИЯХ «КАК ЕСТЬ» БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ, ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ.

## 8. Прекращение

Мы оставляем за собой право отключить или удалить учетную запись в случае нарушения этих Условий или применимого законодательства.

## 9. Третьи стороны

Данная услуга может содержать ссылки на сторонние сайты. Мы не несем ответственность за содержание этих сайтов.

## 10. Применимое законодательство

Данные Условия регулируются и толкуются в соответствии с действующим законодательством Российской Федерации.

## 11. Контактная информация

По вопросам условий использования обращайтесь: support@beem.ink

## 12. Изменения условий

Мы оставляем за собой право обновлять эти Условия. Продолжение использования платформы означает ваше согласие с изменениями.`

export const metadata: Metadata = {
  title: "Условия использования",
  description: "Условия использования Beem Analytics",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 lg:px-6 max-w-4xl">
        <article className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-bold prose-h1:text-4xl prose-h1:mb-8 prose-h1:mt-0
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border prose-h2:pb-3
          prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
          prose-li:text-base prose-li:my-2
          prose-ul:my-6 prose-ul:pl-6
          prose-strong:font-semibold prose-strong:text-foreground
          prose-em:text-muted-foreground prose-em:italic
          prose-code:text-sm prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded
          prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
          prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
          prose-hr:border-border
        ">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-8 mt-0 text-foreground" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-10 mb-4 pb-3 border-b border-border text-foreground" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground" {...props} />,
              p: ({node, ...props}) => <p className="text-base leading-relaxed mb-4 text-foreground" {...props} />,
              ul: ({node, ...props}) => <ul className="my-6 ml-6 space-y-2 text-foreground" {...props} />,
              li: ({node, ...props}) => <li className="text-base text-foreground" {...props} />,
              strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
              em: ({node, ...props}) => <em className="italic text-muted-foreground" {...props} />,
            }}
          >
            {termsContent}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
