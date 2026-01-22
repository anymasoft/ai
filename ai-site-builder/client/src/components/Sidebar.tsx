import {
    BotIcon,
    EyeIcon,
    Loader2Icon,
    SendIcon,
    UserIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import type { Message, Project, Version } from "../types";
import api from "@/config/axios";

interface SidebarProps {
    isMenuOpen: boolean;
    project: Project;
    setProject: (project: Project) => void;
    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;
}

const Sidebar = ({
    isMenuOpen,
    project,
    setProject,
    isGenerating,
    setIsGenerating,
}: SidebarProps) => {
    const messageRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const [showVersionAppliedToast, setShowVersionAppliedToast] = useState(false);

    const fetchProject = async () => {
        try {
            const { data } = await api.get(`/api/user/project/${project.id}`);
            setProject(data.project);
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                    error.message ||
                    "Something went wrong"
            );
            console.error(error);
        }
    };

    const handleRollback = async (versionId: string) => {
        try {
            setIsGenerating(true);

            const { data } = await api.post(
                `/api/project/apply-version`,
                {
                    projectId: project.id,
                    versionId: versionId
                }
            );

            const { data: data2 } = await api.get(
                `/api/user/project/${project.id}`
            );

            setProject(data2.project);

            // Show premium toast notification
            setShowVersionAppliedToast(true);

            // Auto-hide after 4 seconds
            setTimeout(() => {
                setShowVersionAppliedToast(false);
            }, 4000);

            setIsGenerating(false);
        } catch (error: any) {
            setIsGenerating(false);
            toast.error(
                error?.response?.data?.message ||
                    error.message ||
                    "Something went wrong"
            );
            console.error(error);
        }
    };

    const handleRevisions = async (e: FormEvent) => {
        e.preventDefault();

        let interval: number | undefined;
        try {
            setIsGenerating(true);
            interval = setInterval(() => {
                fetchProject();
            }, 10000);

            const { data } = await api.post(
                `/api/project/revision/${project.id}`,
                { message: input }
            );

            fetchProject();

            toast.success(data.message);

            setInput("");
            clearInterval(interval);
            setIsGenerating(false);
        } catch (error: any) {
            setIsGenerating(false);
            toast.error(
                error?.response?.data?.message ||
                    error.message ||
                    "Something went wrong"
            );
            console.error(error);
            clearInterval(interval);
        }
    };

    useEffect(() => {
        if (messageRef.current) {
            messageRef.current.scrollIntoView({
                behavior: "smooth",
            });
        }
    }, [project.conversation.length, isGenerating]);

    return (
        <div
            className={`h-full sm:max-w-sm rounded-xl bg-gray-900 border-gray-800 transition-all ${
                isMenuOpen ? "max-sm:w-0 overflow-hidden" : "w-full"
            }`}
        >
            <div className="flex flex-col h-full">
                {/* Message Container */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-3 flex flex-col gap-4">
                    {[...project.conversation, ...project.versions]
                        .sort(
                            (a, b) =>
                                new Date(a.timestamp).getTime() -
                                new Date(b.timestamp).getTime()
                        )
                        .map((item) => {
                            const isMessage = "content" in item;

                            if (isMessage) {
                                const msg = item as Message;
                                const isUser = msg.role === "user";
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex items-start gap-3 ${
                                            isUser
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-600 to-indigo-700 flex items-center justify-center">
                                                <BotIcon className="size-5 text-white" />
                                            </div>
                                        )}

                                        <div
                                            className={`max-w-[80%] p-2 px-4 rounded-2xl shadow-sm text-sm mt-5 leading-relaxed ${
                                                isUser
                                                    ? "bg-linear-to-r from-indigo-500 to-indigo-600 text-white rounded-tr-none"
                                                    : "rounded-tl-none bg-gray-800 text-gray-100"
                                            }`}
                                        >
                                            {msg.content}
                                        </div>

                                        {isUser && (
                                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                                <UserIcon className="size-5 text-white" />
                                            </div>
                                        )}
                                    </div>
                                );
                            } else {
                                const ver = item as Version;
                                return (
                                    <div
                                        key={ver.id}
                                        className="w-4/5 mx-auto my-2 p-3 rounded-xl bg-gray-800 text-gray-100 shadow flex flex-col gap-2"
                                    >
                                        <div className="text-xs font-medium">
                                            Code Updated <br />
                                            <span className="text-gray-500 text-xs font-normal">
                                                {new Date(
                                                    ver.timestamp
                                                ).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            {project.current_version_index ===
                                            ver.id ? (
                                                <button className="px-3 py-1 rounded-md text-xs bg-gray-700">
                                                    Current Version
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        handleRollback(ver.id)
                                                    }
                                                    className="px-3 py-1 rounded-md text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                                                >
                                                    Rollback to this version
                                                </button>
                                            )}
                                            <Link
                                                to={`/preview/${project.id}/${ver.id}`}
                                                target="_blank"
                                            >
                                                <EyeIcon className="size-6 p-1 bg-gray-700 hover:bg-indigo-500 transition-colors rounded" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }
                        })}

                    {isGenerating && (
                        <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-600 to-indigo-700 flex items-center justify-center">
                                <BotIcon className="size-5 text-white" />
                            </div>
                            <div className="flex gap-1.5 h-full items-end">
                                <span
                                    className="size-2 rounded-full animate-bounce bg-gray-600"
                                    style={{ animationDelay: "0s" }}
                                />
                                <span
                                    className="size-2 rounded-full animate-bounce bg-gray-600"
                                    style={{ animationDelay: "0.2s" }}
                                />
                                <span
                                    className="size-2 rounded-full animate-bounce bg-gray-600"
                                    style={{ animationDelay: "0.4s" }}
                                />
                            </div>
                        </div>
                    )}
                    <div ref={messageRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleRevisions} className="m-3 relative">
                    <div className="flex items-center gap-2">
                        <textarea
                            onChange={(e) => setInput(e.target.value)}
                            value={input}
                            rows={4}
                            placeholder="Describe your website or request changes..."
                            className="flex-1 p-3 rounded-xl resize-none text-sm outline-none ring ring-gray-700 focus:ring-indigo-500 bg-gray-800 text-gray-100 placeholder-gray-400 transition-all"
                            disabled={isGenerating}
                        />
                        <button
                            disabled={isGenerating || !input.trim()}
                            className="absolute bottom-2.5 right-2.5 rounded-full p-1 bg-linear-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white transition-colors disabled:opacity-60"
                        >
                            {isGenerating ? (
                                <Loader2Icon className="size-7 p-1.5 animate-spin text-white" />
                            ) : (
                                <SendIcon className="size-7 p-1.5 text-white" />
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Version Applied Toast - Premium UI */}
            {showVersionAppliedToast && (
                <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white inline-flex space-x-3 p-4 text-sm rounded-lg border border-gray-200 shadow-lg">
                        {/* Success Icon */}
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="flex-shrink-0 mt-0.5"
                        >
                            <path
                                d="M16.5 8.31V9a7.5 7.5 0 1 1-4.447-6.855M16.5 3 9 10.508l-2.25-2.25"
                                stroke="#22C55E"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* Text Content */}
                        <div>
                            <h3 className="text-slate-700 font-medium">Version applied</h3>
                            <p className="text-slate-500 text-xs">
                                You can switch between versions at any time
                            </p>
                        </div>

                        {/* Close Button */}
                        <button
                            type="button"
                            aria-label="close"
                            onClick={() => setShowVersionAppliedToast(false)}
                            className="flex-shrink-0 cursor-pointer text-slate-400 hover:text-slate-600 active:scale-95 transition"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <rect
                                    y="12.532"
                                    width="17.498"
                                    height="2.1"
                                    rx="1.05"
                                    transform="rotate(-45.74 0 12.532)"
                                    fill="currentColor"
                                    fillOpacity=".7"
                                />
                                <rect
                                    x="12.531"
                                    y="13.914"
                                    width="17.498"
                                    height="2.1"
                                    rx="1.05"
                                    transform="rotate(-135.74 12.531 13.914)"
                                    fill="currentColor"
                                    fillOpacity=".7"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
