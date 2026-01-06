import { Metadata } from "next"
import ReactMarkdown from "react-markdown"

const privacyContent = `# Политика конфиденциальности

**Дата вступления в силу:** 01 января 2024 г.

## 1. Введение

Компания Beem Analytics («мы», «нас», «наша» или «Компания») уважает конфиденциальность своих пользователей. Данная Политика конфиденциальности объясняет, как мы собираем, используем, раскрываем и иным образом обрабатываем информацию в соответствии с действующим законодательством о защите данных.

## 2. Собираемая информация

Мы собираем информацию, которую вы предоставляете непосредственно, включая:
- Учетные данные (имя, адрес электронной почты, пароль)
- Профильную информацию
- Информацию о товарах и описаниях товаров, которые вы обрабатываете
- Данные об использовании платформы
- Информацию об устройстве и браузере
- IP-адрес и логи доступа

## 3. Использование информации

Мы используем собираемую информацию для:
- Предоставления и улучшения наших услуг
- Обработки описаний товаров в соответствии с требованиями маркетплейсов
- Обеспечения безопасности и предотвращения мошенничества
- Коммуникации с вами
- Соответствия правовым обязательствам

## 4. Раскрытие информации

Мы не раскрываем вашу персональную информацию третьим лицам, за исключением:
- Поставщиков услуг, работающих от нашего имени
- Случаев, требуемых по закону
- Защиты наших прав и безопасности

## 5. Безопасность данных

Мы применяем надлежащие технические и организационные меры для защиты вашей информации от неправомерного доступа и обработки.

## 6. Ваши права

У вас есть право:
- Доступа к вашим персональным данным
- Исправления неточных данных
- Удаления данных в определенных случаях
- Ограничения обработки
- Переносимости данных
- Возражения против обработки

## 7. Контактная информация

По вопросам конфиденциальности обращайтесь: support@beem.ink

## 8. Изменения политики

Мы оставляем за собой право обновлять данную политику. Изменения вступают в силу при их публикации на этой странице.`

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности Beem Analytics",
}

export default function PrivacyPage() {
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
            {privacyContent}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
