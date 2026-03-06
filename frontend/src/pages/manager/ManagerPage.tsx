import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';



import { Console } from '../../widgets/console/ui/Console';
import { WorkflowHeader } from '../../widgets/workflow-header';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../widgets/workflow-graph';
import { WorkflowDataEditorTabs } from '../../widgets/workflow-data-editor';
import { AITaskManagement } from '../../widgets/ai-task-management/ui/AITaskManagement';
import { ClientMetadataManagement } from '../../widgets/client-metadata-management/ui/ClientMetadataManagement';
import { useWorkflowOperations } from '../../features/workflow-operations';
import { useWorkflowManagement } from '../../features/workflow-management';
import { useAuthStore } from '../../features/auth/store';

import { Icon } from '../../shared/ui/icon';
import { AppSidebar } from '../../widgets/app-sidebar';
import { AppHeader } from '../../widgets/app-header';
import { ClientSelector } from '../../features/client-selection/ui/ClientSelector';
import { useClientStore } from '../../features/workflow-management/model/clientStore';

export default function ManagerPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const [activeTab, setActiveTab] = useState<'workflows' | 'reports' | 'ai-tasks' | 'client-metadata'>('workflows');

    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');
    const [workflowToCreateOwnerId, setWorkflowToCreateOwnerId] = useState<string | null>(null);
    const [createInputValue, setCreateInputValue] = useState('');

    const EMPTY_OBJ = useRef({});

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);

    const {
        assignedUsers,
        workflowsByOwner,
        activeWorkflow,
        nodeTypes,
        isCreating,
        workflowToDelete,
        workflowToRename,
        setWorkflowToDelete,
        setWorkflowToRename,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow
    } = useWorkflowManagement();

    const {
        saveWorkflow,
        runWorkflow,
        isRunning,
        executionLogs,
        liveRuntimeData,
        activeNodeIds
    } = useWorkflowOperations({
        activeWorkflow,
        nodesRef,
        edgesRef,
        onUpdateLocalWorkflow: setActiveWorkflow,
        onExecutionComplete: () => {
            if (activeWorkflow) loadWorkflow(activeWorkflow);
        }
    });

    useEffect(() => {
        if (activeWorkflow?.graph) {
            nodesRef.current = activeWorkflow.graph.nodes || [];
            edgesRef.current = activeWorkflow.graph.edges || [];
        }
    }, [activeWorkflow?.id]);

    const handleNodesChange = useCallback((nodes: Node[]) => {
        nodesRef.current = nodes;
    }, []);

    const handleEdgesChange = useCallback((edges: Edge[]) => {
        edgesRef.current = edges;
    }, []);

    const { activeClientId } = useClientStore();

    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'admin';
    const canSave = isAdmin || activeWorkflow?.owner_id !== 'common';

    const filteredNavItems = [
        {
            id: 'workflows',
            label: 'Workflows',
            icon: 'account_tree',
            isActive: activeTab === 'workflows',
            onClick: () => setActiveTab('workflows'),
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: 'bar_chart',
            isActive: activeTab === 'reports',
            onClick: () => setActiveTab('reports'),
        },
        ...((activeClientId || isAdmin) ? [
            {
                id: 'ai-tasks',
                label: 'AI Tasks',
                icon: 'bolt',
                isActive: activeTab === 'ai-tasks',
                onClick: () => setActiveTab('ai-tasks'),
            }
        ] : []),
        ...(activeClientId ? [
            {
                id: 'client-metadata',
                label: 'Client Metadata',
                icon: 'dataset',
                isActive: activeTab === 'client-metadata',
                onClick: () => setActiveTab('client-metadata'),
            }
        ] : []),
    ];

    const filteredUsers = activeClientId
        ? assignedUsers.filter(u => u.id === activeClientId)
        : assignedUsers;

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


            <main className="flex-1 flex flex-col min-w-0 relative">
                {activeTab === 'workflows' ? (
                    <>
                        <WorkflowHeader
                            title={activeWorkflow ? activeWorkflow.name : 'Select a workflow'}
                            activeWorkflowId={activeWorkflow?.id}
                            users={filteredUsers}
                            workflowsByOwner={workflowsByOwner}
                            isRunning={isRunning}
                            isSidebarOpen={isSidebarOpen}
                            onSelect={loadWorkflow}
                            onDelete={(wf) => setWorkflowToDelete(wf)}
                            onRename={(wf) => {
                                setWorkflowToRename(wf);
                                setRenameInputValue(wf.name);
                            }}
                            onCreate={async (_name, ownerId) => {
                                setWorkflowToCreateOwnerId(ownerId);
                                setCreateInputValue('');
                            }}
                            onSave={saveWorkflow}
                            onRun={() => runWorkflow(() => setIsConsoleVisible(true), activeClientId)}
                            onToggleSidebar={toggleSidebar}
                            canAction={!!activeWorkflow}
                            isCreating={isCreating}
                            onOpenEditModal={() => setIsEditModalOpen(true)}
                            canSave={canSave}
                        />

                        {activeWorkflow && (
                            <WorkflowGraph
                                workflow={activeWorkflow}
                                nodeTypes={nodeTypes}
                                isReadOnly={false}
                                onNodesChangeCallback={handleNodesChange}
                                onEdgesChangeCallback={handleEdgesChange}
                                activeNodeIds={activeNodeIds}
                            />
                        )}

                        {isEditModalOpen && activeWorkflow && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                                <div className="relative w-full max-w-6xl h-[85vh] bg-[var(--bg-app)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-base)]">
                                    <div className="flex justify-between items-center p-4 border-b border-[var(--border-base)]">
                                        <h2 className="text-sm font-bold truncate">Edit Workflow Data</h2>
                                        <button
                                            className="p-2 hover:bg-[var(--border-base)] rounded-xl transition-colors shrink-0"
                                            onClick={() => setIsEditModalOpen(false)}
                                        >
                                            <Icon name="close" size={20} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <WorkflowDataEditorTabs
                                            key={activeWorkflow.id}
                                            data={activeWorkflow.workflow_data ?? EMPTY_OBJ.current}
                                            onChange={(d) => setActiveWorkflow({ ...activeWorkflow, workflow_data: d })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <Console
                            logs={executionLogs}
                            isVisible={isConsoleVisible}
                            onClose={() => setIsConsoleVisible(false)}
                            runtimeData={liveRuntimeData}
                        />

                        <ConfirmModal
                            isOpen={!!workflowToDelete}
                            title="Delete Workflow"
                            description={`Are you sure you want to delete "${workflowToDelete?.name}"? This action cannot be undone.`}
                            confirmLabel="Delete"
                            onConfirm={confirmDeleteWorkflow}
                            onCancel={() => setWorkflowToDelete(null)}
                        />

                        <ConfirmModal
                            isOpen={!!workflowToCreateOwnerId}
                            title="New Workflow"
                            description="Enter a name for the new workflow."
                            confirmLabel="Create"
                            variant="success"
                            onConfirm={() => {
                                if (workflowToCreateOwnerId && createInputValue.trim()) {
                                    handleCreateWorkflow(createInputValue, workflowToCreateOwnerId);
                                }
                                setWorkflowToCreateOwnerId(null);
                            }}
                            onCancel={() => setWorkflowToCreateOwnerId(null)}
                        >
                            <input
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                                placeholder="Workflow name"
                                value={createInputValue}
                                onChange={(e) => setCreateInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && workflowToCreateOwnerId && createInputValue.trim()) {
                                        handleCreateWorkflow(createInputValue, workflowToCreateOwnerId);
                                        setWorkflowToCreateOwnerId(null);
                                    }
                                }}
                            />
                        </ConfirmModal>

                        <ConfirmModal
                            isOpen={!!workflowToRename}
                            title="Rename Workflow"
                            description={`Enter a new name for "${workflowToRename?.name}".`}
                            confirmLabel="Rename"
                            variant="success"
                            onConfirm={() => {
                                if (workflowToRename) {
                                    handleRenameWorkflow(workflowToRename.id, renameInputValue);
                                }
                                setWorkflowToRename(null);
                            }}
                            onCancel={() => setWorkflowToRename(null)}
                        >
                            <input
                                autoFocus
                                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                                placeholder="Workflow name"
                                value={renameInputValue}
                                onChange={(e) => setRenameInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && workflowToRename && renameInputValue.trim()) {
                                        handleRenameWorkflow(workflowToRename.id, renameInputValue);
                                        setWorkflowToRename(null);
                                    }
                                }}
                            />
                        </ConfirmModal>
                    </>
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
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        <AppHeader
                            onToggleSidebar={toggleSidebar}
                            isSidebarOpen={isSidebarOpen}
                            leftContent={
                                <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                                    Client Metadata
                                </h1>
                            }
                        />
                        <div className="flex-1 p-8 overflow-y-auto">
                            <ClientMetadataManagement activeClientId={activeClientId} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col relative">
                        <AppHeader
                            onToggleSidebar={toggleSidebar}
                            isSidebarOpen={isSidebarOpen}
                            leftContent={
                                <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                                    Reports
                                </h1>
                            }
                        />
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-balance overflow-y-auto">
                            <div className="w-20 h-20 rounded-3xl bg-[var(--border-base)]/50 flex items-center justify-center mb-6 ring-8 ring-[var(--bg-app)]">
                                <Icon name="bar_chart" size={40} className="text-[var(--text-muted)] opacity-50" />
                            </div>
                            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">Reports Dashboard</h2>
                            <p className="text-[var(--text-muted)] max-w-md">
                                Comprehensive analytics and insights for your workflows will be available here soon.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div >
    );
}

