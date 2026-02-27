import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';

import { useAuthStore } from '../../features/auth/store';

import { Console } from '../../widgets/console/ui/Console';
import { WorkflowHeader } from '../../widgets/workflow-header';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../widgets/workflow-graph';
import { WorkflowDataEditorTabs } from '../../widgets/workflow-data-editor';
import { useWorkflowOperations } from '../../features/workflow-operations';
import { useWorkflowManagement } from '../../features/workflow-management';

import { Icon } from '../../shared/ui/icon';
import { ThemeToggle } from '../../shared/ui/theme-toggle/ThemeToggle';

export default function ManagerPage() {
    const { logout } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
        currentUser,
        setWorkflowToDelete,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
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

    return (
        <div className="fixed inset-0 flex bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden font-sans">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-surface-900 border-r border-[var(--border-base)] flex flex-col p-6 
                transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-lg shadow-brand/5">
                            <Icon name="bolt" size={20} className="text-brand" />
                        </div>
                        <div className="text-xl font-black tracking-tight bg-gradient-to-r from-brand to-brand/60 bg-clip-text text-transparent">
                            Clients workflows
                        </div>
                    </div>
                    <button
                        className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1">
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
                </nav>

                <div className="pt-6 border-t border-[var(--border-base)] space-y-4">
                    <div className="flex items-center gap-3 px-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand font-black text-xs border border-brand/20">
                            {currentUser?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[var(--text-main)] truncate">{currentUser?.username}</div>
                            <div className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider truncate opacity-60">{currentUser?.role}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="flex-1 px-4 py-3 rounded-2xl text-xs font-bold text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 border border-[var(--border-base)] hover:border-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                            onClick={logout}
                        >
                            <Icon name="logout" size={16} />
                            <span>Sign Out</span>
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </aside >


            <main className="flex-1 flex flex-col min-w-0 relative">
                <WorkflowHeader
                    title={activeWorkflow ? activeWorkflow.name : 'Select a workflow'}
                    activeWorkflowId={activeWorkflow?.id}
                    users={assignedUsers}
                    workflowsByOwner={workflowsByOwner}
                    isRunning={isRunning}
                    isSidebarOpen={isSidebarOpen}
                    onSelect={loadWorkflow}
                    onDelete={(wf) => setWorkflowToDelete(wf)}
                    onCreate={handleCreateWorkflow}
                    onSave={saveWorkflow}
                    onRun={() => runWorkflow(() => setIsConsoleVisible(true))}
                    onToggleSidebar={toggleSidebar}
                    canAction={!!activeWorkflow}
                    isCreating={isCreating}
                    onOpenEditModal={() => setIsEditModalOpen(true)}
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
            </main>
        </div >
    );
}

