import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/config/axios";

interface Transaction {
    id: string;
    action: string;
    credits: number;
    date: string;
    status: "success" | "pending";
}

const CreditsTab = () => {
    const [credits, setCredits] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Fetch current credits
    const fetchCredits = async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/api/user/credits");
            setCredits(data.credits);
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                "Не удалось загрузить кредиты"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCredits();
    }, []);

    // Handle purchase
    const handlePurchase = async (planId: string) => {
        try {
            setPurchasing(true);
            const { data } = await api.post("/api/user/purchase-credits", {
                planId,
            });

            if (data?.message) {
                toast.success(data.message);
                // Refresh credits
                await fetchCredits();
            }
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                "Ошибка при покупке кредитов"
            );
        } finally {
            setPurchasing(false);
        }
    };

    const plans = [
        { id: "basic", name: "Basic", credits: 100, price: "$9" },
        { id: "pro", name: "Pro", credits: 400, price: "$29" },
        { id: "enterprise", name: "Enterprise", credits: 1000, price: "$99" },
    ];

    return (
        <div className="w-full">
            {/* Credit Balance Card */}
            <div className="bg-black/10 ring ring-indigo-950 max-w-xl mx-auto rounded-lg p-6 text-white mb-6">
                <h3 className="text-lg font-semibold mb-4">Баланс кредитов</h3>

                <div className="mb-6">
                    {loading ? (
                        <div className="text-gray-400">Загрузка...</div>
                    ) : (
                        <>
                            <div className="text-sm text-gray-400 mb-2">
                                Текущий баланс
                            </div>
                            <div className="text-4xl font-bold text-indigo-300">
                                {credits}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                1 кредит = 1 генерация/изменение
                            </div>
                        </>
                    )}
                </div>

                {/* Info text */}
                <div className="bg-black/40 rounded p-3 text-xs text-gray-300 border border-indigo-900/30">
                    <p>
                        • Создание проекта: <span className="text-red-400">-5 кредитов</span>
                    </p>
                    <p>
                        • Изменение проекта: <span className="text-red-400">-5 кредитов</span>
                    </p>
                    <p className="mt-2 text-gray-400">
                        ⚠️ <span className="text-orange-300">DEV режим:</span> Кредиты добавляются без реального платежа
                    </p>
                </div>
            </div>

            {/* Quick Buy Plans Card */}
            <div className="bg-black/10 ring ring-indigo-950 max-w-xl mx-auto rounded-lg p-6 text-white mb-6">
                <h3 className="text-lg font-semibold mb-4">Купить кредиты</h3>

                <div className="space-y-3">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => handlePurchase(plan.id)}
                            disabled={purchasing}
                            className="w-full flex items-center justify-between p-3 rounded border border-indigo-900/50 hover:border-indigo-600 hover:bg-indigo-950/30 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <div>
                                    <div className="font-medium">{plan.name}</div>
                                    <div className="text-sm text-indigo-300">
                                        +{plan.credits} кредитов
                                    </div>
                                </div>
                            </div>
                            <div className="font-semibold text-indigo-300">
                                {plan.price}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Transaction History Card */}
            <div className="bg-black/10 ring ring-indigo-950 max-w-xl mx-auto rounded-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">История (DEV)</h3>

                <div className="text-xs text-gray-400 mb-3">
                    ⚠️ В DEV режиме история пока не отслеживается
                </div>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 rounded bg-black/20 border border-indigo-900/30">
                        <div>
                            <div className="text-gray-300">Пример: Создание проекта</div>
                            <div className="text-xs text-gray-500">Сегодня</div>
                        </div>
                        <div className="font-mono text-red-400">-5</div>
                    </div>
                </div>

                <div className="mt-4 p-3 rounded bg-black/40 border border-indigo-900/30">
                    <p className="text-xs text-gray-400">
                        💡 Совет: После реальной авторизации здесь появится полная история ваших покупок и трат кредитов.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CreditsTab;
