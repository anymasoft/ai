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

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
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
      const result = await apiFetch<UsersResponse>(`/api/admin/mvp/users?page=${page}`);
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
    } else {
      load();
    }
  }, [user, isAdmin, load, navigate]);

  const changeRole = async (userId: string, role: string) => {
    try {
      await apiFetch(`/api/admin/mvp/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const addCredits = async (userId: string) => {
    const raw = creditInputs[userId];
    const credits = parseInt(raw);
    if (!credits || credits <= 0) {
      alert('Введите корректное количество кредитов');
      return;
    }
    try {
      await apiFetch(`/api/admin/mvp/users/${userId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits }),
      });
      setCreditInputs((prev) => ({ ...prev, [userId]: '' }));
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/c/new')}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2 block"
            >
              ← Вернуться в чат
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Панель администратора
            </h1>
            {data && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Всего пользователей: {data.total}
              </p>
            )}
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Обновить
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Загрузка...</div>
        )}

        {data && !loading && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">Роль</th>
                    <th className="text-right px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">Кредиты</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">Дата</th>
                    <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr
                      key={u._id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{u.email}</div>
                        {u.name && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{u.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u._id, e.target.value)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${
                            u.role === 'ADMIN'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                          disabled={u._id === user?.id}
                        >
                          <option value="USER">USER (Free)</option>
                          <option value="ADMIN">ADMIN (Pro)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-gray-900 dark:text-white">
                          {u.tokenCredits.toLocaleString('ru')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString('ru')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Credits"
                            value={creditInputs[u._id] || ''}
                            onChange={(e) =>
                              setCreditInputs((prev) => ({ ...prev, [u._id]: e.target.value }))
                            }
                            className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <button
                            onClick={() => addCredits(u._id)}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors whitespace-nowrap"
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

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
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
