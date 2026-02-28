import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import store from '~/store';

const STARTER_PROMPTS = [
  {
    icon: '🔍',
    title: 'Разобрать сайт конкурента',
    description: 'Анализ позиционирования, цен и аудитории',
    prompt:
      'Сделай подробный анализ конкурента. Вот ссылка на его сайт: [вставь URL]\n\nПроанализируй:\n1. Позиционирование и целевая аудитория\n2. Ценовая политика\n3. Сильные и слабые стороны\n4. Что они делают лучше/хуже рынка\n5. Возможности для дифференциации',
  },
  {
    icon: '💡',
    title: 'Оценить бизнес-идею',
    description: 'Рынок, конкуренты и потенциал за 2 минуты',
    prompt:
      'Оцени мою бизнес-идею:\n\n[Опиши идею в 2-3 предложениях]\n\nХочу понять:\n1. Размер рынка и тренды\n2. Основные конкуренты\n3. Потенциальные клиенты\n4. Риски и барьеры входа\n5. Вердикт — стоит ли запускать',
  },
];

interface WelcomeScreenProps {
  onPromptSelect?: (prompt: string) => void;
}

export default function WelcomeScreen({ onPromptSelect }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const setInputValue = useSetRecoilState(store.textByIndex(0));

  const handleSelect = useCallback(
    (prompt: string) => {
      if (onPromptSelect) {
        onPromptSelect(prompt);
        return;
      }
      setInputValue(prompt);
    },
    [onPromptSelect, setInputValue],
  );

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 select-none">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
        Чем могу помочь?
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 text-center">
        Выберите готовый сценарий или начните диалог
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-6">
        {STARTER_PROMPTS.map((item) => (
          <button
            key={item.title}
            onClick={() => handleSelect(item.prompt)}
            className="flex flex-col items-start text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all group"
          >
            <span className="text-2xl mb-2">{item.icon}</span>
            <span className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {item.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {item.description}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/pricing')}
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors underline underline-offset-2"
      >
        Посмотреть тарифы →
      </button>
    </div>
  );
}
