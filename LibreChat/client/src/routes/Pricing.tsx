import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';

function getTier(credits: number | null): { label: string; color: string } {
  if (credits === null || credits === 0) return { label: 'Free', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
  if (credits >= 900_000) return { label: 'Business', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
  if (credits >= 400_000) return { label: 'Pro', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
  return { label: 'Starter', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
}

const PRO_FEATURES = [
  { ok: true, text: 'GPT-4o Mini' },
  { ok: true, text: 'Claude Sonnet 4' },
  { ok: true, text: 'DeepSeek V3' },
  { ok: true, text: 'Web-поиск (Tavily)' },
  { ok: true, text: 'Code Interpreter' },
  { ok: false, text: 'Приоритетная поддержка' },
];

const TIERS = [
  {
    id: 'free',
    label: 'Free',
    price: '0 ₽',
    tokens: null as number | null,
    priceNote: 'стартовый баланс при регистрации',
    highlight: false,
    badge: null as string | null,
    features: [
      { ok: true,  text: 'GPT-4o Mini' },
      { ok: true,  text: '~25 сообщений при регистрации' },
      { ok: false, text: 'Claude Sonnet' },
      { ok: false, text: 'DeepSeek V3' },
      { ok: false, text: 'Web-поиск' },
      { ok: false, text: 'Code Interpreter' },
      { ok: false, text: 'Приоритетная поддержка' },
    ],
    cta: null as string | null,
  },
  {
    id: 'starter',
    label: 'Starter',
    price: '990 ₽',
    tokens: 400_000,
    priceNote: '400 000 токенов на баланс',
    highlight: false,
    badge: null,
    features: PRO_FEATURES,
    cta: 'starter',
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '1 990 ₽',
    tokens: 900_000,
    priceNote: '900 000 токенов на баланс',
    highlight: true,
    badge: 'РЕКОМЕНДУЕМ',
    features: PRO_FEATURES,
    cta: 'pro',
  },
  {
    id: 'business',
    label: 'Business',
    price: '3 990 ₽',
    tokens: 2_000_000,
    priceNote: '2 000 000 токенов на баланс',
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
  const { token } = useAuthContext();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/balance', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tokenCredits != null) setCredits(d.tokenCredits); })
      .catch(() => undefined);
  }, [token]);

  const tier = getTier(credits);

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
          <div className={`mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium ${tier.color}`}>
            ✓ Ваш текущий тариф: <strong>{tier.label}</strong>
          </div>
        </div>

        {/* Tier cards: Free / Starter / Pro / Business */}
        <div className="mb-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
              {tier.tokens != null && (
                <p className="mt-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {tier.tokens.toLocaleString('ru-RU')} токенов
                </p>
              )}
              <p className="mb-5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tier.priceNote}</p>

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
                  Стартовый баланс при регистрации
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
