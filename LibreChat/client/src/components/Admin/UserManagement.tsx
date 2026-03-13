import { useState, useEffect, useCallback } from 'react';
import { Shield, Ban, CheckCircle2 } from 'lucide-react';
import { Button, Input, Label, cn } from '@librechat/client';
import { useAuthContext } from '~/hooks';

const logger = {
  error: (msg: string, err?: unknown) => console.error(msg, err),
  info: (msg: string, ...args: unknown[]) => console.log(msg, ...args),
};

interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  provider: string;
  banned?: boolean;
  bannedAt?: string;
  banReason?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Компонент управления пользователями с функциями ban/unban
 *
 * Функции:
 * - Просмотр списка пользователей
 * - Забанить пользователя (с причиной)
 * - Разбанить пользователя
 * - Статус отображается зеленым (Active) или красным (Banned)
 * - Быстрое действие без перезагрузки страницы
 */
export default function UserManagement() {
  const { token } = useAuthContext();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchEmail, setSearchEmail] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [banReasonModal, setBanReasonModal] = useState<{ userId: string; visible: boolean }>({
    userId: '',
    visible: false,
  });
  const [banReason, setBanReason] = useState('');

  // Загрузить список пользователей
  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...(searchEmail && { search: searchEmail }),
        });

        const response = await fetch(`/api/admin/users?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch users');

        const data: UsersResponse = await response.json();
        setUsers(data.users);
        setTotalPages(data.pages);
        setCurrentPage(data.page);
      } catch (err) {
        logger.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [token, searchEmail],
  );

  useEffect(() => {
    fetchUsers(1);
  }, []);

  // Забанить пользователя
  const handleBan = useCallback(
    async (userId: string) => {
      setProcessingId(userId);
      try {
        const response = await fetch(`/api/admin/users/${userId}/ban`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ banReason: banReason || 'No reason provided' }),
        });

        if (!response.ok) throw new Error('Failed to ban user');

        // Обновить locально
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId
              ? {
                  ...u,
                  banned: true,
                  bannedAt: new Date().toISOString(),
                  banReason: banReason || 'No reason provided',
                }
              : u,
          ),
        );

        setBanReasonModal({ userId: '', visible: false });
        setBanReason('');
        logger.info(`User ${userId} banned successfully`);
      } catch (err) {
        logger.error('Error banning user:', err);
        setError('Failed to ban user');
      } finally {
        setProcessingId(null);
      }
    },
    [token, banReason],
  );

  // Разбанить пользователя
  const handleUnban = useCallback(
    async (userId: string) => {
      setProcessingId(userId);
      try {
        const response = await fetch(`/api/admin/users/${userId}/unban`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to unban user');

        // Обновить locально
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId
              ? {
                  ...u,
                  banned: false,
                  bannedAt: undefined,
                  banReason: '',
                }
              : u,
          ),
        );

        logger.info(`User ${userId} unbanned successfully`);
      } catch (err) {
        logger.error('Error unbanning user:', err);
        setError('Failed to unban user');
      } finally {
        setProcessingId(null);
      }
    },
    [token],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Заголовок */}
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-text-primary">User Management</h2>
      </div>

      {/* Поиск */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          placeholder="Search by email..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          Search
        </Button>
      </form>

      {/* Ошибка */}
      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          {/* Заголовки */}
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Email
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Name
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Provider
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Role
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">
                Actions
              </th>
            </tr>
          </thead>

          {/* Тело таблицы */}
          <tbody>
            {loading && !users.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user._id}
                  className={cn(
                    'border-b border-border transition-colors',
                    user.banned ? 'bg-red-500/5' : 'hover:bg-surface-hover',
                  )}
                >
                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary">
                      {user.email}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3 text-text-secondary">
                    {user.name || '—'}
                  </td>

                  {/* Provider */}
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="rounded-full bg-surface-secondary px-2 py-1 text-xs">
                      {user.provider}
                    </span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 text-text-secondary">
                    {user.role}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {user.banned ? (
                        <>
                          <Ban className="h-4 w-4 text-red-500" />
                          <span className="text-red-500 font-medium">Banned</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-green-500 font-medium">Active</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {user.banned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnban(user._id)}
                          disabled={processingId === user._id}
                          className="text-xs"
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setBanReasonModal({ userId: user._id, visible: true })
                          }
                          disabled={processingId === user._id}
                          className="text-xs"
                        >
                          Ban
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => fetchUsers(page)}
              disabled={loading}
            >
              {page}
            </Button>
          ))}
        </div>
      )}

      {/* Modal для ввода причины бана */}
      {banReasonModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary">Ban User</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Provide a reason for banning this user (optional)
            </p>

            <div className="mt-4">
              <Label htmlFor="ban-reason">Reason</Label>
              <textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="E.g., Violating terms of service..."
                className="mt-1 w-full rounded-md border border-border bg-surface-secondary p-2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBanReasonModal({ userId: '', visible: false });
                  setBanReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleBan(banReasonModal.userId)}
                disabled={processingId === banReasonModal.userId}
              >
                Ban User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
