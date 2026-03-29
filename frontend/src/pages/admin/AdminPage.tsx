import { useState, useEffect } from 'react';
import { AppSidebar } from '../../widgets/app-sidebar';
import { UserManagement } from '../../widgets/user-management';
import { NodeLibraryManagement } from '../../widgets/node-library-management';
import { CredentialManagement } from '../../widgets/credential-management';
import { NodeTypeFormView } from '../../widgets/node-type-form-modal';
import { WorkflowManagement } from '../../widgets/common-workflow-management';
import { useNodeTypeManagement } from '../../features/node-type-management';
import { apiClient } from '../../shared/api/client';
import type { NodeType } from '../../entities/node-type/model/types';
import { getCookie, setCookie } from '../../shared/lib/cookieUtils';
import { AITaskManagement } from '../../widgets/ai-task-management/ui/AITaskManagement';
import { ReportManagement } from '../../widgets/report-management';
import { SchemaManagement } from '../../widgets/schema-management/ui/SchemaManagement';
import { AgentHintManagement } from '../../widgets/agent-hint-management/ui/AgentHintManagement';
import { useProjects } from '../../entities/project/api';
import { useProjectStore } from '../../features/projects/store';
import { Navigator, useNavigator } from '../../shared/ui/navigator';

const WorkflowsTabWithNavigator = ({
    refreshCount,
    setRefreshCount,
    allNodes,
    isSidebarOpen,
    setIsSidebarOpen
}: {
    refreshCount: number;
    setRefreshCount: React.Dispatch<React.SetStateAction<number>>;
    allNodes: NodeType[];
    isSidebarOpen: boolean;
    setIsSidebarOpen: (v: boolean) => void;
}) => {
    const nav = useNavigator();

    const {
        handleOpenModal: prepareNodeEdit,
        handleSave
    } = useNodeTypeManagement();

    const handleEditNode = (node: NodeType) => {
        // This is called when double-clicking a node in the graph
        prepareNodeEdit(node);
        nav.push(
            <NodeTypeFormView
                onClose={() => nav.pop()}
                editingNode={node}
                onSave={(data) => {
                    return handleSave(data, data.id || node.id, () => {
                        setRefreshCount(r => r + 1);
                    });
                }}
                onRefresh={() => setRefreshCount(r => r + 1)}
                allNodes={allNodes}
                defaultTab="code"
            />
        );
    };

    return (
        <WorkflowManagement
            onToggleSidebar={() => setIsSidebarOpen(true)}
            isSidebarOpen={isSidebarOpen}
            onEditNode={handleEditNode}
            refreshTrigger={refreshCount}
        />
    );
};

const NodesTabWithNavigator = ({
    setRefreshCount,
    allNodes,
    isSidebarOpen,
    setIsSidebarOpen
}: {
    setRefreshCount: React.Dispatch<React.SetStateAction<number>>;
    allNodes: NodeType[];
    isSidebarOpen: boolean;
    setIsSidebarOpen: (v: boolean) => void;
}) => {
    const nav = useNavigator();

    const {
        handleOpenModal: prepareNodeEdit,
        handleDuplicateNode: prepareNodeDuplicate,
        handleSave
    } = useNodeTypeManagement();

    const handleEditNode = (node?: NodeType) => {
        prepareNodeEdit(node);
        nav.push(
            <NodeTypeFormView
                onClose={() => nav.pop()}
                editingNode={node || null}
                onSave={(data) => {
                    return handleSave(data, data.id || node?.id, () => {
                        setRefreshCount(r => r + 1);
                    });
                }}
                onRefresh={() => setRefreshCount(r => r + 1)}
                allNodes={allNodes}
            />
        );
    };

    const handleDuplicateNode = (node: NodeType) => {
        prepareNodeDuplicate(node);
        nav.push(
            <NodeTypeFormView
                onClose={() => nav.pop()}
                editingNode={null}
                initialData={{ ...node, name: `${node.name} (Copy)` }}
                onSave={(data) => {
                    return handleSave(data, data.id, () => {
                        setRefreshCount(r => r + 1);
                    });
                }}
                onRefresh={() => setRefreshCount(r => r + 1)}
                allNodes={allNodes}
            />
        );
    };

    return (
        <NodeLibraryManagement
            nodes={allNodes}
            onEditNode={handleEditNode}
            onDuplicateNode={handleDuplicateNode}
            onDelete={() => setRefreshCount(r => r + 1)}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            isSidebarOpen={isSidebarOpen}
        />
    );
};



import { useNavigationIntercept } from '../../shared/lib/navigation-guard/useNavigationGuard';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { PinnedTabsTray } from '../../widgets/pinned-tabs-tray/ui/PinnedTabsTray';
import { PinnedFormRouter } from '../../widgets/pinned-tabs-tray/ui/PinnedFormRouter';
import { usePinStore } from '../../features/pinned-tabs/model/store';

export default function AdminPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTab, setActiveTabState] = useState<'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints'>(
        (getCookie('active_admin_tab') as 'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints') || 'users'
    );

    const { focus, activeTabId } = usePinStore();

    const [refreshCount, setRefreshCount] = useState(0);
    const [resetNonce, setResetNonce] = useState(0);

    const {
        isIntercepted,
        handleIntercept,
        confirmSave,
        confirmDiscard,
        isSaving: isInterceptSaving,
        cancel
    } = useNavigationIntercept();

    const { setPinnedContext } = useProjectStore();
    const { data: projects = [] } = useProjects();
    const tabs = usePinStore(s => s.tabs);

    // Sync Pinned Context (Shadowing)
    useEffect(() => {
        if (!activeTabId) {
            setPinnedContext(undefined);
            return;
        }

        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;

        if (activeTab.projectId) {
            const project = projects.find(p => p.id === activeTab.projectId);
            if (project) {
                setPinnedContext(project);
            } else if (projects.length > 0) {
                // Project not found in current list but we are in project mode
                setPinnedContext(null);
            }
        } else {
            // Global Mode for global tabs
            setPinnedContext(null);
        }
    }, [activeTabId, tabs, projects, setPinnedContext]);

    const setActiveTab = (tab: 'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints') => {
        handleIntercept(() => {
            // Deactivate pinned tab when clicking sidebar
            focus(null);
            
            if (activeTab === tab) {
                setResetNonce(n => n + 1);
            }
            setCookie('active_admin_tab', tab);
            setActiveTabState(tab);
        });
    };
    const [allNodes, setAllNodes] = useState<NodeType[]>([]);

    useEffect(() => {
        apiClient.get(`/admin/node-types?t=${Date.now()}`).then(({ data }) => setAllNodes(data)).catch(() => { });
    }, [refreshCount]);

    return (
        <div className="flex h-screen bg-surface-900 text-[var(--text-main)] font-sans overflow-hidden">
            <AppSidebar
                title="Workflow Engine"
                headerIcon="bolt"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                navItems={[
                    { id: 'users', label: 'Users', icon: 'user', isActive: activeTab === 'users', onClick: () => setActiveTab('users') },
                    { id: 'credentials', label: 'Credentials', icon: 'verified', isActive: activeTab === 'credentials', onClick: () => setActiveTab('credentials') },
                    { id: 'reports', label: 'Reports', icon: 'article', isActive: activeTab === 'reports', onClick: () => setActiveTab('reports') },
                    { id: 'schemas', label: 'Schemas', icon: 'schema', isActive: activeTab === 'schemas', onClick: () => setActiveTab('schemas') },
                    { id: 'agent-hints', label: 'Agent Hints', icon: 'lightbulb_circle', isActive: activeTab === 'agent-hints', onClick: () => setActiveTab('agent-hints') },
                    { id: 'nodes', label: 'Node Types', icon: 'function', isActive: activeTab === 'nodes', onClick: () => setActiveTab('nodes') },
                    { id: 'workflows', label: 'Workflows', icon: 'automation', isActive: activeTab === 'workflows', onClick: () => setActiveTab('workflows') },
                ]}
            />

            <main className="flex-1 flex flex-row min-w-0 overflow-hidden bg-[var(--bg-app)]">
                <div className="flex-1 flex flex-col min-h-0 w-full relative">
                    {activeTabId ? (
                        <PinnedFormRouter />
                    ) : (
                        <>
                            {activeTab === 'users' ? (
                                <UserManagement onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            ) : activeTab === 'nodes' ? (
                                <Navigator
                                    key={`nodes-${resetNonce}`}
                                    initialScene={
                                        <NodesTabWithNavigator
                                            setRefreshCount={setRefreshCount}
                                            allNodes={allNodes}
                                            isSidebarOpen={isSidebarOpen}
                                            setIsSidebarOpen={setIsSidebarOpen}
                                        />
                                    }
                                />
                            ) : activeTab === 'workflows' ? (
                                <Navigator
                                    key={`workflows-${resetNonce}`}
                                    initialScene={
                                        <WorkflowsTabWithNavigator
                                            refreshCount={refreshCount}
                                            setRefreshCount={setRefreshCount}
                                            allNodes={allNodes}
                                            isSidebarOpen={isSidebarOpen}
                                            setIsSidebarOpen={setIsSidebarOpen}
                                        />
                                    }
                                />
                            ) : activeTab === 'schemas' ? (
                                <SchemaManagement onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            ) : activeTab === 'ai-tasks' ? (
                                <AITaskManagement activeClientId={null} onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            ) : activeTab === 'reports' ? (
                                <ReportManagement onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            ) : activeTab === 'agent-hints' ? (
                                <AgentHintManagement onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            ) : (
                                <CredentialManagement onToggleSidebar={() => setIsSidebarOpen(true)} isSidebarOpen={isSidebarOpen} />
                            )}
                        </>
                    )}
                </div>
                <PinnedTabsTray />
            </main>

            <ConfirmModal
                isOpen={isIntercepted}
                title="Unsaved Changes"
                description="You have unsaved changes in the current section. Would you like to save them before switching?"
                confirmLabel="Save and Switch"
                cancelLabel="Stay Here"
                variant="warning"
                isLoading={isInterceptSaving}
                onConfirm={confirmSave}
                onCancel={cancel}
            >
                <div className="mt-2">
                    <button
                        type="button"
                        className="w-full px-4 py-3 rounded-2xl text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all uppercase tracking-widest active:scale-95"
                        onClick={confirmDiscard}
                    >
                        Discard and Switch
                    </button>
                </div>
            </ConfirmModal>
        </div>
    );
}

