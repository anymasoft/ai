import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';

const AVG_MSG_CREDITS = 4_392;

function creditsToMessages(credits: number): number {
  return Math.max(0, Math.floor(credits / AVG_MSG_CREDITS));
}

/** Отображение плана — соответствует Subscription.plan на сервере */
const PLAN_DISPLAY: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pro:      { label: 'Pro',      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  business: { label: 'Business', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

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
    ],
    cta: null as string | null,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '3 990 ₽/мес',
    tokens: 22_000_000,
    priceNote: '≈ 5 000 сообщений в месяц',
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
    price: '9 990 ₽/мес',
    tokens: 55_000_000,
    priceNote: '≈ 12 500 сообщений в месяц',
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

interface BalanceInfo {
  tokenCredits: number;
  plan: string;
  planExpiresAt: string | null;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { token } = useAuthContext();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [paymentCheck, setPaymentCheck] = useState<
    { status: 'checking' | 'ok' | 'error' | 'pending'; message?: string } | null
  >(null);

  const fetchBalance = () => {
    if (!token) return;
    fetch('/api/balance', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.tokenCredits != null) {
          setBalance({
            tokenCredits: d.tokenCredits,
            plan: d.plan || 'free',
            planExpiresAt: d.planExpiresAt || null,
          });
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchBalance();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback-поллинг для localhost: ONE-TIME check после редиректа с ?payment=success
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('payment')) return;

    setPaymentCheck({ status: 'checking' });

    fetch('/api/payment/check', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPaymentCheck({
            status: 'ok',
            message: data.alreadyDone
              ? 'Платёж уже был зачислен ранее'
              : `Подписка активирована. Зачислено ${data.tokenCredits?.toLocaleString('ru-RU')} токенов`,
          });
          fetchBalance();
        } else if (data.status === 'pending' || data.status === 'waiting_for_capture') {
          setPaymentCheck({ status: 'pending', message: 'Платёж ещё обрабатывается — обновите страницу через минуту' });
        } else {
          setPaymentCheck({ status: 'error', message: data.message || data.error || 'Не удалось подтвердить платёж' });
        }
      })
      .catch(() => setPaymentCheck({ status: 'error', message: 'Ошибка соединения с сервером' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const plan = balance?.plan || 'free';
  const planDisplay = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const credits = balance?.tokenCredits ?? 0;
  const msgEstimate = creditsToMessages(credits);

  // Предупреждение о низком балансе: < 10% от лимита плана
  const planConfig: Record<string, number> = { pro: 22_000_000, business: 55_000_000 };
  const planLimit = planConfig[plan];
  const isLowBalance = plan !== 'free' && planLimit != null && credits < planLimit * 0.1;
  const isZeroBalance = credits <= 0;

  const planExpiresAt = balance?.planExpiresAt
    ? new Date(balance.planExpiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* Статус платежа после возврата из ЮKassa */}
        {paymentCheck && (
          <div className={`mb-6 rounded-xl px-5 py-4 text-sm ${
            paymentCheck.status === 'checking' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
            paymentCheck.status === 'ok'       ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' :
            paymentCheck.status === 'pending'  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {paymentCheck.status === 'checking' && '⏳ Проверяем статус платежа...'}
            {paymentCheck.status === 'ok'       && `✓ ${paymentCheck.message}`}
            {paymentCheck.status === 'pending'  && `⏳ ${paymentCheck.message}`}
            {paymentCheck.status === 'error'    && `✗ ${paymentCheck.message}`}
          </div>
        )}

        {/* Предупреждение о низком балансе */}
        {isZeroBalance && plan !== 'free' && (
          <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            ⚠️ Баланс токенов исчерпан. Отправка сообщений заблокирована. Пополните подписку.
          </div>
        )}
        {!isZeroBalance && isLowBalance && (
          <div className="mb-6 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            ⚠️ Баланс токенов меньше 10% от месячного лимита. Осталось ~{msgEstimate.toLocaleString('ru-RU')} сообщений. Рекомендуем продлить подписку.
          </div>
        )}

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
          <div className={`mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium ${planDisplay.color}`}>
            ✓ Ваш текущий тариф: <strong>{planDisplay.label}</strong>
            {planExpiresAt && <span className="ml-2 opacity-75">· активен до {planExpiresAt}</span>}
          </div>
          {balance && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Баланс: {credits.toLocaleString('ru-RU')} токенов
              {msgEstimate > 0 && <span> · ≈ {msgEstimate.toLocaleString('ru-RU')} сообщений</span>}
            </div>
          )}
        </div>

        {/* Карточки тарифов */}
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
              {tier.tokens != null && (
                <p className="mt-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {tier.tokens.toLocaleString('ru-RU')} токенов/мес
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
                  {plan === tier.id ? 'Продлить подписку' : 'Купить'}
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
