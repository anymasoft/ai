import { useAuthContext } from '~/hooks';

/**
 * Экран блокировки для забаненных пользователей
 * Отображается вместо основного интерфейса приложения
 */
export default function BannedScreen() {
  const { logout } = useAuthContext();

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md px-6">
        {/* Иконка блокировки */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 4v2M3 7.5L3 7.5c0-.828.672-1.5 1.5-1.5h14c.828 0 1.5.672 1.5 1.5v9c0 .828-.672 1.5-1.5 1.5H4.5c-.828 0-1.5-.672-1.5-1.5V7.5z"
              />
            </svg>
          </div>
        </div>

        {/* Заголовок */}
        <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
          Доступ запрещен
        </h1>

        {/* Описание */}
        <p className="mb-6 text-lg text-gray-600 dark:text-gray-300">
          Ваш аккаунт заблокирован.
        </p>

        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          Если вы считаете это ошибкой, пожалуйста обратитесь в нашу службу поддержки.
        </p>

        {/* Кнопка выхода */}
        <button
          onClick={() => logout('/sign-in')}
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          Вернуться на вход
        </button>

        {/* Email поддержки (если нужен) */}
        <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
          Вопросы? Свяжитесь с поддержкой
        </p>
      </div>
    </div>
  );
}
