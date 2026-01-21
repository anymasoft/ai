import { useState } from "react";
import {
    AccountSettingsCards,
    ChangePasswordCard,
    DeleteAccountCard,
} from "@daveyplate/better-auth-ui";
import CreditsTab from "@/components/CreditsTab";

type SettingsTab = "account" | "password" | "credits" | "delete";

const Settings = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>("account");

    const tabs: Array<{ id: SettingsTab; label: string }> = [
        { id: "account", label: "Аккаунт" },
        { id: "credits", label: "Кредиты" },
        { id: "password", label: "Пароль" },
        { id: "delete", label: "Удалить" },
    ];

    return (
        <div className="w-full p-4 flex justify-center items-center min-h-[90vh] flex-col gap-6 py-12">
            {/* Tab Navigation */}
            <div className="w-full max-w-xl mx-auto">
                <div className="flex gap-2 border-b border-indigo-950 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                                activeTab === tab.id
                                    ? "text-indigo-400 border-b-2 border-indigo-400"
                                    : "text-gray-400 hover:text-gray-300"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="w-full">
                {/* Account Tab */}
                {activeTab === "account" && (
                    <AccountSettingsCards
                        classNames={{
                            card: {
                                base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                                footer: "bg-black/10 ring ring-indigo-950",
                            },
                        }}
                    />
                )}

                {/* Credits Tab */}
                {activeTab === "credits" && <CreditsTab />}

                {/* Password Tab */}
                {activeTab === "password" && (
                    <div className="w-full">
                        <ChangePasswordCard
                            classNames={{
                                base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                                footer: "bg-black/10 ring ring-indigo-950",
                            }}
                        />
                    </div>
                )}

                {/* Delete Tab */}
                {activeTab === "delete" && (
                    <div className="w-full">
                        <DeleteAccountCard
                            classNames={{
                                base: "bg-black/10 ring ring-indigo-950 max-w-xl mx-auto",
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
