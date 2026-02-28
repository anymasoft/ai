import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

interface UserRow {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  tokenCredits: number;
  emailVerified: boolean;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  const isAdmin = user?.role === SystemRoles.ADMIN;

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/mvp/users?page=${page}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      const result: UsersResponse = await res.json();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page]);

  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/c/new');
    } else if (user && isAdmin) {
      load();
    }
  }, [user, isAdmin, load, navigate]);

  const changeRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/mvp/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка смены роли');
    }
  };

  const addCredits = async (userId: string) => {
    const credits = parseInt(creditInputs[userId] || '');
    if (!credits || credits <= 0) {
      alert('Введите корректное количество кредитов');
      return;
    }
    try {
      const res = await fetch(`/api/admin/mvp/users/${userId}/balance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCreditInputs((prev) => ({ ...prev, [userId]: '' }));
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка начисления');
    }
  };

  if (!user) return null;

  const formatCredits = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(0)}K`
        : n.toString();

  // 1 tokenCredit = $0.000001; показываем приблизительный расход в центах
  const creditsToUsd = (n: number) => `$${(n * 0.000001).toFixed(3)}`;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate('/c/new')}
              className="mb-1 block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Вернуться в чат
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Панель администратора
            </h1>
            {data && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Зарегистрировано пользователей: <strong>{data.total}</strong>
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Stats */}
        {data && !loading && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="Всего пользователей"
                value={data.total}
              />
              <StatCard
                label="Pro (ADMIN)"
                value={data.users.filter((u) => u.role === 'ADMIN').length}
                accent="blue"
              />
              <StatCard
                label="Free (USER)"
                value={data.users.filter((u) => u.role === 'USER').length}
              />
              <StatCard
                label="Суммарный баланс"
                value={formatCredits(data.users.reduce((s, u) => s + u.tokenCredits, 0))}
                suffix="кр."
              />
            </div>

            {/* Users table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-750">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Пользователь
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Тариф
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Баланс (кредиты)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Расход (~USD)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Дата рег.
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Начислить
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.users.map((u) => (
                      <tr
                        key={u._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {u.email}
                          </div>
                          {u.name && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">{u.name}</div>
                          )}
                          {!u.emailVerified && (
                            <span className="text-xs text-amber-500">не верифицирован</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u._id, e.target.value)}
                            disabled={u._id === user?.id}
                            className={`cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold ${
                              u.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <option value="USER">Free</option>
                            <option value="ADMIN">Pro / Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-mono font-medium ${
                              u.tokenCredits < 1000
                                ? 'text-red-500'
                                : u.tokenCredits < 10_000
                                  ? 'text-amber-500'
                                  : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {formatCredits(u.tokenCredits)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                          {u.tokenCredits > 0
                            ? creditsToUsd(15_000 - u.tokenCredits)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              placeholder="кредиты"
                              value={creditInputs[u._id] || ''}
                              onChange={(e) =>
                                setCreditInputs((prev) => ({ ...prev, [u._id]: e.target.value }))
                              }
                              className="w-24 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                            <button
                              onClick={() => addCredits(u._id)}
                              className="whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 transition-colors"
                            >
                              + Начислить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded px-3 py-1 text-sm ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  suffix,
}: {
  label: string;
  value: number | string;
  accent?: 'blue';
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent === 'blue'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span>}
      </p>
    </div>
  );
}
