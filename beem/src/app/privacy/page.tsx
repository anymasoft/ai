import { Metadata } from "next"
import ReactMarkdown from "react-markdown"

const privacyContent = `# Политика конфиденциальности

Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса **beem.ink**.

## 1. Общие положения

**1.1.** Оператором персональных данных является:
- **Назаров Сергей Сергеевич**, самозанятый
- ИНН: **380406117545**
- Email для связи: **support@beem.ink**

**1.2.** Используя сайт и сервис beem.ink, пользователь подтверждает согласие с настоящей Политикой конфиденциальности.

**1.3.** Оператор обрабатывает персональные данные в соответствии с действующим законодательством Российской Федерации.

## 2. Какие данные собираются

Оператор может собирать и обрабатывать следующие данные:

- адрес электронной почты;
- данные, передаваемые автоматически при использовании сайта (IP-адрес, cookies, данные браузера и устройства);
- данные, предоставляемые пользователем при использовании функциональности сервиса;
- информацию о платежах (без хранения данных банковских карт).

## 3. Цели обработки данных

Персональные данные обрабатываются в следующих целях:

- предоставление доступа к функциональности сервиса;
- идентификация пользователя;
- обработка запросов и обращений;
- улучшение качества сервиса;
- выполнение требований законодательства;
- проведение аналитики и статистических исследований.

## 4. Cookies и аналитика

Сайт может использовать файлы cookies, а также сторонние сервисы аналитики (например, Google Analytics, Яндекс Метрика) для анализа поведения пользователей и улучшения работы сервиса.

Пользователь может отключить cookies в настройках своего браузера.

## 5. Передача данных третьим лицам

**5.1.** Оператор не передает персональные данные третьим лицам, за исключением следующих случаев:

- выполнение требований законодательства;
- использование платежных и аналитических сервисов в рамках их функциональности;
- необходимость защиты прав и законных интересов Оператора.

**5.2.** Передача данных осуществляется в минимально необходимом объеме.

## 6. Защита персональных данных

Оператор принимает необходимые организационные и технические меры для защиты персональных данных от утраты, неправомерного доступа, изменения или распространения.

## 7. Срок хранения данных

Персональные данные хранятся в течение срока, необходимого для достижения целей обработки, либо до момента отзыва согласия пользователем, если иное не предусмотрено законодательством.

## 8. Права пользователя

Пользователь имеет право:

- запрашивать информацию о своих персональных данных;
- требовать уточнения, блокировки или удаления данных;
- отозвать согласие на обработку персональных данных, направив запрос на email **support@beem.ink**.

## 9. Контакты

По всем вопросам, связанным с обработкой персональных данных, пользователь может обратиться по адресу:
**support@beem.ink**`

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
