import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

const TIERS = [
  {
    id: 'free',
    label: 'Free',
    price: '0 ₽',
    priceNote: 'навсегда',
    highlight: false,
    badge: null,
    features: [
      { ok: true,  text: 'GPT-4o Mini' },
      { ok: true,  text: '~25 сообщений при регистрации' },
      { ok: false, text: 'Claude Sonnet' },
      { ok: false, text: 'DeepSeek V3' },
      { ok: false, text: 'Web-поиск' },
      { ok: false, text: 'Code Interpreter' },
      { ok: false, text: 'Приоритетная поддержка' },
    ],
    cta: null,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: 'от 990 ₽',
    priceNote: 'за пакет токенов',
    highlight: true,
    badge: 'РЕКОМЕНДУЕМ',
    features: [
      { ok: true, text: 'GPT-4o Mini' },
      { ok: true, text: 'Claude Sonnet 4' },
      { ok: true, text: 'DeepSeek V3' },
      { ok: true, text: 'Web-поиск (Tavily)' },
      { ok: true, text: 'Code Interpreter' },
      { ok: false, text: 'Приоритетная поддержка' },
    ],
    cta: 'pro',
  },
  {
    id: 'business',
    label: 'Business',
    price: 'от 3 990 ₽',
    priceNote: 'максимальный пакет',
    highlight: false,
    badge: null,
    features: [
      { ok: true, text: 'GPT-4o Mini' },
      { ok: true, text: 'Claude Sonnet 4' },
      { ok: true, text: 'DeepSeek V3' },
      { ok: true, text: 'Web-поиск (Tavily)' },
      { ok: true, text: 'Code Interpreter' },
      { ok: true, text: 'Приоритетная поддержка (email)' },
    ],
    cta: 'max',
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, token } = useAuthContext();
  const isPro = user?.role === SystemRoles.ADMIN;

  const handleBuy = async (packageId: string) => {
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
    /* overflow-y-auto — ключевое исправление скролла внутри контейнера LibreChat */
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* Header */}
        <div className="mb-10 text-center">
          <button
            onClick={() => navigate('/c/new')}
            className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Вернуться в чат
          </button>
          <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
            Выберите тариф
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Доступ к лучшим AI-моделям в одном месте
          </p>
          {isPro && (
            <div className="mt-4 inline-block rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              ✓ У вас активен Pro-доступ
            </div>
          )}
        </div>

        {/* Tier cards: Free / Pro / Business */}
        <div className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-6 ${
                tier.highlight
                  ? 'border-2 border-blue-500 bg-white shadow-lg dark:bg-gray-800'
                  : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                  {tier.badge}
                </div>
              )}

              <h2 className="mb-0.5 text-xl font-semibold text-gray-900 dark:text-white">
                {tier.label}
              </h2>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{tier.price}</p>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">{tier.priceNote}</p>

              <ul className="mb-6 space-y-2">
                {tier.features.map((f) => (
                  <li
                    key={f.text}
                    className={`flex items-start gap-2 text-sm ${
                      f.ok
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{f.ok ? '✓' : '✗'}</span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              {tier.cta ? (
                <button
                  onClick={() => handleBuy(tier.cta!)}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
                  }`}
                >
                  Купить
                </button>
              ) : (
                <div className="w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  Текущий тариф
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="pb-10 text-center text-xs text-gray-400 dark:text-gray-600">
          Оплата через ЮKassa · Безопасно · Поддерживаются карты РФ и СБП
        </p>
      </div>
    </div>
  );
}
