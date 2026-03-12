import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '~/hooks';
import { Button, Input, Label } from '@librechat/client';

type AnalyticsTab = 'overview' | 'models' | 'users' | 'conversations' | 'costs';

interface OverviewData {
  totalUsers: number;
  activeUsers24h: number;
  messages24h: number;
  totalMessages: number;
  tokens24h: number;
  totalTokens: number;
  totalConversations: number;
}

interface ModelUsageRow {
  model: string;
  requests: number;
  uniqueUsers: number;
  totalTokens: number;
  endpoint: string;
}

interface UserUsageRow {
  userId: string;
  email: string;
  plan: string;
  requests: number;
  totalTokens: number;
  lastActive: string;
  favoriteModel: string;
}

interface ConversationRow {
  conversationId: string;
  user: string; // now contains email, not userId
  messageCount: number;
  totalTokens: number;
  model: string;
  lastActive: string;
}

interface CostsData {
  tokensToday: number;
  tokens7d: number;
  tokens30d: number;
  costPerModel: { model: string; totalTokens: number; requests: number }[];
  costPerUser: { _id: string; totalTokens: number }[]; // _id contains email now
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export default function AdminAnalytics() {
  const { token } = useAuthContext();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Overview
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);

  // Models
  const [modelsData, setModelsData] = useState<ModelUsageRow[]>([]);

  // Users
  const [usersData, setUsersData] = useState<UserUsageRow[]>([]);
  const [usersSearchEmail, setUsersSearchEmail] = useState('');

  // Conversations
  const [conversationsData, setConversationsData] = useState<ConversationRow[]>([]);

  // Costs
  const [costsData, setCostsData] = useState<CostsData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preview диалогов при hover
  interface PreviewMessage {
    role: string;
    text: string;
    createdAt: string;
  }
  const [previewCache, setPreviewCache] = useState<Record<string, PreviewMessage[]>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});

  // Modal для просмотра полного диалога
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [modalMessages, setModalMessages] = useState<PreviewMessage[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Копирование conversationId в буфер обмена
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000); // Убрать галочку через 2 сек
    });
  }, []);

  // Открытие modal с preview диалога
  const openConversationModal = useCallback(
    async (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setModalOpen(true);

      // Если уже загружено из cache, используем это
      if (previewCache[conversationId]) {
        setModalMessages(previewCache[conversationId]);
        return;
      }

      setModalLoading(true);

      try {
        const res = await fetch(`/api/admin/analytics/conversation-preview/${conversationId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          throw new Error(`Ошибка: ${res.status}`);
        }

        const result = await res.json();
        setModalMessages(result.data || []);
        // Кэшируем результат
        setPreviewCache((prev) => ({
          ...prev,
          [conversationId]: result.data || [],
        }));
      } catch (err) {
        logger.error('[conversation-modal]', err);
        setModalMessages([]);
      } finally {
        setModalLoading(false);
      }
    },
    [previewCache, token]
  );

  // Загрузка preview диалога при hover (lazy load)
  const loadConversationPreview = useCallback(
    async (conversationId: string) => {
      // Если уже загружен или загружается, пропускаем
      if (previewCache[conversationId] || previewLoading[conversationId]) {
        return;
      }

      setPreviewLoading((prev) => ({ ...prev, [conversationId]: true }));

      try {
        const res = await fetch(`/api/admin/analytics/conversation-preview/${conversationId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          throw new Error(`Ошибка: ${res.status}`);
        }

        const result = await res.json();
        setPreviewCache((prev) => ({
          ...prev,
          [conversationId]: result.data || [],
        }));
      } catch (err) {
        logger.error('[conversation-preview]', err);
        // Кэшируем ошибку как пустой массив
        setPreviewCache((prev) => ({
          ...prev,
          [conversationId]: [],
        }));
      } finally {
        setPreviewLoading((prev) => ({ ...prev, [conversationId]: false }));
      }
    },
    [previewCache, previewLoading, token]
  );

  // Форматирование preview текста (обрезаем длинные сообщения)
  const formatPreviewText = (text: string, maxLength = 100): string => {
    if (!text) return '(пусто)';
    return text.length > maxLength ? `${text.substring(0, maxLength)}…` : text;
  };

  const fetchAnalytics = useCallback(async (analyticsTab: AnalyticsTab) => {
    setLoading(true);
    setError('');

    try {
      const endpoint = `/api/admin/analytics/${analyticsTab}`;
      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      const result = await res.json();

      switch (analyticsTab) {
        case 'overview':
          setOverviewData(result.data);
          break;
        case 'models':
          setModelsData(result.data);
          break;
        case 'users':
          setUsersData(result.data);
          break;
        case 'conversations':
          setConversationsData(result.data);
          break;
        case 'costs':
          setCostsData(result.data);
          break;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAnalytics(tab);
  }, [tab, fetchAnalytics]);

  const formatNumber = (n: number) => n.toLocaleString('ru-RU');

  const handleRefresh = () => {
    fetchAnalytics(tab);
  };

  return (
    <div className="w-full">
      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Обзор
        </button>
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'models'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Модели
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Пользователи
        </button>
        <button
          onClick={() => setTab('conversations')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'conversations'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Диалоги
        </button>
        <button
          onClick={() => setTab('costs')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'costs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Расходы
        </button>
      </div>

      {/* Refresh Button */}
      <div className="mb-6 flex justify-end">
        <Button onClick={handleRefresh} disabled={loading}>
          {loading ? 'Загрузка...' : 'Обновить'}
        </Button>
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && overviewData && (
        <div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mb-8">
            <StatCard
              label="Всего пользователей"
              value={overviewData.totalUsers}
            />
            <StatCard
              label="Активных (24ч)"
              value={overviewData.activeUsers24h}
              accent="blue"
            />
            <StatCard
              label="Сообщений сегодня"
              value={overviewData.messages24h}
            />
            <StatCard
              label="Сообщений всего"
              value={formatNumber(overviewData.totalMessages)}
            />
            <StatCard
              label="Токенов сегодня"
              value={formatNumber(overviewData.tokens24h)}
            />
            <StatCard
              label="Токенов всего"
              value={formatNumber(overviewData.totalTokens)}
            />
            <StatCard
              label="Всего диалогов"
              value={overviewData.totalConversations}
            />
          </div>
        </div>
      )}

      {/* MODELS TAB */}
      {tab === 'models' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left text-gray-700 dark:text-gray-300">
                <th className="px-4 py-2">Модель</th>
                <th className="px-4 py-2 text-right">Запросов</th>
                <th className="px-4 py-2 text-right">Уникальных пользователей</th>
                <th className="px-4 py-2 text-right">Токенов</th>
                <th className="px-4 py-2">Endpoint</th>
              </tr>
            </thead>
            <tbody>
              {modelsData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    Нет данных
                  </td>
                </tr>
              ) : (
                modelsData.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.model || 'N/A'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(row.requests)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(row.uniqueUsers)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(row.totalTokens)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.endpoint || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <div>
          <div className="mb-6">
            <Label className="mb-2 block text-sm">Поиск по email</Label>
            <Input
              type="text"
              placeholder="Введите email для фильтрации"
              value={usersSearchEmail}
              onChange={(e) => setUsersSearchEmail(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr className="text-left text-gray-700 dark:text-gray-300">
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Тариф</th>
                  <th className="px-4 py-2 text-right">Запросов</th>
                  <th className="px-4 py-2 text-right">Токенов</th>
                  <th className="px-4 py-2">Последняя активность</th>
                  <th className="px-4 py-2">Любимая модель</th>
                </tr>
              </thead>
              <tbody>
                {usersData
                  .filter((row) =>
                    String(row.email ?? '').toLowerCase().includes(String(usersSearchEmail ?? '').toLowerCase())
                  )
                  .slice(0, 100)
                  .length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  usersData
                    .filter((row) =>
                      String(row.email ?? '').toLowerCase().includes(String(usersSearchEmail ?? '').toLowerCase())
                    )
                    .slice(0, 100)
                    .map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                          {row.email}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                              row.plan === 'pro'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : row.plan === 'business'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {row.plan === 'free' ? 'Free' : row.plan === 'pro' ? 'Pro' : 'Business'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(row.requests)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(row.totalTokens)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {new Date(row.lastActive).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {row.favoriteModel || 'N/A'}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONVERSATIONS TAB */}
      {tab === 'conversations' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr className="text-left text-gray-700 dark:text-gray-300">
                <th className="px-4 py-2">ID диалога</th>
                <th className="px-4 py-2">Пользователь</th>
                <th className="px-4 py-2 text-right">Сообщений</th>
                <th className="px-4 py-2 text-right">Токенов</th>
                <th className="px-4 py-2">Модель</th>
                <th className="px-4 py-2">Последняя активность</th>
              </tr>
            </thead>
            <tbody>
              {conversationsData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                    Нет данных
                  </td>
                </tr>
              ) : (
                conversationsData.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 relative">
                      <div className="flex items-center gap-1 group">
                        {/* Сокращённый ID с tooltip полного ID */}
                        <span
                          title={String(row.conversationId ?? '')}
                          className="cursor-help"
                          onMouseEnter={() =>
                            loadConversationPreview(String(row.conversationId ?? ''))
                          }
                        >
                          {String(row.conversationId ?? '').substring(0, 8)}…
                        </span>

                        {/* Кнопка копирования ID */}
                        <button
                          onClick={() => copyToClipboard(String(row.conversationId ?? ''))}
                          className="inline-flex items-center justify-center w-4 h-4 rounded text-gray-500 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          title="Копировать ID"
                        >
                          {copiedId === String(row.conversationId ?? '') ? (
                            <span className="text-green-500 text-xs">✓</span>
                          ) : (
                            <span className="text-xs">📋</span>
                          )}
                        </button>

                        {/* Кнопка открытия modal с preview диалога */}
                        <button
                          onClick={() =>
                            openConversationModal(String(row.conversationId ?? ''))
                          }
                          className="inline-flex items-center justify-center w-4 h-4 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          title="Просмотреть диалог"
                        >
                          👁
                        </button>

                        {/* Hover Preview последних сообщений */}
                        {previewCache[String(row.conversationId ?? '')] &&
                          previewCache[String(row.conversationId ?? '')].length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 p-3 rounded shadow-lg whitespace-normal w-80 text-xs z-50">
                              <div className="space-y-2">
                                {previewCache[String(row.conversationId ?? '')].map((msg, i) => (
                                  <div key={i} className="border-b border-gray-700 pb-2 last:border-b-0">
                                    <div className="font-semibold text-gray-300">
                                      {msg.role === 'assistant' ? '🤖 Assistant' : '👤 User'}
                                    </div>
                                    <div className="text-gray-100">
                                      {formatPreviewText(msg.text, 90)}
                                    </div>
                                    <div className="text-gray-500 text-xs mt-1">
                                      {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{String(row.user ?? 'N/A')}</td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(row.messageCount)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(row.totalTokens)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.model || 'N/A'}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {new Date(row.lastActive).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* COSTS TAB */}
      {tab === 'costs' && costsData && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Токенов сегодня"
              value={formatNumber(costsData.tokensToday)}
            />
            <StatCard
              label="Токенов за 7 дней"
              value={formatNumber(costsData.tokens7d)}
              accent="blue"
            />
            <StatCard
              label="Токенов за 30 дней"
              value={formatNumber(costsData.tokens30d)}
            />
          </div>

          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Расходы по моделям
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr className="text-left text-gray-700 dark:text-gray-300">
                    <th className="px-4 py-2">Модель</th>
                    <th className="px-4 py-2 text-right">Токенов</th>
                    <th className="px-4 py-2 text-right">Запросов</th>
                  </tr>
                </thead>
                <tbody>
                  {costsData.costPerModel.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    costsData.costPerModel.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                          {row.model || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(row.totalTokens)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(row.requests)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              ТОП 50 пользователей по расходам (по email)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr className="text-left text-gray-700 dark:text-gray-300">
                    <th className="px-4 py-2">Email пользователя</th>
                    <th className="px-4 py-2 text-right">Токенов</th>
                  </tr>
                </thead>
                <tbody>
                  {costsData.costPerUser.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                        Нет данных
                      </td>
                    </tr>
                  ) : (
                    costsData.costPerUser.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {String(row._id ?? 'N/A')}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {formatNumber(row.totalTokens)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL для просмотра полного диалога */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-96 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Диалог: {selectedConversationId?.substring(0, 8)}…
              </h2>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedConversationId(null);
                  setModalMessages([]);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Сообщения */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {modalLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Загрузка сообщений...
                </div>
              ) : modalMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Нет сообщений в этом диалоге
                </div>
              ) : (
                modalMessages.map((msg, idx) => (
                  <div key={idx} className="py-2">
                    <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                      {msg.role === 'assistant' ? '🤖 Assistant' : '👤 User'}
                    </div>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap break-words">
                      {msg.text}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(msg.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedConversationId(null);
                  setModalMessages([]);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
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
