import { Metadata } from "next"
import ReactMarkdown from "react-markdown"

const termsContent = `# Условия использования (Пользовательское соглашение)

Настоящие Условия использования регулируют порядок работы с сервисом **beem.ink**.

## 1. Общие положения

**1.1.** Сервис beem.ink предоставляется:
- **Назаровым Сергеем Сергеевичем**, самозанятым
- ИНН: **380406117545**
- Email: **support@beem.ink**

**1.2.** Используя сервис, пользователь подтверждает, что ознакомился с настоящими Условиями и принимает их в полном объеме.

## 2. Описание сервиса

**2.1.** beem.ink — это онлайн-сервис, предоставляющий цифровые инструменты и функциональность в автоматическом режиме.

**2.2.** Конкретный функционал сервиса может изменяться, дополняться или ограничиваться без предварительного уведомления пользователя.

## 3. Регистрация и доступ

**3.1.** Для доступа к отдельным функциям сервиса может потребоваться регистрация.

**3.2.** Пользователь обязуется предоставлять достоверную информацию и не передавать свои учетные данные третьим лицам.

## 4. Оплата и возвраты

**4.1.** Некоторые функции сервиса могут предоставляться на платной основе.

**4.2.** Оплата осуществляется через сторонние платежные системы.

**4.3.** Возврат средств возможен в случаях, предусмотренных законодательством Российской Федерации, либо по решению Оператора.

## 5. Ответственность

**5.1.** Сервис предоставляется «как есть». Оператор не гарантирует бесперебойную и безошибочную работу сервиса.

**5.2.** Оператор не несет ответственности за убытки, возникшие в результате использования или невозможности использования сервиса.

**5.3.** Пользователь несет ответственность за законность размещаемого или обрабатываемого им контента.

## 6. Ограничения

Пользователю запрещается:

- использовать сервис в незаконных целях;
- пытаться получить несанкционированный доступ к системе;
- вмешиваться в работу сервиса или обходить технические ограничения.

## 7. Изменение условий

Оператор вправе изменять настоящие Условия в одностороннем порядке.
Актуальная версия всегда доступна на сайте beem.ink.

## 8. Контакты

По всем вопросам, связанным с использованием сервиса, обращаться:
**support@beem.ink**`

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
