/**
 * Billing — страница тарифов и биллинга для авторизованных пользователей
 * Адаптировано из YouTubeScripts/src/app/dashboard/settings/billing/page.tsx
 *
 * Маршрут: /billing (внутри Root)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import PricingPlans from '~/components/Billing/PricingPlans';

interface BalanceInfo {
  tokenCredits: number;
}

interface PaymentHistoryItem {
  _id: string;
  packageId: string;
  tokenCredits: number;
  amount: string;
  status: string;
  createdAt: string;
}

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function Billing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthContext();

  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Определяем, вернулся ли пользователь после оплаты
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setPaymentSuccess(true);
    }
  }, [searchParams]);

  // Загружаем текущий баланс
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/balance', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setBalance({ tokenCredits: data.tokenCredits ?? 0 });
        }
      } catch {
        // игнорируем ошибку — баланс просто не покажем
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchBalance();
  }, []);

  // Загружаем историю платежей пользователя
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/payment/history', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.payments ?? []);
        }
      } catch {
        // история недоступна — не критично
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, []);

  const isLoading = loadingBalance || loadingHistory;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/c/new')}
            className="mb-3 block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Вернуться в чат
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Тарифы и биллинг</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Управляйте балансом и выбирайте пакет токенов.
          </p>
        </div>

        {/* Уведомление после оплаты */}
        {paymentSuccess && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            ✓ Оплата прошла успешно! Баланс будет зачислен в течение нескольких секунд.
          </div>
        )}

        {/* Текущий баланс + история платежей */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">

          {/* Текущий баланс */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              Текущий баланс
            </h2>
            {isLoading ? (
              <p className="text-sm text-gray-400">Загрузка...</p>
            ) : (
              <>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {balance ? formatCredits(balance.tokenCredits) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  токен-кредитов · {balance ? `≈ $${(balance.tokenCredits * 0.000001).toFixed(3)}` : ''}
                </p>
                {balance && balance.tokenCredits < 1000 && (
                  <p className="mt-3 text-xs font-medium text-red-500">
                    ⚠ Баланс заканчивается — пополните, чтобы продолжить работу.
                  </p>
                )}
              </>
            )}
          </div>

          {/* История платежей */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              История платежей
            </h2>
            {loadingHistory ? (
              <p className="text-sm text-gray-400">Загрузка...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400">Платежей пока нет.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 5).map((p) => (
                  <li key={p._id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300 mr-2">
                        {p.packageId}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-gray-900 dark:text-white">{p.amount || '—'} ₽</span>
                      {p.status === 'succeeded' && (
                        <span className="ml-2 text-xs text-green-500">✓</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Пакеты */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            Доступные пакеты
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Выберите пакет токен-кредитов. После оплаты они сразу появятся на вашем счету.
          </p>
          <PricingPlans mode="billing" currentBalance={balance?.tokenCredits} />
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          Оплата через ЮKassa · Безопасно · Поддерживаются карты РФ и СБП
        </p>
      </div>
    </div>
  );
}
