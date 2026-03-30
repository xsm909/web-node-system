import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { AppCompactModalForm } from '../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { useNavigationIntercept } from '../../shared/lib/navigation-guard/useNavigationGuard';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { PinnedTabsTray } from '../../widgets/pinned-tabs-tray/ui/PinnedTabsTray';
import { PinnedFormRouter } from '../../widgets/pinned-tabs-tray/ui/PinnedFormRouter';
import { usePinStore } from '../../features/pinned-tabs/model/store';
import { usePinnedNavigation } from '../../features/pinned-tabs/lib/usePinnedCheck';
import type { Project } from '../../entities/project/model/types';

const WorkflowsTabWithNavigator = React.memo(({
    refreshCount,
    isSidebarOpen,
    setIsSidebarOpen,
    onEditNode,
}: {
    refreshCount: number;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (v: boolean) => void;
    onEditNode: (node: NodeType) => void;
}) => {
    const {
        handleOpenModal: prepareNodeEdit,
    } = useNodeTypeManagement();

    const handleEditNode = React.useCallback((node: NodeType) => {
        // This is called when double-clicking a node in the graph
        prepareNodeEdit(node);
        onEditNode(node);
    }, [prepareNodeEdit, onEditNode]);

    const onToggleSidebar = React.useCallback(() => setIsSidebarOpen(true), [setIsSidebarOpen]);

    return (
        <WorkflowManagement
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            onEditNode={handleEditNode}
            refreshTrigger={refreshCount}
        />
    );
});

const NodesTabWithNavigator = React.memo(({
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
    const { openOrFocus } = usePinnedNavigation();

    const {
        handleOpenModal: prepareNodeEdit,
        handleDuplicateNode: prepareNodeDuplicate,
        handleSave
    } = useNodeTypeManagement();

    const handleEditNode = React.useCallback((node?: NodeType) => {
        const doOpen = () => {
            prepareNodeEdit(node || undefined);
            nav.push(
                <NodeTypeFormView
                    onClose={() => nav.pop()}
                    editingNode={node || null}
                    onSave={(data) => {
                        return handleSave(data, data.id || node?.id, () => {
                            setRefreshCount((r: number) => r + 1);
                        });
                    }}
                    onRefresh={() => setRefreshCount((r: number) => r + 1)}
                    allNodes={allNodes}
                />
            );
        };

        if (node?.id) {
            openOrFocus('node_types', node.id, doOpen);
        } else {
            doOpen();
        }
    }, [prepareNodeEdit, nav, handleSave, setRefreshCount, allNodes, openOrFocus]);

    const handleDuplicateNode = React.useCallback((node: NodeType) => {
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
    }, [prepareNodeDuplicate, nav, handleSave, setRefreshCount, allNodes]);

    const onToggleSidebar = React.useCallback(() => setIsSidebarOpen(true), [setIsSidebarOpen]);

    return (
        <NodeLibraryManagement
            nodes={allNodes}
            onEditNode={handleEditNode}
            onDuplicateNode={handleDuplicateNode}
            onDelete={() => setRefreshCount(r => r + 1)}
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
        />
    );
});

export default function AdminPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTab, setActiveTabState] = useState<'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints'>(
        (getCookie('active_admin_tab') as 'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints') || 'users'
    );

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

    const [editingNodeForModal, setEditingNodeForModal] = useState<NodeType | null>(null);
    const modalFormSubmitRef = useRef<() => void>(null);

    const {
        handleSave: handleNodeSave
    } = useNodeTypeManagement();

    // Use selectors to avoid unnecessary re-renders when other parts of the store change
    const setPinnedContext = useProjectStore(s => s.setPinnedContext);
    const activeProjectInStore = useProjectStore(s => s.activeProject);
    const isProjectModeInStore = useProjectStore(s => s.isProjectMode);
    const baseProject = useProjectStore(s => s.baseProject);
    const isBaseProjectMode = useProjectStore(s => s.isBaseProjectMode);

    const activeTabId = usePinStore(s => s.activeTabId);
    const tabs = usePinStore(s => s.tabs);
    const focus = usePinStore(s => s.focus);

    const { data: projectsRaw = [] } = useProjects();
    const projects = useMemo(() => projectsRaw, [projectsRaw]);

    const activePinnedTab = useMemo(() => 
        tabs.find(t => t.id === activeTabId) || null
    , [tabs, activeTabId]);

    const targetProject = useMemo(() => {
        if (!activePinnedTab) return undefined; // undefined means "restore to base"
        
        if (!activePinnedTab.projectId) return null; // null means "global mode"
        
        const found = projects.find(p => p.id === activePinnedTab.projectId);
        if (found) return found;

        // Loading fallback: stable object for the same ID
        return { 
            id: activePinnedTab.projectId, 
            name: 'Loading...', 
            theme_color: null 
        } as Project;
    }, [activePinnedTab, projects]);

    // Sync Pinned Context (Shadowing)
    useEffect(() => {
        // Only update if different from current active state in store to prevent infinite loops
        const isCurrentlyGlobal = !isProjectModeInStore;
        const wantGlobal = targetProject === null;
        const wantRestore = targetProject === undefined;
        
        if (wantRestore) {
            if (activeProjectInStore?.id !== baseProject?.id || isProjectModeInStore !== isBaseProjectMode) {
                setPinnedContext(undefined);
            }
            return;
        }

        const projectChanged = activeProjectInStore?.id !== targetProject?.id;
        const modeChanged = isCurrentlyGlobal !== wantGlobal;

        if (projectChanged || modeChanged) {
            setPinnedContext(targetProject);
        }
    }, [targetProject, setPinnedContext, activeProjectInStore, isProjectModeInStore, baseProject?.id, isBaseProjectMode]);

    const setActiveTab = useCallback((tab: 'users' | 'nodes' | 'schemas' | 'credentials' | 'workflows' | 'ai-tasks' | 'reports' | 'agent-hints') => {
        handleIntercept(() => {
            // Deactivate pinned tab when clicking sidebar
            focus(null);
            
            if (activeTab === tab) {
                setResetNonce(n => n + 1);
            }
            setCookie('active_admin_tab', tab);
            setActiveTabState(tab);
        });
    }, [activeTab, focus, handleIntercept]);

    const [allNodes, setAllNodes] = useState<NodeType[]>([]);

    useEffect(() => {
        apiClient.get(`/admin/node-types?t=${Date.now()}`).then(({ data }) => setAllNodes(data)).catch(() => { });
    }, [refreshCount]);

    const toggleSidebar = useCallback(() => setIsSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
    const setEditingNode = useCallback((node: NodeType) => setEditingNodeForModal(node), []);

    // Memoize the initial scenes to ensure the Navigator doesn't restart its stack
    const nodesScene = useMemo(() => (
        <NodesTabWithNavigator
            setRefreshCount={setRefreshCount}
            allNodes={allNodes}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
        />
    ), [allNodes, isSidebarOpen, setIsSidebarOpen]);

    const workflowsScene = useMemo(() => (
        <WorkflowsTabWithNavigator
            refreshCount={refreshCount}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            onEditNode={setEditingNode}
        />
    ), [refreshCount, isSidebarOpen, setIsSidebarOpen, setEditingNode]);

    const usersScene = useMemo(() => (
        <UserManagement onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    const schemasScene = useMemo(() => (
        <SchemaManagement onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    const reportsScene = useMemo(() => (
        <ReportManagement onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    const agentHintsScene = useMemo(() => (
        <AgentHintManagement onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    const credentialsScene = useMemo(() => (
        <CredentialManagement onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    const aiTasksScene = useMemo(() => (
        <AITaskManagement activeClientId={null} onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
    ), [toggleSidebar, isSidebarOpen]);

    return (
        <div className="flex h-screen bg-surface-900 text-[var(--text-main)] font-sans overflow-hidden">
            <AppSidebar
                title="Workflow Engine"
                headerIcon="bolt"
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                navItems={[
                    { id: 'users', label: 'Users', icon: 'user', isActive: activeTab === 'users', onClick: () => setActiveTab('users') },
                    { id: 'credentials', label: 'Credentials', icon: 'verified', isActive: activeTab === 'credentials', onClick: () => setActiveTab('credentials') },
                    { id: 'reports', label: 'Reports', icon: 'article', isActive: activeTab === 'reports', onClick: () => setActiveTab('reports') },
                    { id: 'schemas', label: 'Schemas', icon: 'schema', isActive: activeTab === 'schemas', onClick: () => setActiveTab('schemas') },
                    { id: 'agent-hints', label: 'Agent Hints', icon: 'lightbulb_circle', isActive: activeTab === 'agent-hints', onClick: () => setActiveTab('agent-hints') },
                    { id: 'nodes', label: 'Node Types', icon: 'function', isActive: activeTab === 'nodes', onClick: () => setActiveTab('nodes') },
                    { id: 'workflows', label: 'Workflows', icon: 'workflow', isActive: activeTab === 'workflows', onClick: () => setActiveTab('workflows') },
                ]}
            />

            <main className="flex-1 flex flex-row min-w-0 overflow-hidden bg-[var(--bg-app)]">
                <div className="flex-1 flex flex-col min-h-0 w-full relative">
                    {/* Pinned Tabs Layer */}
                    <div className={`absolute inset-0 z-10 bg-[var(--bg-app)] flex flex-col overflow-hidden ${activeTabId ? '' : 'opacity-0 invisible pointer-events-none z-[-1]'}`}>
                        <PinnedFormRouter />
                    </div>
                    
                    {/* Main Navigation Layer */}
                    <div className={`bg-[var(--bg-app)] ${activeTabId ? 'absolute inset-0 z-[-1] opacity-0 invisible pointer-events-none flex flex-col' : 'flex-1 flex flex-col min-h-0 w-full'}`}>
                        {activeTab === 'users' ? (
                            usersScene
                        ) : activeTab === 'nodes' ? (
                            <Navigator
                                key={`nodes-${resetNonce}`}
                                initialScene={nodesScene}
                            />
                        ) : activeTab === 'workflows' ? (
                            <Navigator
                                key={`workflows-${resetNonce}`}
                                initialScene={workflowsScene}
                            />
                        ) : activeTab === 'schemas' ? (
                            schemasScene
                        ) : activeTab === 'ai-tasks' ? (
                            aiTasksScene
                        ) : activeTab === 'reports' ? (
                            reportsScene
                        ) : activeTab === 'agent-hints' ? (
                            agentHintsScene
                        ) : (
                            credentialsScene
                        )}
                    </div>
                </div>
                <PinnedTabsTray />
            </main>

            {editingNodeForModal && (
                <AppCompactModalForm
                    isOpen={!!editingNodeForModal}
                    title={`Edit Node: ${editingNodeForModal.name}`}
                    icon="function"
                    onClose={() => setEditingNodeForModal(null)}
                    onSubmit={() => {
                        if (modalFormSubmitRef.current) {
                            modalFormSubmitRef.current();
                        }
                    }}
                    submitLabel="Save Changes"
                    width="max-w-[90%]"
                    fullHeight
                    noPadding
                    entityId={editingNodeForModal.id}
                    entityType="node_types"
                    initialLocked={editingNodeForModal.is_locked}
                    onLockToggle={(locked) => {
                        setEditingNodeForModal(prev => prev ? { ...prev, is_locked: locked } : prev);
                        setRefreshCount(r => r + 1);
                    }}
                >
                    <NodeTypeFormView
                        onClose={() => setEditingNodeForModal(null)}
                        editingNode={editingNodeForModal}
                        onSave={(data) => {
                            return handleNodeSave(data, data.id || editingNodeForModal.id, () => {
                                setRefreshCount(r => r + 1);
                                setEditingNodeForModal(null);
                            });
                        }}
                        onRefresh={() => setRefreshCount(r => r + 1)}
                        allNodes={allNodes}
                        defaultTab="code"
                        hideHeader={true}
                        externalSubmitRef={modalFormSubmitRef as any}
                    />
                </AppCompactModalForm>
            )}

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
