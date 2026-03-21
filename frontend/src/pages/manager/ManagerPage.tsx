/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';



import { AppConsole, AppConsoleLogLine } from '../../shared/ui/app-console';
import type { ConsoleLog } from '../../shared/ui/app-console';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../widgets/workflow-graph';
import { AITaskManagement } from '../../widgets/ai-task-management/ui/AITaskManagement';
import { ClientMetadataManagement } from '../../widgets/client-metadata-management/ui/ClientMetadataManagement';
import { ReportManagement } from '../../widgets/report-management';
import { useWorkflowOperations } from '../../features/workflow-operations';
import { useWorkflowManagement } from '../../features/workflow-management';
import { useAuthStore } from '../../features/auth/store';

import { Icon } from '../../shared/ui/icon';
import { AppSidebar } from '../../widgets/app-sidebar';
import { AppHeader } from '../../widgets/app-header';
import { AppLockToggle } from '../../shared/ui/app-lock-toggle';
import { ClientSelector } from '../../features/client-selection/ui/ClientSelector';
import { useClientStore } from '../../features/workflow-management/model/clientStore';
import { WorkflowList } from '../../widgets/workflow-list';
import { Navigator, useNavigator } from '../../shared/ui/navigator';
import { NodeEditorView } from '../../widgets/node-editor-view';
import { PromptViewer } from '../../widgets/prompt-viewer/ui/PromptViewer';
import { NodeTypeFormView } from '../../widgets/node-type-form-modal';
import { AppCompactModalForm } from '../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppCategoryInput } from '../../shared/ui/app-category-input/AppCategoryInput';
import { AppInput } from '../../shared/ui/app-input';
import { getUniqueCategoryPaths } from '../../shared/lib/categoryUtils';
import { useNavigationIntercept } from '../../shared/lib/navigation-guard/useNavigationGuard';
import { useHotkeys } from '../../shared/lib/hotkeys/useHotkeys';

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
    isConsoleVisible,
    setIsConsoleVisible,
    executionLogs,
    liveRuntimeData,
    handleNodesChange,
    handleEdgesChange,
    nodesRef,
    edgesRef,
    onBack,
    notifyChange,
    isAdmin,
    setWorkflows
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
    isAdmin?: boolean;
    setWorkflows: any;
}) => {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [showSystemLogs, setShowSystemLogs] = useState(false);
    const [activeConsoleTab, setActiveConsoleTab] = useState<'logs' | 'runtime'>('logs');
    const [consoleHeight, setConsoleHeight] = useState(280);
    const nav = useNavigator();

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        console.log('[WorkflowEditorView] handleParamsChange for nodeId:', nodeId, 'new params:', params);
        // Update nodes in nodesRef.current to preserve added nodes and positions
        const currentNodes = nodesRef.current || [];
        const updatedNodes = currentNodes.map((n: any) =>
            n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
        );
        nodesRef.current = updatedNodes;

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
        notifyChange?.();
    }, [setActiveWorkflow, setSelectedNode, notifyChange, selectedNode?.id, nodesRef, edgesRef]);

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

    const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
        console.log('[WorkflowEditorView] handleNodeDoubleClick ENTER', node.id, node.data);
        if (!nodeTypes || nodeTypes.length === 0) {
            console.warn('[WorkflowEditorView] No nodeTypes available for double-click lookup');
            return;
        }
        event.preventDefault();
        event.stopPropagation();

        const nodeLabel = node.data?.label || '';
        const nodeTypeId = node.data?.nodeTypeId;
        const nodeTypeRef = node.data?.nodeType;

        const ntDef = nodeTypes.find((t: any) =>
            (nodeTypeId && t.id === nodeTypeId) ||
            t.name.toLowerCase() === (nodeTypeRef || nodeLabel).toLowerCase()
        );

        console.log('[WorkflowEditorView] Double-click lookup result:', ntDef?.name || 'NOT FOUND', 'for label:', nodeLabel);

        if (ntDef) {
            console.log('[WorkflowEditorView] Opening technical editor for:', ntDef.name);
            nav.push(
                <NodeTypeFormView
                    onClose={() => nav.pop()}
                    editingNode={ntDef}
                    onSave={async (_data: any) => {
                        console.log('[WorkflowEditorView] Technical editor save requested (read-only for manager)');
                    }}
                    allNodes={nodeTypes}
                    defaultTab="code"
                />
            );
        }
    }, [nodeTypes, nav]);

    useHotkeys([
        { key: 'cmd+s', description: 'Save Workflow', handler: () => { if (canSave) saveWorkflow(); } },
        { key: 'ctrl+s', description: 'Save Workflow', handler: () => { if (canSave) saveWorkflow(); } },
        { key: 'f5', description: 'Run Workflow', handler: (e) => { e.preventDefault(); if (!isRunning) runWorkflow(() => setIsConsoleVisible(true), activeClientId); } },
        { 
            key: 'f2', 
            description: 'Edit Node', 
            enabled: nodesRef.current.some(n => n.selected),
            handler: (e) => {
                e.preventDefault();
                const flowSelectedNode = nodesRef.current.find(n => n.selected);
                if (flowSelectedNode) {
                    handleNodeDoubleClick(e as unknown as React.MouseEvent, flowSelectedNode);
                }
            } 
        }
    ], { 
        scopeName: 'Workflow Editor',
        enabled: !isCreating
    });

    const isDirty = (notifyChange as any)?.isDirty || false;

    return (
        <div className="flex-1 flex flex-col min-h-0 w-full h-full relative">
            <AppHeader
                onBack={onBack}
                onToggleSidebar={() => { }} // not needed when back button is present, but required by prop type
                isSidebarOpen={false}
                isDirty={isDirty}
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
                        {isAdmin && activeWorkflow && (
                            <AppLockToggle 
                                entityId={activeWorkflow.id}
                                entityType="workflows"
                                initialLocked={activeWorkflow.is_locked}
                                onToggle={(locked) => {
                                    setActiveWorkflow({ ...activeWorkflow, is_locked: locked });
                                    setWorkflows((prev: any[]) => prev.map(wf => wf.id === activeWorkflow.id ? { ...wf, is_locked: locked } : wf));
                                }}
                                className="mr-1"
                            />
                        )}
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
                                title="Save Workflow"
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
                    <div className="flex-1 flex flex-col relative">
                        {activeWorkflow && (
                            <WorkflowGraph
                                workflow={activeWorkflow}
                                nodeTypes={nodeTypes}
                                isReadOnly={activeWorkflow?.is_locked || false}
                                onNodesChangeCallback={(nodes) => {
                                    handleNodesChange(nodes);
                                    
                                    // Sync to parent state preserving parameters from the parent state
                                    setActiveWorkflow((prev: any) => {
                                        if (!prev) {
                                            console.log('[WorkflowEditorView] onNodesChange: prev is null, returning null.');
                                            return prev;
                                        }
                                        
                                        // Merge graph nodes (positions, etc) with existing parameters from parent state
                                        const mergedNodes = nodes.map((gn: any) => {
                                            const existing = prev.graph?.nodes?.find((en: any) => en.id === gn.id);
                                            const finalParams = existing?.data?.params || gn.data?.params || {};
                                            return {
                                                ...gn,
                                                data: {
                                                    ...gn.data,
                                                    params: finalParams
                                                }
                                            };
                                        });

                                        console.log('[WorkflowEditorView] onNodesChange (graph move) Merging nodes. Preserving params from state if they exist.');
                                        
                                        // Update the ref so save uses merged data
                                        nodesRef.current = mergedNodes;

                                        return {
                                            ...prev,
                                            graph: {
                                                ...prev.graph,
                                                nodes: mergedNodes
                                            }
                                        };
                                    });
                                    notifyChange?.();
                                }}
                                onEdgesChangeCallback={(edges) => {
                                    handleEdgesChange(edges);

                                    // Sync to parent state
                                    setActiveWorkflow((prev: any) => {
                                        if (!prev) return prev;
                                        return {
                                            ...prev,
                                            graph: {
                                                ...prev.graph,
                                                edges: edges
                                            }
                                        };
                                    });

                                    notifyChange?.();
                                }}
                                onNodeDoubleClickCallback={handleNodeDoubleClick}
                                onNodeSelectCallback={handleNodeSelect}
                                activeNodeIds={activeNodeIds}
                            />
                        )}
                    </div>

                    {selectedNode && (
                        <div className="w-[400px] border-l border-[var(--border-base)] bg-[var(--bg-app)] shadow-2xl z-20 animate-in slide-in-from-right duration-300">
                            <NodeEditorView
                                key={selectedNode.id}
                                inline
                                node={selectedNode}
                                nodeTypes={nodeTypes}
                                onChange={handleParamsChange}
                                onBack={() => setSelectedNode(null)}
                            />
                        </div>
                    )}
                </div>

                <AppConsole
                    tabs={[
                        { id: 'logs', label: 'Debug Console' },
                        { id: 'runtime', label: 'Runtime Data' }
                    ]}
                    activeTab={activeConsoleTab}
                    onTabChange={(id) => setActiveConsoleTab(id as any)}
                    isVisible={isConsoleVisible}
                    onClose={() => setIsConsoleVisible(false)}
                    resizable
                    height={consoleHeight}
                    onHeightChange={setConsoleHeight}
                    headerActions={
                        <div className="flex items-center gap-2">
                            {activeConsoleTab === 'logs' && (
                                <button
                                    onClick={() => setShowSystemLogs(!showSystemLogs)}
                                    title={showSystemLogs ? "Hide system messages" : "Show system messages"}
                                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest leading-none px-2 py-1.5 rounded-lg transition-colors ${showSystemLogs
                                        ? 'bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--border-base)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)]'
                                        }`}
                                >
                                    <Icon name={showSystemLogs ? "visibility" : "visibility_off"} size={14} />
                                    <span>Sys Logs</span>
                                </button>
                            )}
                        </div>
                    }
                >
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar min-h-0 h-full">
                        {activeConsoleTab === 'logs' ? (
                            <div className="space-y-1">
                                {executionLogs
                                    .filter(log => showSystemLogs || log.level !== 'system')
                                    .map((log, i) => (
                                        <AppConsoleLogLine key={i} log={log as ConsoleLog} />
                                    ))}
                                {executionLogs.length === 0 && (
                                    <div className="text-[var(--text-muted)] italic text-sm py-4">
                                        {'>'} Waiting for workflow execution logs...
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full">
                                {!liveRuntimeData || Object.keys(liveRuntimeData).length === 0 ? (
                                    <div className="text-[var(--text-muted)] italic text-sm py-4">
                                        {'>'} Runtime data is empty. Run the workflow to see live data here.
                                    </div>
                                ) : (
                                    <pre className="text-[var(--text-main)] text-xs leading-relaxed whitespace-pre-wrap break-all font-mono">
                                        {JSON.stringify(liveRuntimeData, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </AppConsole>
            </div>
        </div>
    );
};

const WorkflowsTabWithNavigator = ({
    workflows,
    activeWorkflow,
    nodeTypes,
    isCreating,
    setWorkflowToDelete,
    setWorkflowToRename,
    loadWorkflow,
    handleCreateWorkflow,
    handleDuplicateWorkflow,
    setActiveWorkflow,
    saveWorkflow,
    runWorkflow,
    isRunning,
    activeNodeIds,
    isSidebarOpen,
    toggleSidebar,
    activeClientId,
    canSave,
    isConsoleVisible,
    setIsConsoleVisible,
    executionLogs,
    liveRuntimeData,
    setRenameInputValue,
    setRenameCategoryValue,
    handleNodesChange,
    handleEdgesChange,
    nodesRef,
    edgesRef,
    handleIntercept,
    notifyChange,
    isAdmin,
    setWorkflows
}: any) => {
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
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    isAdmin={isAdmin}
                    setWorkflows={setWorkflows}
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
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    isAdmin={isAdmin}
                    setWorkflows={setWorkflows}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
    }, [nodeTypes, isCreating, setActiveWorkflow, saveWorkflow, runWorkflow, isRunning, activeNodeIds, activeClientId, canSave, setIsConsoleVisible, handleNodesChange, handleEdgesChange, nodesRef, edgesRef, loadWorkflow, nav, notifyChange, isAdmin, setWorkflows]);

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

    // Only replace scene if we are in the editor and graph JUST arrived
    const hasGraph = !!activeWorkflow?.graph;

    useEffect(() => {
        if (hasGraph && nav.canGoBack) {
            console.log('[WorkflowsTab] Refreshing editor scene for:', activeWorkflow?.id);
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
                    isConsoleVisible={isConsoleVisible}
                    setIsConsoleVisible={setIsConsoleVisible}
                    executionLogs={executionLogs}
                    liveRuntimeData={liveRuntimeData}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    nodesRef={nodesRef}
                    edgesRef={edgesRef}
                    notifyChange={notifyChange}
                    isAdmin={isAdmin}
                    setWorkflows={setWorkflows}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
    }, [activeWorkflow?.id, activeWorkflow, isRunning, isCreating, nodeTypes, activeNodeIds, activeClientId, canSave, nav, notifyChange, isAdmin, setWorkflows]);


    return (
        <WorkflowList
            workflows={workflows}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            onSelectWorkflow={handleSelectWorkflow}
            onCreateWorkflow={(name, category) => {
                handleCreateWorkflow(name, category).then((newWf: any) => {
                    if (newWf) handleSelectWorkflow(newWf);
                });
            }}
            onDeleteWorkflow={setWorkflowToDelete}
            onRenameWorkflow={(wf) => {
                setWorkflowToRename(wf);
                setRenameInputValue(wf.name);
                setRenameCategoryValue(wf.category || 'personal');
            }}
            onDuplicateWorkflow={(wf) => handleDuplicateWorkflow(wf.id)}
        />
    );
};


export default function ManagerPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const [activeTab, setActiveTabState] = useState<'workflows' | 'reports' | 'ai-tasks' | 'client-metadata' | 'prompts'>('workflows');
    const [resetNonce, setResetNonce] = useState(0);
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');
    const [renameCategoryValue, setRenameCategoryValue] = useState<string>('personal');

    const {
        workflows,
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
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow,
        setWorkflows
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

    const setActiveTab = useCallback((tab: 'workflows' | 'reports' | 'ai-tasks' | 'client-metadata' | 'prompts') => {
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


            <main className="flex-1 flex flex-col min-h-0 min-w-0 relative">
                {activeTab === 'workflows' ? (
                    <>
                        <Navigator
                            key={`workflows-${resetNonce}`}
                            initialScene={
                                <WorkflowsTabWithNavigator
                                    workflows={workflows}
                                    activeWorkflow={activeWorkflow}
                                    nodeTypes={nodeTypes}
                                    isCreating={isCreating}
                                    setWorkflowToDelete={setWorkflowToDelete}
                                    setWorkflowToRename={setWorkflowToRename}
                                    loadWorkflow={loadWorkflow}
                                    handleCreateWorkflow={handleCreateWorkflow}
                                    handleDuplicateWorkflow={handleDuplicateWorkflow}
                                    setActiveWorkflow={setActiveWorkflow}
                                    saveWorkflow={saveWorkflow}
                                    runWorkflow={runWorkflow}
                                    isRunning={isRunning}
                                    activeNodeIds={activeNodeIds}
                                    isSidebarOpen={isSidebarOpen}
                                    toggleSidebar={toggleSidebar}
                                    activeClientId={activeClientId}
                                    canSave={canSave}
                                    isConsoleVisible={isConsoleVisible}
                                    setIsConsoleVisible={setIsConsoleVisible}
                                    executionLogs={executionLogs}
                                    liveRuntimeData={liveRuntimeData}
                                    setRenameInputValue={setRenameInputValue}
                                    setRenameCategoryValue={setRenameCategoryValue}
                                    handleNodesChange={handleNodesChange}
                                    handleEdgesChange={handleEdgesChange}
                                    nodesRef={nodesRef}
                                    edgesRef={edgesRef}
                                    handleIntercept={handleIntercept}
                                    notifyChange={notifyChange}
                                    isAdmin={isAdmin}
                                    setWorkflows={setWorkflows}
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



                        {(() => {
                            // Local useMemo-like logic for categories within the scene
                            const allCategoryPaths = getUniqueCategoryPaths(workflows);
                            return (
                                <AppCompactModalForm
                                    isOpen={!!workflowToRename}
                                    title="Rename Workflow"
                                    submitLabel="Update"
                                    onClose={() => setWorkflowToRename(null)}
                                    onSubmit={() => {
                                        if (workflowToRename) {
                                            handleRenameWorkflow(workflowToRename.id, renameInputValue, renameCategoryValue);
                                        }
                                        setWorkflowToRename(null);
                                    }}
                                >
                                    <div className="flex flex-col gap-4">
                                        <p className="text-sm text-[var(--text-muted)] mt-1 mb-2">
                                            Update properties for <span className="font-bold text-[var(--text-main)] italic">"{workflowToRename?.name}"</span>.
                                        </p>
                                        <AppInput
                                            label="Name"
                                            autoFocus
                                            placeholder="Workflow name"
                                            value={renameInputValue}
                                            onChange={setRenameInputValue}
                                        />
                                        {isAdmin && (
                                            <AppCategoryInput
                                                label="Category"
                                                placeholder="e.g. personal, common, analysis"
                                                value={renameCategoryValue}
                                                onChange={setRenameCategoryValue}
                                                allPaths={allCategoryPaths}
                                            />
                                        )}
                                    </div>
                                </AppCompactModalForm>
                            );
                        })()}
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
                ) : activeTab === 'prompts' ? (
                    <div className="flex-1 h-full min-h-0 flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <PromptViewer referenceId={activeClientId || undefined} />
                    </div>
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

