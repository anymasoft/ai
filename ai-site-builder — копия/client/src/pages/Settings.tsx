import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    AccountSettingsCards,
    ChangePasswordCard,
    DeleteAccountCard,
} from "@daveyplate/better-auth-ui";
import api from "@/config/axios";

const Settings = () => {
    const [credits, setCredits] = useState<number>(0);

    useEffect(() => {
        const fetchCredits = async () => {
            try {
                const { data } = await api.get("/api/user/credits");
                setCredits(data.credits);
            } catch (error: any) {
                console.error("Error fetching credits:", error);
            }
        };
        fetchCredits();
    }, []);

    const handleAddCredits = async (planId: string) => {
        try {
            const { data } = await api.post("/api/user/purchase-credits", {
                planId,
            });
            toast.success(data.message);
            const { data: newData } = await api.get("/api/user/credits");
            setCredits(newData.credits);
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message || "Ошибка при добавлении кредитов"
            );
        }
    };

    return (
        <div className="w-full p-4 flex justify-center items-center min-h-[90vh] flex-col gap-6 py-12">
            <AccountSettingsCards
                classNames={{
                    card: {
                        base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                        footer: "bg-black/10 ring ring-indigo-950",
                    },
                }}
            />
            <div className="w-full">
                <ChangePasswordCard
                    classNames={{
                        base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                        footer: "bg-black/10 ring ring-indigo-950",
                    }}
                />
            </div>

            {/* Кредиты - Карточка */}
            <div className="w-full">
                <div className="bg-black/10 ring ring-indigo-950 max-w-xl mx-auto rounded-lg p-6 text-white">
                    <h3 className="text-lg font-semibold mb-4">Кредиты</h3>
                    <div className="mb-6">
                        <div className="text-sm text-gray-400 mb-2">Текущий баланс</div>
                        <div className="text-3xl font-bold text-indigo-300">{credits}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            • Создание: -5 | • Изменение: -5
                        </div>
                    </div>
                    <div className="space-y-2">
                        <button
                            onClick={() => handleAddCredits("basic")}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition"
                        >
                            +100 кредитов ($9)
                        </button>
                        <button
                            onClick={() => handleAddCredits("pro")}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition"
                        >
                            +400 кредитов ($29)
                        </button>
                        <button
                            onClick={() => handleAddCredits("enterprise")}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition"
                        >
                            +1000 кредитов ($99)
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full">
                <DeleteAccountCard
                    classNames={{
                        base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                    }}
                />
            </div>
        </div>
    );
};

export default Settings;
