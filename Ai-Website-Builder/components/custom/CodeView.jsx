"use client"
import React, { useContext, useState, useEffect } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackFileExplorer
} from "@codesandbox/sandpack-react";
import Lookup from '@/data/Lookup';
import { MessagesContext } from '@/context/MessagesContext';
import axios from 'axios';
import Prompt from '@/data/Prompt';
import { UpdateFiles } from '@/convex/workspace';
import { useConvex, useMutation } from 'convex/react';
import { useParams } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { Loader2Icon, Download } from 'lucide-react';
import JSZip from 'jszip';

function CodeView() {

    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('code');
    const [files,setFiles]=useState(Lookup?.DEFAULT_FILE);
    const {messages,setMessages}=useContext(MessagesContext);
    const UpdateFiles=useMutation(api.workspace.UpdateFiles);
    const convex=useConvex();
    const [loading,setLoading]=useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // 🆕 ДВУХРЕЖИМНАЯ АРХИТЕКТУРА
    const [targetFile, setTargetFile] = useState(null);  // Какой файл редактируем
    const [editMode, setEditMode] = useState('auto');   // 'template_filling' | 'fragment_editing' | 'auto'
    const [conversationTurn, setConversationTurn] = useState(0);

    useEffect(() => {
        id&&GetFiles();
    }, [id])

    const GetFiles=async()=>{
        const result=await convex.query(api.workspace.GetWorkspace,{
            workspaceId:id
        });
        // Preprocess and validate files before merging
        const processedFiles = preprocessFiles(result?.fileData || {});
        const mergedFiles = {...Lookup.DEFAULT_FILE, ...processedFiles};
        setFiles(mergedFiles);
    }

    // Add file preprocessing function
    const preprocessFiles = (files) => {
        const processed = {};
        Object.entries(files).forEach(([path, content]) => {
            // Ensure the file has proper content structure
            if (typeof content === 'string') {
                processed[path] = { code: content };
            } else if (content && typeof content === 'object') {
                if (!content.code && typeof content === 'object') {
                    processed[path] = { code: JSON.stringify(content, null, 2) };
                } else {
                    processed[path] = content;
                }
            }
        });
        return processed;
    }

    useEffect(() => {
            if (messages?.length > 0) {
                const role = messages[messages?.length - 1].role;
                if (role === 'user') {
                    GenerateAiCode();
                }
            }
        }, [messages])

    const GenerateAiCode=async()=>{
        setLoading(true);
        const userMessage = messages?.length > 0 ? messages[messages.length - 1]?.content : "";

        // 🆕 Определяем targetFile если не установлен
        // По умолчанию редактируем App.js
        const currentTargetFile = targetFile || '/App.js';

        console.log(`📝 GenerateAiCode: target=${currentTargetFile}, mode=${editMode}, turn=${conversationTurn}`);

        try {
            // 🆕 ДВУХРЕЖИМНАЯ АРХИТЕКТУРА: отправляем targetFile, mode и turn
            const result = await axios.post('/api/gen-ai-code', {
                targetFile: currentTargetFile,      // 🆕 Какой файл редактируем
                userMessage: userMessage,            // Запрос пользователя
                messages: messages,                 // История сообщений
                currentCode: files,                 // Все текущие файлы
                mode: editMode,                     // 🆕 'template_filling' | 'fragment_editing' | 'auto'
                conversationTurn: conversationTurn  // 🆕 Номер в диалоге
            });

            // Preprocess AI-generated files
            const processedAiFiles = preprocessFiles(result.data?.files || {});
            const mergedFiles = {...Lookup.DEFAULT_FILE, ...processedAiFiles};
            setFiles(mergedFiles);

            // Форсируем переинициализацию Sandpack
            setRefreshKey(prev => prev + 1);

            // Увеличиваем номер очереди разговора
            setConversationTurn(prev => prev + 1);

            console.log("✅ Файлы обновлены, режим:", result.data?.mode);

            if(result.data?.files) {
                await UpdateFiles({
                    workspaceId:id,
                    files:result.data.files
                });
            }
        } catch(error) {
            console.error("❌ Ошибка при генерации кода:", error.message);
        } finally {
            setLoading(false);
        }
    }

    const downloadFiles = async () => {
        try {
            // Create a new JSZip instance
            const zip = new JSZip();
            
            // Add each file to the zip
            Object.entries(files).forEach(([filename, content]) => {
                // Handle the file content based on its structure
                let fileContent;
                if (typeof content === 'string') {
                    fileContent = content;
                } else if (content && typeof content === 'object') {
                    if (content.code) {
                        fileContent = content.code;
                    } else {
                        // If it's an object without code property, stringify it
                        fileContent = JSON.stringify(content, null, 2);
                    }
                }

                // Only add the file if we have content
                if (fileContent) {
                    // Remove leading slash if present
                    const cleanFileName = filename.startsWith('/') ? filename.slice(1) : filename;
                    zip.file(cleanFileName, fileContent);
                }
            });

            // Add package.json with dependencies
            const packageJson = {
                name: "generated-project",
                version: "1.0.0",
                private: true,
                dependencies: Lookup.DEPENDANCY,
                scripts: {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                }
            };
            zip.file("package.json", JSON.stringify(packageJson, null, 2));

            // Generate the zip file
            const blob = await zip.generateAsync({ type: "blob" });
            
            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
        }
    };

    return (
        <div className='relative'>
            <div className='bg-[#181818] w-full p-2 border'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center flex-wrap shrink-0 bg-black p-1 justify-center
                    w-[140px] gap-3 rounded-full'>
                        <h2 onClick={() => setActiveTab('code')}
                            className={`text-sm cursor-pointer 
                        ${activeTab == 'code' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Code</h2>

                        <h2 onClick={() => setActiveTab('preview')}
                            className={`text-sm cursor-pointer 
                        ${activeTab == 'preview' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Preview</h2>
                    </div>
                    
                    {/* Download Button */}
                    <button
                        onClick={downloadFiles}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200"
                    >
                        <Download className="h-4 w-4" />
                        <span>Download Files</span>
                    </button>
                </div>
            </div>
            <SandpackProvider
            key={`${refreshKey}-${JSON.stringify(Object.keys(files))}`}
            files={files}
            template="react"
            theme={'dark'}
            customSetup={{
                dependencies: {
                    ...Lookup.DEPENDANCY
                },
                entry: '/index.js'
            }}
            options={{
                externalResources: ['https://cdn.tailwindcss.com'],
                bundlerTimeoutSecs: 120,
                recompileMode: "immediate",
                recompileDelay: 300
            }}
            >
                <SandpackLayout>
                    <div style={{
                        display: activeTab === 'code' ? 'flex' : 'none'
                    }}>
                        <SandpackFileExplorer style={{ height: '80vh' }} />
                        <SandpackCodeEditor
                        key="code"
                        style={{ height: '80vh' }}
                        showTabs
                        showLineNumbers
                        showInlineErrors
                        wrapContent />
                    </div>

                    <div style={{
                        display: activeTab === 'preview' ? 'block' : 'none',
                        width: '100%'
                    }}>
                        <SandpackPreview
                            key="preview"
                            style={{ height: '80vh' }}
                            showNavigator={true}
                            showOpenInCodeSandbox={false}
                            showRefreshButton={true}
                        />
                    </div>
                </SandpackLayout>
            </SandpackProvider>

            {loading&&<div className='p-10 bg-gray-900 opacity-80 absolute top-0 
            rounded-lg w-full h-full flex items-center justify-center'>
                <Loader2Icon className='animate-spin h-10 w-10 text-white'/>
                <h2 className='text-white'> Generating files...</h2>
            </div>}
        </div>
    );
}

export default CodeView;