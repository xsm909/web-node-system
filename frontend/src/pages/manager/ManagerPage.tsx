/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';



import { Console } from '../../widgets/console/ui/Console';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../widgets/workflow-graph';
import { WorkflowDataEditorTabs } from '../../widgets/workflow-data-editor';
import { AITaskManagement } from '../../widgets/ai-task-management/ui/AITaskManagement';
import { ClientMetadataManagement } from '../../widgets/client-metadata-management/ui/ClientMetadataManagement';
import { ReportManagement } from '../../widgets/report-management';
import { useWorkflowOperations } from '../../features/workflow-operations';
import { useWorkflowManagement } from '../../features/workflow-management';
import { useAuthStore } from '../../features/auth/store';

import { Icon } from '../../shared/ui/icon';
import { AppSidebar } from '../../widgets/app-sidebar';
import { AppHeader } from '../../widgets/app-header';
import { ClientSelector } from '../../features/client-selection/ui/ClientSelector';
import { useClientStore } from '../../features/workflow-management/model/clientStore';
import { WorkflowList } from '../../widgets/workflow-list';
import { Navigator, useNavigator } from '../../shared/ui/navigator';
import { NodeEditorView } from '../../widgets/node-editor-view';

import { useNavigationIntercept } from '../../shared/lib/navigation-guard/useNavigationGuard';

const EMPTY_OBJ = {};

const WorkflowEditorView = ({
    activeWorkflow,
    nodeTypes,
    isCreating,
    setActiveWorkflow,
    saveWorkflow,
    runWorkflow,
    isRunning,
    activeNodeIds,
    activeClientId,
    canSave,
    isEditModalOpen,
    setIsEditModalOpen,
    isConsoleVisible,
    setIsConsoleVisible,
    executionLogs,
    liveRuntimeData,
    handleNodesChange,
    handleEdgesChange,
    nodesRef,
    edgesRef,
    onBack,
    notifyChange
}: {
    activeWorkflow: any;
    nodeTypes: any;
    isCreating: boolean;
    setActiveWorkflow: any;
    saveWorkflow: any;
    runWorkflow: any;
    isRunning: boolean;
    activeNodeIds: any;
    activeClientId: any;
    canSave: boolean;
    isEditModalOpen: boolean;
    setIsEditModalOpen: any;
    isConsoleVisible: boolean;
    setIsConsoleVisible: any;
    executionLogs: any[];
    liveRuntimeData: any;
    handleNodesChange: any;
    handleEdgesChange: any;
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
    onBack: any;
    notifyChange?: () => void;
}) => {
    console.log('[WorkflowEditorView] Rendering for workflow:', activeWorkflow?.id, 'hasGraph:', !!activeWorkflow?.graph);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        // Update nodes in nodesRef.current to preserve added nodes and positions
        const currentNodes = nodesRef.current || [];
        const updatedNodes = currentNodes.map((n: any) =>
            n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
        );

        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return { 
                ...prev, 
                graph: { 
                    ...prev.graph, 
                    nodes: updatedNodes,
                    edges: edgesRef.current || prev.graph?.edges || []
                } 
            };
        });

        // Also update local selectedNode to reflect changes if it's the same node
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev: any) => prev ? { ...prev, data: { ...prev.data, params } } : prev);
        }
    }, [setActiveWorkflow, selectedNode?.id]);

    const handleNodeSelect = useCallback((node: Node | null) => {
        if (!node || !nodeTypes) {
            setSelectedNode(null);
            return;
        }
        const ntDef = nodeTypes.find((t: any) =>
            (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) ||
            t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase()
        );
        if (!ntDef || !ntDef.parameters?.length) {
            setSelectedNode(null);
            return;
        }
        setSelectedNode(node);
    }, [nodeTypes]);

    return (
        <div className="flex-1 flex flex-col min-h-0 w-full h-full relative">
            <AppHeader
                onBack={onBack}
                onToggleSidebar={() => { }} // not needed when back button is present, but required by prop type
                isSidebarOpen={false}
                leftContent={
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                            {activeWorkflow?.name}
                        </h1>
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-surface-700 text-[var(--text-main)] opacity-70 border border-[var(--border-base)]">
                            {activeWorkflow?.owner_id === 'common' ? 'Common' : (activeWorkflow?.owner_id === 'personal' ? 'My Workflow' : 'Client Workflow')}
                        </span>
                    </div>
                }
                rightContent={
                    <div className="flex items-center gap-2">
                        <button
                            className="p-2.5 rounded-xl hover:bg-surface-700 text-gray-400 hover:text-white transition-colors border border-transparent hover:border-[var(--border-base)] group"
                            onClick={() => setIsEditModalOpen(true)}
                            title="Edit Workflow Data"
                        >
                            <Icon name="data_object" size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                            onClick={() => runWorkflow(() => setIsConsoleVisible(true), activeClientId)}
                            disabled={isRunning}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 border
                                ${isRunning
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                    : 'bg-emerald-500 text-white border-transparent hover:brightness-110 hover:shadow-emerald-500/20'
                                }
                            `}
                        >
                            <Icon name={isRunning ? "stop" : "play_arrow"} size={20} className={isRunning ? "animate-pulse" : ""} />
                            <span>{isRunning ? 'Running...' : 'Play'}</span>
                        </button>
                        {canSave && (
                            <button
                                onClick={saveWorkflow}
                                disabled={isCreating}
                                className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded-xl hover:brightness-110 transition-all font-bold shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50 border border-transparent"
                            >
                                <Icon name={isCreating ? "refresh" : "save"} size={20} className={isCreating ? "animate-spin" : ""} />
                                <span>Save</span>
                            </button>
                        )}
                    </div>
                }
            />
            
            <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="flex-1 flex min-h-0 relative">
                    <div className="flex-1 relative">
                        {activeWorkflow && (
                            <WorkflowGraph
                                workflow={activeWorkflow}
                                nodeTypes={nodeTypes}
                                isReadOnly={false}
                                onNodesChangeCallback={(nodes) => {
                                    handleNodesChange(nodes);
                                    notifyChange?.();
                                }}
                                onEdgesChangeCallback={(edges) => {
                                    handleEdgesChange(edges);
                                    notifyChange?.();
                                }}
                                onNodeSelectCallback={handleNodeSelect}
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
                                            data={activeWorkflow.workflow_data ?? EMPTY_OBJ}
                                            onChange={(d: any) => setActiveWorkflow({ ...activeWorkflow, workflow_data: d })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedNode && (
                        <div className="w-[400px] border-l border-[var(--border-base)] bg-[var(--bg-app)] shadow-2xl z-20 animate-in slide-in-from-right duration-300">
                            <NodeEditorView
                                inline
                                node={selectedNode}
                                nodeTypes={nodeTypes}
                                onChange={handleParamsChange}
                                onClose={() => setSelectedNode(null)}
                                onBack={() => setSelectedNode(null)}
                            />
                        </div>
                    )}
                </div>

                <Console
                    logs={executionLogs}
                    isVisible={isConsoleVisible}
                    onClose={() => setIsConsoleVisible(false)}
                    runtimeData={liveRuntimeData}
                />
            </div>
        </div>
    );
};

const WorkflowsTabWithNavigator = ({
    workflowsByOwner,
    activeWorkflow,
    nodeTypes,
    isCreating,
    setWorkflowToDelete,
    setWorkflowToRename,
    loadWorkflow,
    handleCreateWorkflow,
    setActiveWorkflow,
    saveWorkflow,
    runWorkflow,
    isRunning,
    activeNodeIds,
    isSidebarOpen,
    toggleSidebar,
    activeClientId,
    canSave,
    isEditModalOpen,
    setIsEditModalOpen,
    isConsoleVisible,
    setIsConsoleVisible,
    executionLogs,
    liveRuntimeData,
    setRenameInputValue,
    handleNodesChange,
    handleEdgesChange,
    nodesRef,
    edgesRef,
    handleIntercept,
    notifyChange
}: {
    workflowsByOwner: any;
    activeWorkflow: any;
    nodeTypes: any;
    isCreating: boolean;
    setWorkflowToDelete: any;
    setWorkflowToRename: any;
    loadWorkflow: any;
    handleCreateWorkflow: any;
    setActiveWorkflow: any;
    saveWorkflow: any;
    runWorkflow: any;
    isRunning: boolean;
    activeNodeIds: any;
    isSidebarOpen: boolean;
    toggleSidebar: any;
    activeClientId: any;
    canSave: boolean;
    isEditModalOpen: boolean;
    setIsEditModalOpen: any;
    isConsoleVisible: boolean;
    setIsConsoleVisible: any;
    executionLogs: any[];
    liveRuntimeData: any;
    setRenameInputValue: any;
    handleNodesChange: any;
    handleEdgesChange: any;
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
    handleIntercept: (p: () => void) => void;
    notifyChange: () => void;
}) => {
    const nav = useNavigator();

    const handleSelectWorkflowActual = useCallback(async (wf: any) => {
        // If it's already full data (e.g. from a fresh create), we can push directly
        // Otherwise, it's just metadata from the list
        const isFullData = !!wf.graph;
        
        if (!isFullData) {
            // Push immediately with metadata to show something (could be a loading state if we adjust WorkflowEditorView)
            nav.push(
                <WorkflowEditorView
                    activeWorkflow={wf}
                    nodeTypes={nodeTypes}
                    isCreating={isCreating}
                    setActiveWorkflow={setActiveWorkflow}
                    saveWorkflow={saveWorkflow}
                    runWorkflow={runWorkflow}
                    isRunning={isRunning}
                    activeNodeIds={activeNodeIds}
                    activeClientId={activeClientId}
                    canSave={canSave}
                    isEditModalOpen={isEditModalOpen}
                    setIsEditModalOpen={setIsEditModalOpen}
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
            
            try {
                // Now load full data. The useEffect below will handle the nav.replace when activeWorkflow updates.
                await loadWorkflow(wf);
            } catch (err) {
                // If failed, pop back
                nav.pop();
                setActiveWorkflow(null);
            }
        } else {
            // It's already full data
            setActiveWorkflow(wf);
            nav.push(
                <WorkflowEditorView
                    activeWorkflow={wf}
                    nodeTypes={nodeTypes}
                    isCreating={isCreating}
                    setActiveWorkflow={setActiveWorkflow}
                    saveWorkflow={saveWorkflow}
                    runWorkflow={runWorkflow}
                    isRunning={isRunning}
                    activeNodeIds={activeNodeIds}
                    activeClientId={activeClientId}
                    canSave={canSave}
                    isEditModalOpen={isEditModalOpen}
                    setIsEditModalOpen={setIsEditModalOpen}
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
    }, [nodeTypes, isCreating, setActiveWorkflow, saveWorkflow, runWorkflow, isRunning, activeNodeIds, activeClientId, canSave, isEditModalOpen, setIsEditModalOpen, setIsConsoleVisible, handleNodesChange, handleEdgesChange, nodesRef, edgesRef, loadWorkflow, nav, notifyChange]);

    const handleSelectWorkflow = useCallback((wf: any) => {
        handleIntercept(() => handleSelectWorkflowActual(wf));
    }, [handleIntercept, handleSelectWorkflowActual]);

    // Only auto-navigate if on initial scene and activeWorkflow IS ALREADY LOADED with graph
    // (This helps with refresh/deep linking)
    useEffect(() => {
        if (activeWorkflow?.graph && !nav.canGoBack) {
            console.log('[WorkflowsTab] Auto-opening existing workflow:', activeWorkflow.id);
            handleSelectWorkflow(activeWorkflow);
        }
    }, [activeWorkflow?.id, activeWorkflow?.graph, nav.canGoBack, handleSelectWorkflow]);

    useEffect(() => {
        // If the workflow data arrived while we are looking at its metadata editor, replace it
        if (activeWorkflow?.graph && nav.canGoBack) {
            console.log('[WorkflowsTab] Data arrived, replacing scene for:', activeWorkflow.id);
            nav.replace(
                <WorkflowEditorView
                    activeWorkflow={activeWorkflow}
                    nodeTypes={nodeTypes}
                    isCreating={isCreating}
                    setActiveWorkflow={setActiveWorkflow}
                    saveWorkflow={saveWorkflow}
                    runWorkflow={runWorkflow}
                    isRunning={isRunning}
                    activeNodeIds={activeNodeIds}
                    activeClientId={activeClientId}
                    canSave={canSave}
                    isEditModalOpen={isEditModalOpen}
                    setIsEditModalOpen={setIsEditModalOpen}
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkflow?.id, !!activeWorkflow?.graph, isRunning, isCreating, isEditModalOpen, nodeTypes, activeNodeIds, activeClientId, canSave, nav.canGoBack, notifyChange]);


    return (
        <WorkflowList
            workflowsByOwner={workflowsByOwner}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            onSelectWorkflow={handleSelectWorkflow}
            onCreateWorkflow={(name, ownerId) => {
                handleCreateWorkflow(name, ownerId).then((newWf: any) => {
                    if (newWf) handleSelectWorkflow(newWf);
                });
            }}
            onDeleteWorkflow={setWorkflowToDelete}
            onRenameWorkflow={(wf) => {
                setWorkflowToRename(wf);
                setRenameInputValue(wf.name);
            }}
        />
    );
};


export default function ManagerPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const [activeTab, setActiveTabState] = useState<'workflows' | 'reports' | 'ai-tasks' | 'client-metadata'>('workflows');
    const [resetNonce, setResetNonce] = useState(0);
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');

    const {
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

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);

    const {
        saveWorkflow,
        runWorkflow,
        isRunning,
        executionLogs,
        liveRuntimeData,
        activeNodeIds,
        notifyChange
    } = useWorkflowOperations({
        activeWorkflow,
        nodesRef,
        edgesRef,
        onUpdateLocalWorkflow: setActiveWorkflow,
        onExecutionComplete: () => {
            if (activeWorkflow) loadWorkflow(activeWorkflow);
        }
    });

    const {
        isIntercepted,
        handleIntercept,
        confirmSave,
        confirmDiscard,
        cancel,
        isSaving: isInterceptSaving
    } = useNavigationIntercept();

    const setActiveTab = useCallback((tab: 'workflows' | 'reports' | 'ai-tasks' | 'client-metadata') => {
        handleIntercept(() => {
            // If switching TO workflows, or clicking Workflows again, clear selection to show list
            if (tab === 'workflows') {
                console.log('[ManagerPage] Explicit sidebar click. Clearing active workflow.');
                setActiveWorkflow(null);
                // Force reset of the navigator state
                setResetNonce(n => n + 1);
            }
            setActiveTabState(tab);
        });
    }, [setActiveWorkflow, handleIntercept]);

    useEffect(() => {
        if (activeWorkflow?.graph) {
            nodesRef.current = activeWorkflow.graph.nodes || [];
            edgesRef.current = activeWorkflow.graph.edges || [];
        }
    }, [activeWorkflow?.id, activeWorkflow?.graph]);

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
            icon: 'conversion',
            isActive: activeTab === 'workflows',
            onClick: () => setActiveTab('workflows'),
        },
        {
            id: 'reports',
            label: 'Reports',
            icon: 'docs',
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
                icon: 'info',
                isActive: activeTab === 'client-metadata',
                onClick: () => setActiveTab('client-metadata'),
            }
        ] : []),
    ];

    // No more filteredUsers

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
                        <Navigator
                            key={`workflows-${resetNonce}`}
                            initialScene={
                                <WorkflowsTabWithNavigator
                                    workflowsByOwner={workflowsByOwner}
                                    activeWorkflow={activeWorkflow}
                                    nodeTypes={nodeTypes}
                                    isCreating={isCreating}
                                    setWorkflowToDelete={setWorkflowToDelete}
                                    setWorkflowToRename={setWorkflowToRename}
                                    loadWorkflow={loadWorkflow}
                                    handleCreateWorkflow={handleCreateWorkflow}
                                    setActiveWorkflow={setActiveWorkflow}
                                    saveWorkflow={saveWorkflow}
                                    runWorkflow={runWorkflow}
                                    isRunning={isRunning}
                                    activeNodeIds={activeNodeIds}
                                    isSidebarOpen={isSidebarOpen}
                                    toggleSidebar={toggleSidebar}
                                    activeClientId={activeClientId}
                                    canSave={canSave}
                                    isEditModalOpen={isEditModalOpen}
                                    setIsEditModalOpen={setIsEditModalOpen}
                                    isConsoleVisible={isConsoleVisible}
                                    setIsConsoleVisible={setIsConsoleVisible}
                                    executionLogs={executionLogs}
                                    liveRuntimeData={liveRuntimeData}
                                    setRenameInputValue={setRenameInputValue}
                                    handleNodesChange={handleNodesChange}
                                    handleEdgesChange={handleEdgesChange}
                                    nodesRef={nodesRef}
                                    edgesRef={edgesRef}
                                    handleIntercept={handleIntercept}
                                    notifyChange={notifyChange}
                                />
                            }
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
                    <ClientMetadataManagement
                        activeClientId={activeClientId}
                        onToggleSidebar={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                    />
                ) : (
                    <ReportManagement
                        onToggleSidebar={toggleSidebar}
                        isSidebarOpen={isSidebarOpen}
                    />
                )}
            </main>

            <ConfirmModal
                isOpen={isIntercepted}
                title="Unsaved Changes"
                description="You have unsaved changes. Would you like to save them before switching?"
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
        </div >
    );
}

