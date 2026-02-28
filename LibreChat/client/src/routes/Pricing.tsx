import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { Check, X, AlertTriangle, Loader2, CheckCircle, Clock, Plus } from 'lucide-react';
import { useAuthContext } from '~/hooks';
import type { ContextType } from '~/common';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';

const AVG_MSG_CREDITS = 4_392;

function creditsToMessages(credits: number): number {
  return Math.max(0, Math.floor(credits / AVG_MSG_CREDITS));
}

const PLAN_STYLE: Record<string, { color: string; highlight: boolean }> = {
  free:     { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', highlight: false },
  pro:      { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', highlight: true },
  business: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', highlight: false },
};

const PLAN_FEATURES: Record<string, Array<{ ok: boolean; text: string }>> = {
  free: [
    { ok: true,  text: 'GPT-4o Mini' },
    { ok: true,  text: '~25 сообщений при регистрации' },
    { ok: false, text: 'Claude Sonnet' },
    { ok: false, text: 'DeepSeek V3' },
    { ok: false, text: 'Web-поиск' },
    { ok: false, text: 'Code Interpreter' },
  ],
  pro: [
    { ok: true, text: 'GPT-4o Mini' },
    { ok: true, text: 'Claude Sonnet 4' },
    { ok: true, text: 'DeepSeek V3' },
    { ok: true, text: 'Web-поиск (Tavily)' },
    { ok: true, text: 'Code Interpreter' },
    { ok: false, text: 'Приоритетная поддержка' },
  ],
  business: [
    { ok: true, text: 'GPT-4o Mini' },
    { ok: true, text: 'Claude Sonnet 4' },
    { ok: true, text: 'DeepSeek V3' },
    { ok: true, text: 'Web-поиск (Tavily)' },
    { ok: true, text: 'Code Interpreter' },
    { ok: true, text: 'Приоритетная поддержка (email)' },
  ],
};

interface PlanDoc {
  planId: string;
  label: string;
  priceRub: number;
  tokenCreditsOnPurchase: number;
  durationDays: number | null;
  allowedModels: string[];
  isActive: boolean;
}

interface TokenPackageDoc {
  packageId: string;
  label: string;
  priceRub: number;
  tokenCredits: number;
  isActive: boolean;
}

interface BalanceInfo {
  tokenCredits: number;
  plan: string;
  planExpiresAt: string | null;
}

function fmtPrice(priceRub: number): string {
  return priceRub === 0 ? '0 ₽' : `${priceRub.toLocaleString('ru-RU')} ₽/мес`;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { token } = useAuthContext();
  const queryClient = useQueryClient();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPackageDoc[]>([]);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [paymentCheck, setPaymentCheck] = useState<
    { status: 'checking' | 'ok' | 'error' | 'pending'; message?: string } | null
  >(null);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/payment/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans ?? []);
        setTokenPackages(data.tokenPackages ?? []);
      }
    } catch { /* ignore */ }
  };

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
          queryClient.invalidateQueries([QueryKeys.balance]);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchPlans();
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
          const credits = data.tokenCredits?.toLocaleString('ru-RU');
          const isPlan = !!data.plan;
          const successMsg = data.alreadyDone
            ? `Зачислено ${credits} токенов (зачисление прошло ранее)`
            : isPlan
              ? `Подписка активирована. Зачислено ${credits} токенов`
              : `Токены зачислены: +${credits}`;
          setPaymentCheck({ status: 'ok', message: successMsg });
          fetchBalance();
        } else if (data.status === 'not_found') {
          setPaymentCheck(null);
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

  const currentPlan = balance?.plan || 'free';
  const currentPlanStyle = PLAN_STYLE[currentPlan] ?? PLAN_STYLE.free;
  const credits = balance?.tokenCredits ?? 0;
  const msgEstimate = creditsToMessages(credits);

  const currentPlanDoc = plans.find((p) => p.planId === currentPlan);
  const planLimit = currentPlanDoc?.tokenCreditsOnPurchase || 0;
  const isLowBalance = currentPlan !== 'free' && planLimit > 0 && credits < planLimit * 0.1;
  const isZeroBalance = credits <= 0 && currentPlan !== 'free';

  const planExpiresAt = balance?.planExpiresAt
    ? new Date(balance.planExpiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Кнопка открытия боковой панели — десктоп, только когда панель закрыта */}
      {!navVisible && (
        <div className="sticky top-0 z-10 hidden items-center bg-gray-50 px-3 py-2 dark:bg-gray-900 md:flex">
          <OpenSidebar setNavVisible={setNavVisible} />
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* Статус платежа после возврата из ЮKassa */}
        {paymentCheck && (
          <div className={`mb-6 flex items-start gap-3 rounded-xl px-5 py-4 text-sm ${
            paymentCheck.status === 'checking' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
            paymentCheck.status === 'ok'       ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' :
            paymentCheck.status === 'pending'  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                                 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {paymentCheck.status === 'checking' && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />}
            {paymentCheck.status === 'ok'       && <CheckCircle className="mt-0.5 size-4 shrink-0" />}
            {paymentCheck.status === 'pending'  && <Clock className="mt-0.5 size-4 shrink-0" />}
            {paymentCheck.status === 'error'    && <X className="mt-0.5 size-4 shrink-0" />}
            <span>
              {paymentCheck.status === 'checking' && 'Проверяем статус платежа...'}
              {paymentCheck.status !== 'checking' && paymentCheck.message}
            </span>
          </div>
        )}

        {/* Предупреждение о низком/нулевом балансе */}
        {isZeroBalance && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Баланс токенов исчерпан. Отправка сообщений заблокирована. Пополните подписку или докупите токены.</span>
          </div>
        )}
        {!isZeroBalance && isLowBalance && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Осталось менее 10% баланса (~{msgEstimate.toLocaleString('ru-RU')} сообщений).
              Рекомендуем продлить подписку или докупить токены.
            </span>
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
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${currentPlanStyle.color}`}>
            <Check className="size-3.5" />
            Ваш текущий тариф: <strong>{currentPlanDoc?.label ?? currentPlan}</strong>
            {planExpiresAt && <span className="opacity-75">· активен до {planExpiresAt}</span>}
          </div>
          {balance && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Баланс: {credits.toLocaleString('ru-RU')} токенов
              {msgEstimate > 0 && <span> · ≈ {msgEstimate.toLocaleString('ru-RU')} сообщений</span>}
            </div>
          )}
        </div>

        {/* Карточки тарифов */}
        {plans.length > 0 && (
          <div className={`mb-10 grid grid-cols-1 gap-6 md:grid-cols-${Math.min(plans.length, 3)}`}>
            {plans.map((plan) => {
              const style = PLAN_STYLE[plan.planId] ?? PLAN_STYLE.free;
              const features = PLAN_FEATURES[plan.planId] ?? [];
              const msgEst = plan.tokenCreditsOnPurchase > 0
                ? Math.floor(plan.tokenCreditsOnPurchase / AVG_MSG_CREDITS)
                : null;

              return (
                <div
                  key={plan.planId}
                  className={`relative rounded-2xl p-6 ${
                    style.highlight
                      ? 'border-2 border-blue-500 bg-white shadow-lg dark:bg-gray-800'
                      : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  }`}
                >
                  {style.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                      РЕКОМЕНДУЕМ
                    </div>
                  )}

                  <h2 className="mb-0.5 text-xl font-semibold text-gray-900 dark:text-white">
                    {plan.label}
                  </h2>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {fmtPrice(plan.priceRub)}
                  </p>
                  {plan.tokenCreditsOnPurchase > 0 && (
                    <p className="mt-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {plan.tokenCreditsOnPurchase.toLocaleString('ru-RU')} токенов/мес
                    </p>
                  )}
                  {msgEst && (
                    <p className="mb-5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      ≈ {msgEst.toLocaleString('ru-RU')} сообщений в месяц
                    </p>
                  )}
                  {plan.planId === 'free' && (
                    <p className="mb-5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      стартовый баланс при регистрации
                    </p>
                  )}

                  <ul className="mb-6 space-y-2">
                    {features.map((f) => (
                      <li
                        key={f.text}
                        className={`flex items-start gap-2 text-sm ${
                          f.ok ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {f.ok
                          ? <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                          : <X className="mt-0.5 size-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                        }
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.priceRub > 0 ? (
                    <button
                      onClick={() => handleBuy(plan.planId)}
                      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                        style.highlight
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
                      }`}
                    >
                      {currentPlan === plan.planId ? 'Продлить подписку' : 'Купить'}
                    </button>
                  ) : (
                    <div className="w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
                      Стартовый баланс при регистрации
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Пакеты токенов */}
        {tokenPackages.length > 0 && (
          <div className="mb-14">
            <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
              Пополнение токенов
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tokenPackages.map((pkg) => (
                <div
                  key={pkg.packageId}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{pkg.label}</div>
                    <div className="mt-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {pkg.tokenCredits.toLocaleString('ru-RU')} токенов
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Без изменения тарифа и срока подписки
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuy(pkg.packageId)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="size-3.5" />
                    {pkg.priceRub.toLocaleString('ru-RU')} ₽
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="pb-10 text-center text-xs text-gray-400 dark:text-gray-600">
          Оплата через ЮKassa · Безопасно · Поддерживаются карты РФ и СБП
        </p>
      </div>
    </div>
  );
}
