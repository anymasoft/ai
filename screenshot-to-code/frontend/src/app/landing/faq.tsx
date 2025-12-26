import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQItem = {
  question: string;
  answer: string;
};

const faqItems: FAQItem[] = [
  {
    question: "Какие форматы поддерживаются?",
    answer: "Мы поддерживаем HTML + Tailwind, HTML + CSS, React + Tailwind, Vue + Tailwind и многое другое.",
  },
  {
    question: "Сколько стоит Screen2Code?",
    answer: "Базовая версия бесплатна с ограничениями. Премиум план начинается с $9.99 в месяц.",
  },
  {
    question: "Можно ли использовать коммерчески?",
    answer: "Да, код, сгенерированный с помощью Screen2Code, полностью ваш и может использоваться в коммерческих целях.",
  },
  {
    question: "Какие модели AI поддерживаются?",
    answer: "Мы используем Claude 3.5 Sonnet и GPT-4o для лучших результатов. Также доступна поддержка других моделей.",
  },
  {
    question: "Есть ли API для интеграции?",
    answer: "Да, мы предоставляем REST API для интеграции Screen2Code в ваши приложения.",
  },
  {
    question: "Какой уровень точности генерации?",
    answer: "Современные AI модели достигают 85-95% точности в зависимости от сложности дизайна.",
  },
];

export function FAQ() {
  const items = faqItems;

  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-10 font-semibold text-3xl text-primary">
          Часто задаваемые вопросы
        </h2>

        <Accordion type="single" collapsible>
          {items.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>

              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
