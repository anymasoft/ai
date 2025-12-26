import { Zap, Video, BookOpen, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const imageClassNames =
  "border-border w-3xl max-w-none rounded-xl border sm:w-228 md:-ml-4 lg:-ml-0";

type FeatureType = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const features: FeatureType[] = [
  {
    title: "Быстрое преобразование",
    description: "Мгновенно преобразуй скриншоты в работающий код",
    icon: <Zap className="size-5 text-primary" />,
  },
  {
    title: "Поддержка видео",
    description: "Записывай видео-туториалы и генерируй код из них",
    icon: <Video className="size-5 text-primary" />,
  },
  {
    title: "Документирование",
    description: "Автоматически создавай документацию для своего кода",
    icon: <BookOpen className="size-5 text-primary" />,
  },
  {
    title: "Полная настройка",
    description: "Выбирай язык, фреймворк и стиль кода по своему усмотрению",
    icon: <Settings className="size-5 text-primary" />,
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
                {features.map((feature) => (
                  <div className="relative pl-9" key={feature.title}>
                    <dt className="inline font-semibold text-foreground">
                      <div
                        aria-hidden="true"
                        className="absolute top-1 left-0"
                      >
                        {feature.icon}
                      </div>
                      {feature.title}
                    </dt>{" "}
                    <dd className="inline">{feature.description}</dd>
                  </div>
                ))}
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
