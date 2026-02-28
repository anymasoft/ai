import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

const FREE_FEATURES = [
  '✓ GPT-4o Mini',
  '✓ ~25 сообщений бесплатно',
  '✗ Claude Sonnet',
  '✗ DeepSeek V3',
  '✗ Web-поиск',
  '✗ Code Interpreter',
];

const PRO_FEATURES = [
  '✓ GPT-4o Mini',
  '✓ Claude Sonnet 4',
  '✓ DeepSeek V3',
  '✓ Web-поиск (Tavily)',
  '✓ Code Interpreter',
  '✓ Приоритетный доступ',
];

const PACKAGES = [
  { id: 'starter', label: 'Старт', price: '990 ₽', credits: 400_000, desc: '~600 сообщений GPT-4o Mini или ~130 Claude' },
  { id: 'pro', label: 'Pro', price: '1 990 ₽', credits: 900_000, desc: '~1300 сообщений GPT-4o Mini или ~300 Claude', popular: true },
  { id: 'max', label: 'Max', price: '3 990 ₽', credits: 2_000_000, desc: '~3000 сообщений GPT-4o Mini или ~660 Claude' },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isPro = user?.role === SystemRoles.ADMIN;

  const handleBuy = async (packageId: string) => {
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        alert(data.error || 'Ошибка создания платежа');
      }
    } catch {
      alert('Ошибка соединения с сервером');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <button
            onClick={() => navigate('/c/new')}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 inline-block"
          >
            ← Вернуться в чат
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Выберите тариф
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Доступ к лучшим AI-моделям в одном месте
          </p>
          {isPro && (
            <div className="mt-4 inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-full text-sm font-medium">
              ✓ У вас активен Pro-доступ
            </div>
          )}
        </div>

        {/* Free vs Pro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Free */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Free</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-6">0 ₽</p>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className={`text-sm ${f.startsWith('✗') ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-500 p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              РЕКОМЕНДУЕМ
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Pro</h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              от 990 ₽
            </p>
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="text-sm text-gray-700 dark:text-gray-300">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Packages */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-6">
          Пополните баланс
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border ${
                pkg.popular
                  ? 'border-blue-500 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {pkg.popular && (
                <div className="text-xs font-semibold text-blue-500 uppercase mb-2">Популярный</div>
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pkg.label}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white my-2">{pkg.price}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{pkg.desc}</p>
              <button
                onClick={() => handleBuy(pkg.id)}
                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${
                  pkg.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                }`}
              >
                Купить
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
          Оплата через ЮKassa. Безопасно. Поддерживаются карты РФ.
        </p>
      </div>
    </div>
  );
}
