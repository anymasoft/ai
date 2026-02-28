import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { OGDialog, OGDialogTemplate } from '@librechat/client';
import { useAuthContext } from '~/hooks';
import type { ContextType } from '~/common';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';

type Tab = 'users' | 'payments' | 'settings';

interface PaymentRow {
  _id: string;
  email: string;
  name: string;
  packageId: string;
  tokenCredits: number;
  amount: string;
  status: string;
  createdAt: string;
}

interface PaymentsResponse {
  payments: PaymentRow[];
  total: number;
  totalSum: number;
}

interface UserRow {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  tokenCredits: number;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'business';
  planExpiresAt: string | null;
}

const PLAN_DISPLAY: Record<string, { label: string; className: string }> = {
  free:     { label: 'Free',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  pro:      { label: 'Pro',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  business: { label: 'Business', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pages: number;
}

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

interface AiModelDoc {
  _id?: string;
  modelId: string;
  provider: string;
  displayName: string;
  isActive: boolean;
}

interface PlanEdit {
  priceRub: string;
  tokenCreditsOnPurchase: string;
  allowedModels: string[];  // массив точных modelId из AiModel
  isActive: boolean;
}

interface PkgEdit {
  priceRub: string;
  tokenCredits: string;
  isActive: boolean;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, token } = useAuthContext();
  const [tab, setTab] = useState<Tab>('users');
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [paymentsData, setPaymentsData] = useState<PaymentsResponse | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [paymentEmailFilter, setPaymentEmailFilter] = useState('');
  const [paymentFromFilter, setPaymentFromFilter] = useState('');
  const [paymentToFilter, setPaymentToFilter] = useState('');
  const [reconcileId, setReconcileId] = useState('');
  const [reconcileResult, setReconcileResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [planChanging, setPlanChanging] = useState<Record<string, boolean>>({});

  // ── НАСТРОЙКИ ──
  const [settingsPlans, setSettingsPlans] = useState<PlanDoc[]>([]);
  const [settingsPkgs, setSettingsPkgs] = useState<TokenPackageDoc[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [planEdits, setPlanEdits] = useState<Record<string, PlanEdit>>({});
  const [pkgEdits, setPkgEdits] = useState<Record<string, PkgEdit>>({});
  const [planSaving, setPlanSaving] = useState<Record<string, boolean>>({});
  const [pkgSaving, setPkgSaving] = useState<Record<string, boolean>>({});
  const [planSaveMsg, setPlanSaveMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [pkgSaveMsg, setPkgSaveMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  // ── КАТАЛОГ МОДЕЛЕЙ ──
  const [aiModels, setAiModels] = useState<AiModelDoc[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelSaving, setModelSaving] = useState<Record<string, boolean>>({});
  const [modelSaveMsg, setModelSaveMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [modelEdits, setModelEdits] = useState<Record<string, { provider: string; displayName: string; isActive: boolean }>>({});
  const [newModelForm, setNewModelForm] = useState({ modelId: '', provider: '', endpointKey: '', displayName: '' });
  const [newModelSaving, setNewModelSaving] = useState(false);
  const [newModelMsg, setNewModelMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteModelDialog, setDeleteModelDialog] = useState<{ open: boolean; modelId: string | null }>({ open: false, modelId: null });
  const [deleteModelError, setDeleteModelError] = useState<string | null>(null);
  const [availableEndpoints, setAvailableEndpoints] = useState<string[]>([]);

  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const isAdmin = user?.role === SystemRoles.ADMIN;

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/mvp/users?page=${page}`, {
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
      const result: UsersResponse = await res.json();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, token]);

  const loadPayments = useCallback(async () => {
    if (!isAdmin) return;
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams();
      if (paymentEmailFilter) params.append('email', paymentEmailFilter);
      if (paymentFromFilter) params.append('from', paymentFromFilter);
      if (paymentToFilter) params.append('to', paymentToFilter);
      const res = await fetch(`/api/admin/mvp/payments?${params}`, {
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
      const result: PaymentsResponse = await res.json();
      setPaymentsData(result);
    } catch (e: unknown) {
      setPaymentsError(e instanceof Error ? e.message : 'Ошибка загрузки платежей');
    } finally {
      setPaymentsLoading(false);
    }
  }, [isAdmin, paymentEmailFilter, paymentFromFilter, paymentToFilter, token]);

  const loadModels = useCallback(async () => {
    if (!isAdmin) return;
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await fetch('/api/admin/mvp/models', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const result = await res.json();
      const models: AiModelDoc[] = result.models ?? [];
      setAiModels(models);
      const me: Record<string, { provider: string; displayName: string; isActive: boolean }> = {};
      for (const m of models) {
        me[m.modelId] = { provider: m.provider, displayName: m.displayName, isActive: m.isActive };
      }
      setModelEdits(me);
    } catch (e: unknown) {
      setModelsError(e instanceof Error ? e.message : 'Ошибка загрузки моделей');
    } finally {
      setModelsLoading(false);
    }
  }, [isAdmin, token]);

  const loadSettings = useCallback(async () => {
    if (!isAdmin) return;
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const [plansRes, modelsRes] = await Promise.all([
        fetch('/api/admin/mvp/plans', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }),
        fetch('/api/admin/mvp/models', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }),
      ]);
      if (!plansRes.ok) throw new Error(`${plansRes.status}: ${await plansRes.text()}`);
      const result = await plansRes.json();
      setSettingsPlans(result.plans ?? []);
      setSettingsPkgs(result.tokenPackages ?? []);
      const pe: Record<string, PlanEdit> = {};
      for (const p of result.plans ?? []) {
        pe[p.planId] = {
          priceRub: String(p.priceRub),
          tokenCreditsOnPurchase: String(p.tokenCreditsOnPurchase),
          allowedModels: p.allowedModels ?? [],  // массив modelId, не строка
          isActive: p.isActive,
        };
      }
      setPlanEdits(pe);
      const pke: Record<string, PkgEdit> = {};
      for (const pk of result.tokenPackages ?? []) {
        pke[pk.packageId] = {
          priceRub: String(pk.priceRub),
          tokenCredits: String(pk.tokenCredits),
          isActive: pk.isActive,
        };
      }
      setPkgEdits(pke);

      // Параллельно загружаем каталог моделей для multi-select
      if (modelsRes.ok) {
        const modelsResult = await modelsRes.json();
        const models: AiModelDoc[] = modelsResult.models ?? [];
        setAiModels(models);
        const me: Record<string, { provider: string; displayName: string; isActive: boolean }> = {};
        for (const m of models) {
          me[m.modelId] = { provider: m.provider, displayName: m.displayName, isActive: m.isActive };
        }
        setModelEdits(me);
      }
    } catch (e: unknown) {
      setSettingsError(e instanceof Error ? e.message : 'Ошибка загрузки настроек');
    } finally {
      setSettingsLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/c/new');
    } else if (user && isAdmin) {
      load();
    }
  }, [user, isAdmin, load, navigate]);

  useEffect(() => {
    if (isAdmin && tab === 'payments') {
      loadPayments();
    } else if (isAdmin && tab === 'settings') {
      loadSettings();
      // Загружаем список доступных эндпоинтов
      (async () => {
        try {
          const res = await fetch('/api/endpoints', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const endpoints = Object.keys(data).sort();
            setAvailableEndpoints(endpoints);
          }
        } catch (err) {
          console.error('Ошибка при загрузке эндпоинтов:', err);
        }
      })();
    }
  }, [isAdmin, tab, loadPayments, loadSettings]);

  const reconcilePayment = async () => {
    const id = reconcileId.trim();
    if (!id) return;
    setReconcileLoading(true);
    setReconcileResult(null);
    try {
      const res = await fetch(`/api/admin/mvp/payments/${encodeURIComponent(id)}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setReconcileResult(data);
      if (data.ok) { setReconcileId(''); loadPayments(); }
    } catch (e: unknown) {
      setReconcileResult({ ok: false, message: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setReconcileLoading(false);
    }
  };

  const savePlan = async (planId: string) => {
    const edit = planEdits[planId];
    if (!edit) return;
    setPlanSaving((p) => ({ ...p, [planId]: true }));
    setPlanSaveMsg((p) => ({ ...p, [planId]: { ok: false, text: '' } }));
    try {
      const body = {
        priceRub: parseFloat(edit.priceRub),
        tokenCreditsOnPurchase: parseInt(edit.tokenCreditsOnPurchase),
        allowedModels: edit.allowedModels,  // уже массив modelId
        isActive: edit.isActive,
      };
      const res = await fetch(`/api/admin/mvp/plans/${planId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setPlanSaveMsg((p) => ({ ...p, [planId]: { ok: true, text: 'Сохранено' } }));
      await loadSettings();
    } catch (e: unknown) {
      setPlanSaveMsg((p) => ({ ...p, [planId]: { ok: false, text: e instanceof Error ? e.message : 'Ошибка' } }));
    } finally {
      setPlanSaving((p) => ({ ...p, [planId]: false }));
    }
  };

  const savePkg = async (packageId: string) => {
    const edit = pkgEdits[packageId];
    if (!edit) return;
    setPkgSaving((p) => ({ ...p, [packageId]: true }));
    setPkgSaveMsg((p) => ({ ...p, [packageId]: { ok: false, text: '' } }));
    try {
      const body = {
        priceRub: parseFloat(edit.priceRub),
        tokenCredits: parseInt(edit.tokenCredits),
        isActive: edit.isActive,
      };
      const res = await fetch(`/api/admin/mvp/token-packages/${packageId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setPkgSaveMsg((p) => ({ ...p, [packageId]: { ok: true, text: 'Сохранено' } }));
      await loadSettings();
    } catch (e: unknown) {
      setPkgSaveMsg((p) => ({ ...p, [packageId]: { ok: false, text: e instanceof Error ? e.message : 'Ошибка' } }));
    } finally {
      setPkgSaving((p) => ({ ...p, [packageId]: false }));
    }
  };

  const saveModel = async (modelId: string) => {
    const edit = modelEdits[modelId];
    if (!edit) return;
    setModelSaving((p) => ({ ...p, [modelId]: true }));
    setModelSaveMsg((p) => ({ ...p, [modelId]: { ok: false, text: '' } }));
    try {
      const res = await fetch(`/api/admin/mvp/models/${encodeURIComponent(modelId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ provider: edit.provider, displayName: edit.displayName, isActive: edit.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setModelSaveMsg((p) => ({ ...p, [modelId]: { ok: true, text: 'Сохранено' } }));
      await loadSettings();
      await loadModels();
    } catch (e: unknown) {
      setModelSaveMsg((p) => ({ ...p, [modelId]: { ok: false, text: e instanceof Error ? e.message : 'Ошибка' } }));
    } finally {
      setModelSaving((p) => ({ ...p, [modelId]: false }));
    }
  };

  const confirmDeleteModel = async () => {
    const modelId = deleteModelDialog.modelId;
    if (!modelId) return;
    setDeleteModelError(null);
    try {
      const res = await fetch(`/api/admin/mvp/models/${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setDeleteModelDialog({ open: false, modelId: null });
      await loadSettings();
      await loadModels();
    } catch (e: unknown) {
      setDeleteModelError(e instanceof Error ? e.message : 'Ошибка удаления модели');
    }
  };

  const createModel = async () => {
    if (!newModelForm.modelId.trim() || !newModelForm.provider.trim() || !newModelForm.displayName.trim()) {
      setNewModelMsg({ ok: false, text: 'Заполните все поля' });
      return;
    }
    setNewModelSaving(true);
    setNewModelMsg(null);
    try {
      const res = await fetch('/api/admin/mvp/models', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(newModelForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setNewModelMsg({ ok: true, text: `Модель "${newModelForm.modelId}" создана` });
      setNewModelForm({ modelId: '', provider: '', endpointKey: '', displayName: '' });
      await loadSettings();
      await loadModels();
    } catch (e: unknown) {
      setNewModelMsg({ ok: false, text: e instanceof Error ? e.message : 'Ошибка создания' });
    } finally {
      setNewModelSaving(false);
    }
  };

  const changePlan = async (userId: string, plan: string) => {
    setPlanChanging((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/mvp/users/${userId}/plan`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка смены тарифа');
    } finally {
      setPlanChanging((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const addCredits = async (userId: string) => {
    const credits = parseInt(creditInputs[userId] || '');
    if (isNaN(credits) || credits === 0) {
      alert('Введите ненулевое число (можно отрицательное для списания)');
      return;
    }
    try {
      const res = await fetch(`/api/admin/mvp/users/${userId}/balance`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
    n.toLocaleString('ru-RU');

  // 1 tokenCredit = $0.000001; показываем приблизительный расход в центах
  const creditsToUsd = (n: number) => `$${(n * 0.000001).toFixed(3)}`;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Кнопка открытия боковой панели — десктоп, только когда панель закрыта */}
      {!navVisible && (
        <div className="sticky top-0 z-10 hidden items-center bg-gray-50 px-3 py-2 dark:bg-gray-900 md:flex">
          <OpenSidebar setNavVisible={setNavVisible} />
        </div>
      )}
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
            onClick={tab === 'users' ? load : tab === 'payments' ? loadPayments : loadSettings}
            disabled={tab === 'users' ? loading : tab === 'payments' ? paymentsLoading : settingsLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {(tab === 'users' ? loading : tab === 'payments' ? paymentsLoading : settingsLoading)
              ? 'Загрузка...'
              : 'Обновить'}
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
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
            onClick={() => setTab('payments')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'payments'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Платежи
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Настройки
          </button>
        </div>

        {/* ── USERS TAB ─────────────────────────────────────── */}
        {tab === 'users' && (
          <>
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
                            value={u.plan}
                            disabled={planChanging[u._id]}
                            onChange={(e) => changePlan(u._id, e.target.value)}
                            className={`rounded-full px-2 py-1 text-xs font-semibold cursor-pointer border-0 outline-none ${
                              (PLAN_DISPLAY[u.plan] ?? PLAN_DISPLAY.free).className
                            } ${planChanging[u._id] ? 'opacity-50' : ''}`}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="business">Business</option>
                          </select>
                          {u.planExpiresAt && (
                            <div className="mt-0.5 text-xs text-gray-400">
                              до {new Date(u.planExpiresAt).toLocaleDateString('ru-RU')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-mono font-medium ${
                              u.tokenCredits < 1_000_000
                                ? 'text-red-500'
                                : u.tokenCredits < 5_000_000
                                  ? 'text-amber-500'
                                  : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {formatCredits(u.tokenCredits)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                          {creditsToUsd(u.tokenCredits)}
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
          </> // users tab close
        )}

        {/* ── PAYMENTS TAB ───────────────────────────────────── */}
        {tab === 'payments' && (
          <>
            {/* Reconcile — ручная проверка платежа */}
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                Проверить платёж вручную (вебхук не дошёл)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="paymentId из ЮKassa (UUID)"
                  value={reconcileId}
                  onChange={(e) => { setReconcileId(e.target.value); setReconcileResult(null); }}
                  className="flex-1 min-w-[260px] rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={reconcilePayment}
                  disabled={reconcileLoading || !reconcileId.trim()}
                  className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {reconcileLoading ? 'Проверяю...' : 'Проверить и зачислить'}
                </button>
              </div>
              {reconcileResult && (
                <p className={`mt-2 text-sm ${reconcileResult.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {reconcileResult.message}
                </p>
              )}
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Фильтр по email..."
                value={paymentEmailFilter}
                onChange={(e) => setPaymentEmailFilter(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <input
                type="date"
                value={paymentFromFilter}
                onChange={(e) => setPaymentFromFilter(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <input
                type="date"
                value={paymentToFilter}
                onChange={(e) => setPaymentToFilter(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={loadPayments}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 transition-colors"
              >
                Применить
              </button>
            </div>

            {paymentsError && (
              <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
                {paymentsError}
              </div>
            )}

            {paymentsData && !paymentsLoading && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Найдено платежей: <strong>{paymentsData.total}</strong>
                  </p>
                  {paymentsData.totalSum > 0 && (
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Сумма: {paymentsData.totalSum.toLocaleString('ru-RU')} ₽
                    </p>
                  )}
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-750">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Пакет</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Кредиты</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Сумма (₽)</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Статус</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Дата</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {paymentsData.payments.map((p) => (
                          <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white truncate max-w-xs" title={p.email}>
                              {p.email}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {p.packageId}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatCredits(p.tokenCredits)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{p.amount || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold ${
                                p.status === 'succeeded' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {p.status === 'succeeded' ? 'Оплачен' : p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {paymentsData.payments.length === 0 && (
                      <div className="py-10 text-center text-sm text-gray-400">
                        Платежи не найдены
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {paymentsLoading && (
              <div className="py-10 text-center text-sm text-gray-400">Загрузка платежей...</div>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ───────────────────────────────────── */}
        {tab === 'settings' && (
          <>
            {settingsError && (
              <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
                {settingsError}
              </div>
            )}
            {settingsLoading && (
              <div className="py-10 text-center text-sm text-gray-400">Загрузка настроек...</div>
            )}
            {!settingsLoading && (
              <>
                {/* ── Каталог моделей ── */}
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Каталог моделей (AiModel)</h2>
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  Единственный источник истины для списка моделей. Только точные modelId используются в тарифах.
                </p>

                {/* Форма добавления новой модели */}
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                  <p className="mb-3 text-sm font-semibold text-blue-800 dark:text-blue-300">Добавить модель</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <div>
                      <label className="mb-0.5 block text-xs text-blue-700 dark:text-blue-400">modelId (точное имя)</label>
                      <input
                        type="text"
                        placeholder="gpt-4o-mini"
                        value={newModelForm.modelId}
                        onChange={(e) => setNewModelForm((f) => ({ ...f, modelId: e.target.value }))}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-blue-700 dark:text-blue-400">provider</label>
                      <input
                        type="text"
                        placeholder="openai / anthropic / deepseek"
                        value={newModelForm.provider}
                        onChange={(e) => setNewModelForm((f) => ({ ...f, provider: e.target.value }))}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-blue-700 dark:text-blue-400">endpointKey (необяз.)</label>
                      {availableEndpoints.length > 0 ? (
                        <select
                          value={newModelForm.endpointKey}
                          onChange={(e) => setNewModelForm((f) => ({ ...f, endpointKey: e.target.value }))}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">-- Выбрать из конфига --</option>
                          {availableEndpoints.map((ep) => (
                            <option key={ep} value={ep}>
                              {ep}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="openAI / anthropic / deepseek"
                          value={newModelForm.endpointKey}
                          onChange={(e) => setNewModelForm((f) => ({ ...f, endpointKey: e.target.value }))}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-blue-700 dark:text-blue-400">displayName</label>
                      <input
                        type="text"
                        placeholder="GPT-4o Mini"
                        value={newModelForm.displayName}
                        onChange={(e) => setNewModelForm((f) => ({ ...f, displayName: e.target.value }))}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={createModel}
                      disabled={newModelSaving}
                      className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {newModelSaving ? 'Создание...' : '+ Добавить модель'}
                    </button>
                    {newModelMsg && (
                      <span className={`text-xs ${newModelMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {newModelMsg.text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Список моделей */}
                {modelsError && (
                  <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">{modelsError}</div>
                )}
                {aiModels.length > 0 && (
                  <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700">
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">modelId</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">provider</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">displayName</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Активна</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {aiModels.map((m) => {
                          const edit = modelEdits[m.modelId];
                          const msg = modelSaveMsg[m.modelId];
                          if (!edit) return null;
                          return (
                            <tr key={m.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                              <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{m.modelId}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={edit.provider}
                                  onChange={(e) => setModelEdits((prev) => ({ ...prev, [m.modelId]: { ...prev[m.modelId], provider: e.target.value } }))}
                                  className="w-24 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={edit.displayName}
                                  onChange={(e) => setModelEdits((prev) => ({ ...prev, [m.modelId]: { ...prev[m.modelId], displayName: e.target.value } }))}
                                  className="w-36 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={edit.isActive}
                                  onChange={(e) => setModelEdits((prev) => ({ ...prev, [m.modelId]: { ...prev[m.modelId], isActive: e.target.checked } }))}
                                  className="h-3.5 w-3.5 rounded"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => saveModel(m.modelId)}
                                    disabled={modelSaving[m.modelId]}
                                    className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                  >
                                    {modelSaving[m.modelId] ? '...' : 'Сохранить'}
                                  </button>
                                  <button
                                    onClick={() => setDeleteModelDialog({ open: true, modelId: m.modelId })}
                                    className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600 transition-colors"
                                  >
                                    Удалить
                                  </button>
                                  {msg?.text && (
                                    <span className={`text-xs ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {msg.text}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Тарифные планы ── */}
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Тарифные планы</h2>
                <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {settingsPlans.map((plan) => {
                    const edit = planEdits[plan.planId];
                    if (!edit) return null;
                    const msg = planSaveMsg[plan.planId];
                    return (
                      <div
                        key={plan.planId}
                        className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-base font-semibold text-gray-900 dark:text-white">{plan.label}</span>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={edit.isActive}
                              onChange={(e) =>
                                setPlanEdits((prev) => ({
                                  ...prev,
                                  [plan.planId]: { ...prev[plan.planId], isActive: e.target.checked },
                                }))
                              }
                              className="h-3.5 w-3.5 rounded"
                            />
                            Активен
                          </label>
                        </div>
                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500 dark:text-gray-400">Цена (₽)</label>
                            <input
                              type="number"
                              value={edit.priceRub}
                              onChange={(e) =>
                                setPlanEdits((prev) => ({
                                  ...prev,
                                  [plan.planId]: { ...prev[plan.planId], priceRub: e.target.value },
                                }))
                              }
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500 dark:text-gray-400">Кредитов</label>
                            <input
                              type="number"
                              value={edit.tokenCreditsOnPurchase}
                              onChange={(e) =>
                                setPlanEdits((prev) => ({
                                  ...prev,
                                  [plan.planId]: { ...prev[plan.planId], tokenCreditsOnPurchase: e.target.value },
                                }))
                              }
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                            Разрешённые модели (пусто = все модели)
                          </label>
                          {aiModels.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Каталог моделей пуст — добавьте модели выше</p>
                          ) : (
                            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-750 space-y-1">
                              {aiModels.map((m) => (
                                <label
                                  key={m.modelId}
                                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-white dark:hover:bg-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded"
                                    checked={edit.allowedModels.includes(m.modelId)}
                                    onChange={(e) =>
                                      setPlanEdits((prev) => {
                                        const current = prev[plan.planId].allowedModels;
                                        const next = e.target.checked
                                          ? [...current, m.modelId]
                                          : current.filter((id) => id !== m.modelId);
                                        return { ...prev, [plan.planId]: { ...prev[plan.planId], allowedModels: next } };
                                      })
                                    }
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">
                                    {m.displayName}
                                    <span className="ml-1 font-mono text-gray-400">{m.modelId}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => savePlan(plan.planId)}
                            disabled={planSaving[plan.planId]}
                            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {planSaving[plan.planId] ? 'Сохранение...' : 'Сохранить'}
                          </button>
                          {msg?.text && (
                            <span
                              className={`text-xs ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            >
                              {msg.text}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Пакеты токенов ── */}
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Пакеты токенов</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {settingsPkgs.map((pkg) => {
                    const edit = pkgEdits[pkg.packageId];
                    if (!edit) return null;
                    const msg = pkgSaveMsg[pkg.packageId];
                    return (
                      <div
                        key={pkg.packageId}
                        className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-base font-semibold text-gray-900 dark:text-white">{pkg.label}</span>
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={edit.isActive}
                              onChange={(e) =>
                                setPkgEdits((prev) => ({
                                  ...prev,
                                  [pkg.packageId]: { ...prev[pkg.packageId], isActive: e.target.checked },
                                }))
                              }
                              className="h-3.5 w-3.5 rounded"
                            />
                            Активен
                          </label>
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500 dark:text-gray-400">Цена (₽)</label>
                            <input
                              type="number"
                              value={edit.priceRub}
                              onChange={(e) =>
                                setPkgEdits((prev) => ({
                                  ...prev,
                                  [pkg.packageId]: { ...prev[pkg.packageId], priceRub: e.target.value },
                                }))
                              }
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-gray-500 dark:text-gray-400">Кредитов</label>
                            <input
                              type="number"
                              value={edit.tokenCredits}
                              onChange={(e) =>
                                setPkgEdits((prev) => ({
                                  ...prev,
                                  [pkg.packageId]: { ...prev[pkg.packageId], tokenCredits: e.target.value },
                                }))
                              }
                              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => savePkg(pkg.packageId)}
                            disabled={pkgSaving[pkg.packageId]}
                            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {pkgSaving[pkg.packageId] ? 'Сохранение...' : 'Сохранить'}
                          </button>
                          {msg?.text && (
                            <span
                              className={`text-xs ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            >
                              {msg.text}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Диалог подтверждения удаления модели */}
      <OGDialog
        open={deleteModelDialog.open}
        onOpenChange={(open) => {
          setDeleteModelDialog((d) => ({ ...d, open }));
          if (!open) setDeleteModelError(null);
        }}
      >
        <OGDialogTemplate
          showCloseButton={false}
          title="Удалить модель"
          className="w-11/12 max-w-md"
          main={
            <div className="space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Удалить модель <span className="font-mono font-semibold">{deleteModelDialog.modelId}</span>?
                Она будет автоматически удалена из всех тарифных планов.
              </p>
              {deleteModelError && (
                <p className="text-sm text-red-600 dark:text-red-400">{deleteModelError}</p>
              )}
            </div>
          }
          selection={{
            selectHandler: confirmDeleteModel,
            selectClasses:
              'bg-red-700 dark:bg-red-600 hover:bg-red-800 dark:hover:bg-red-800 text-white',
            selectText: 'Удалить',
          }}
        />
      </OGDialog>
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
