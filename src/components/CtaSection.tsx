import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

const CtaSection = () => {
  return (
    <section className="py-32">
      <div className="flex max-w-7xl mx-auto h-[420px] rounded-3xl items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="container">
          <div className="text-white flex flex-col gap-8 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-medium">
              <MessageSquare className="h-full w-7" /> Автоматизация
            </div>
            <h2 className="">Начните экономить время уже сегодня</h2>
            <p className="text-blue-100">Без риска, без необходимости нанимать менеджеров</p>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button size="lg" variant="secondary">
                Попробовать бесплатно
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/20 hover:bg-white/30 hover:text-white border-0 backdrop-blur-sm text-white"
              >
                Узнать больше
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { CtaSection };