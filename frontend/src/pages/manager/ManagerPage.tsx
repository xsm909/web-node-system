/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { AITaskManagement } from '../../widgets/ai-task-management/ui/AITaskManagement';
import { ClientMetadataManagement } from '../../widgets/client-metadata-management/ui/ClientMetadataManagement';
import { ReportManagement } from '../../widgets/report-management';
import { useAuthStore } from '../../features/auth/store';
import { AppSidebar } from '../../widgets/app-sidebar';
import { AppHeader } from '../../widgets/app-header';
import { ClientSelector } from '../../features/client-selection/ui/ClientSelector';
import { useClientStore } from '../../features/workflow-management/model/clientStore';
import { PromptViewer } from '../../widgets/prompt-viewer/ui/PromptViewer';
import { WorkflowManagement } from '../../widgets/common-workflow-management/WorkflowManagement';

export default function ManagerPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const [activeTab, setActiveTabState] = useState<'workflows' | 'reports' | 'ai-tasks' | 'client-metadata' | 'prompts'>('workflows');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const setActiveTab = useCallback((tab: 'workflows' | 'reports' | 'ai-tasks' | 'client-metadata' | 'prompts') => {
        if (tab === 'workflows') {
            setRefreshTrigger(n => n + 1);
        }
        setActiveTabState(tab);
    }, []);

    const { activeClientId } = useClientStore();
    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'admin';

    const filteredNavItems = [
        {
            id: 'workflows',
            label: 'Workflows',
            icon: 'automation',
            isActive: activeTab === 'workflows',
            onClick: () => setActiveTab('workflows'),
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: 'article',
            isActive: activeTab === 'reports',
            onClick: () => setActiveTab('reports'),
        },
        ...((activeClientId || isAdmin) ? [
            {
                id: 'ai-tasks',
                label: 'AI Tasks',
                icon: 'description',
                isActive: activeTab === 'ai-tasks',
                onClick: () => setActiveTab('ai-tasks'),
            }
        ] : []),
        ...(activeClientId ? [
            {
                id: 'client-metadata',
                label: 'Client Metadata',
                icon: 'metadata',
                isActive: activeTab === 'client-metadata',
                onClick: () => setActiveTab('client-metadata'),
            },
            {
                id: 'prompts',
                label: 'Prompt Viewer',
                icon: 'description',
                isActive: activeTab === 'prompts',
                onClick: () => setActiveTab('prompts'),
            }
        ] : []),
    ];

    return (
        <div className="fixed inset-0 flex bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden font-sans">
            <AppSidebar
                title="Clients workflows"
                headerIcon="bolt"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                topContent={<ClientSelector />}
                navItems={filteredNavItems}
                customContent={
                    <>
                        <div className="px-3 py-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-50">Workspace Resources</div>
                        <div className="flex flex-col gap-4 items-center justify-center p-8 rounded-3xl border border-[var(--border-base)] bg-[var(--border-muted)]/30 text-center border-dashed">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--border-base)]/50 flex items-center justify-center mb-2">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-30">
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                                </svg>
                            </div>
                            <p className="text-[var(--text-muted)] opacity-60 text-xs font-bold leading-relaxed px-4">Workspace tools and assets coming soon</p>
                        </div>
                    </>
                }
            />


            <main className="flex-1 flex flex-col min-h-0 min-w-0 relative">
                {activeTab === 'workflows' ? (
                    <WorkflowManagement
                        key={`workflows-${refreshTrigger}`}
                        onToggleSidebar={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                        refreshTrigger={refreshTrigger}
                    />
                ) : activeTab === 'reports' ? (
                    <ReportManagement
                        onToggleSidebar={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                    />
                ) : activeTab === 'ai-tasks' ? (
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        <AppHeader
                            onToggleSidebar={toggleSidebar}
                            isSidebarOpen={isSidebarOpen}
                            leftContent={
                                <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                                    AI Task Management
                                </h1>
                            }
                        />
                        <div className="flex-1 p-8 overflow-y-auto">
                            <AITaskManagement activeClientId={activeClientId} />
                        </div>
                    </div>
                ) : activeTab === 'client-metadata' ? (
                    <ClientMetadataManagement
                        activeClientId={activeClientId}
                        onToggleSidebar={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                    />
                ) : activeTab === 'prompts' ? (
                    <div className="flex-1 h-full min-h-0 flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <PromptViewer referenceId={activeClientId || undefined} />
                    </div>
                ) : null}
            </main>
        </div>
    );
}

