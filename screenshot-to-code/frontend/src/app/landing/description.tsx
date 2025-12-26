import {
  IconAdjustments,
  IconBolt,
  IconBook,
  IconTestPipe,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

const featureIcons = [IconBolt, IconTestPipe, IconBook, IconAdjustments];

const imageClassNames =
  "border-border w-3xl max-w-none rounded-xl border sm:w-228 md:-ml-4 lg:-ml-0";

const features = [
  {
    title: "Быстрое преобразование",
    description: "Мгновенно преобразуй скриншоты в работающий код",
  },
  {
    title: "Поддержка видео",
    description: "Записывай видео-туториалы и генерируй код из них",
  },
  {
    title: "Документирование",
    description: "Автоматически создавай документацию для своего кода",
  },
  {
    title: "Полная настройка",
    description: "Выбирай язык, фреймворк и стиль кода по своему усмотрению",
  },
];

export function Description() {

  return (
    <div className="py-24 sm:py-32">
      <div className="px-4">
        <div className="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="lg:pr-8">
            <div className="lg:max-w-xl">
              <h2 className="font-semibold text-base text-primary">
                Возможности
              </h2>

              <p className="mt-2 text-pretty font-semibold text-4xl text-foreground tracking-tight sm:text-5xl">
                Всё что тебе нужно для генерации кода
              </p>

              <p className="mt-6 text-lg/8 text-muted-foreground">
                Мощные инструменты для преобразования дизайна в код
              </p>

              <dl className="mt-10 max-w-xl space-y-8 text-base/7 text-muted-foreground lg:max-w-none">
                {features.map((feature, index) => {
                  const Icon = featureIcons[index];

                  if (!Icon) {
                    return null;
                  }

                  return (
                    <div className="relative pl-9" key={feature.title}>
                      <dt className="inline font-semibold text-foreground">
                        <Icon
                          aria-hidden="true"
                          className="absolute top-1 left-1 size-5 text-primary"
                        />
                        {feature.title}
                      </dt>{" "}
                      <dd className="inline">{feature.description}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>

          <img
            alt="Управление членами команды"
            className={cn(imageClassNames, "dark:hidden")}
            height={1442}
            src="/images/app-light-members.png"
            width={2432}
          />

          <img
            alt="Управление членами команды в тёмной теме"
            className={cn(imageClassNames, "hidden dark:block")}
            height={1442}
            src="/images/app-dark-members.png"
            width={2432}
          />
        </div>
      </div>
    </div>
  );
}
