import { useState, useCallback, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import { type Node, type Edge, ReactFlowProvider } from 'reactflow';
import { Console } from '../../console/ui/Console';
import { WorkflowDataEditorTabs } from '../../workflow-data-editor';
import { WorkflowList } from '../../workflow-list';
import { Navigator, useNavigator } from '../../../shared/ui/navigator';
import { useWorkflowOperations } from '../../../features/workflow-operations';
import { useWorkflowManagement } from '../../../features/workflow-management';
import { Icon } from '../../../shared/ui/icon';
import { apiClient } from '../../../shared/api/client';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../workflow-graph';
import { NodeEditorView } from '../../node-editor-view';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppParametersView } from '../../../shared/ui/app-parameters-view/AppParametersView';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Context Definition ---
interface WorkflowEditorContextType {
    workflows: any[];
    activeWorkflow: any | null;
    nodeTypes: NodeType[];
    isRunning: boolean;
    isSaving: boolean;
    isDirty: boolean;
    executionLogs: any[];
    liveRuntimeData: Record<string, any>;
    activeNodeIds: string[];
    activeClientId: string | null;
    
    // Operations
    loadWorkflow: (wf: any) => void;
    setActiveWorkflow: (wf: any) => void;
    handleCreateWorkflow: (name: string, category: string) => Promise<any>;
    confirmDeleteWorkflow: () => void;
    handleDuplicateWorkflow: (id: string) => void;
    handleRenameWorkflow: (id: string, name: string, category: string) => void;
    saveWorkflow: () => Promise<void>;
    runWorkflow: (onConsoleOpen: () => void, clientId?: string | null) => void;
    notifyChange: () => void;
    
    // UI State
    isEditModalOpen: boolean;
    setIsEditModalOpen: (v: boolean) => void;
    isConsoleVisible: boolean;
    setIsConsoleVisible: (v: boolean) => void;
    workflowToDelete: any | null;
    setWorkflowToDelete: (wf: any) => void;
    workflowToRename: any | null;
    setWorkflowToRename: (wf: any) => void;
    renameInputValue: string;
    setRenameInputValue: (v: string) => void;
    renameCategoryValue: string;
    setRenameCategoryValue: (v: string) => void;
    
    // Lower-level refs/state for graph interaction
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
    handleNodesChange: (nodes: Node[]) => void;
    handleEdgesChange: (edges: Edge[]) => void;
    onEditNode?: (event: React.MouseEvent, node: Node) => void;
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
}

const WorkflowEditorContext = createContext<WorkflowEditorContextType | null>(null);

export const useWorkflowEditor = () => {
    const ctx = useContext(WorkflowEditorContext);
    if (!ctx) throw new Error('useWorkflowEditor must be used within WorkflowEditorProvider');
    return ctx;
};

export const WorkflowEditorProvider = ({ children, onEditNode: onEditNodeProp, refreshTrigger, onToggleSidebar, isSidebarOpen }: any) => {
    const { activeClientId } = useClientStore();
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');
    const [renameCategoryValue, setRenameCategoryValue] = useState<string>('personal');

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);

    const {
        workflows,
        activeWorkflow,
        nodeTypes,
        workflowToDelete,
        workflowToRename,
        setWorkflowToDelete,
        setWorkflowToRename,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow
    } = useWorkflowManagement(refreshTrigger);

    const {
        saveWorkflow,
        runWorkflow,
        isRunning,
        isSaving,
        executionLogs,
        liveRuntimeData,
        activeNodeIds,
        notifyChange,
        isDirty
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
    }, [activeWorkflow?.id, activeWorkflow?.graph]);

    const handleNodesChange = useCallback((nodes: Node[]) => {
        nodesRef.current = nodes;
    }, []);

    const handleEdgesChange = useCallback((edges: Edge[]) => {
        edgesRef.current = edges;
    }, []);

    const handleEditNodeContext = useCallback(async (event: React.MouseEvent, node: Node) => {
        console.log('[WorkflowEditorProvider] handleEditNodeContext ENTER', node.id, node.data);
        if (!onEditNodeProp) {
            console.warn('[WorkflowEditorProvider] No onEditNodeProp provided to provider');
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        
        const nodeLabel = node.data?.label || '';
        const nodeTypeId = node.data?.nodeTypeId;
        const nodeTypeRef = node.data?.nodeType;

        const ntDef = nodeTypes.find(t =>
            (nodeTypeId && t.id === nodeTypeId) ||
            (t.name.toLowerCase() === (nodeTypeRef || nodeLabel).toLowerCase())
        );
        
        console.log('[WorkflowEditorProvider] Double-click lookup result:', ntDef?.name || 'NOT FOUND', 'for label:', nodeLabel);

        if (ntDef) {
            console.log('[WorkflowEditorProvider] Double-click detected. Opening specialized editor for:', ntDef.name);
            try {
                const { data } = await apiClient.get(`/admin/node-types/${ntDef.id}`);
                onEditNodeProp(data);
            } catch (error) {
                console.log('[WorkflowEditorProvider] Admin node-type fetch failed (likely non-admin or network), using basic definition');
                onEditNodeProp(ntDef);
            }
        }
    }, [onEditNodeProp, nodeTypes]);

    const value = useMemo(() => ({
        workflows,
        activeWorkflow,
        nodeTypes,
        isRunning,
        isSaving,
        isDirty,
        executionLogs,
        liveRuntimeData,
        activeNodeIds,
        activeClientId,
        loadWorkflow,
        setActiveWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        saveWorkflow,
        runWorkflow,
        notifyChange,
        isEditModalOpen,
        setIsEditModalOpen,
        isConsoleVisible,
        setIsConsoleVisible,
        workflowToDelete,
        setWorkflowToDelete,
        workflowToRename,
        setWorkflowToRename,
        renameInputValue,
        setRenameInputValue,
        renameCategoryValue,
        setRenameCategoryValue,
        nodesRef,
        edgesRef,
        handleNodesChange,
        handleEdgesChange,
        onEditNode: handleEditNodeContext,
        onToggleSidebar,
        isSidebarOpen
    }), [
        workflows, activeWorkflow, nodeTypes, isRunning, isSaving, isDirty, 
        executionLogs, liveRuntimeData, activeNodeIds, activeClientId,
        loadWorkflow, setActiveWorkflow, handleCreateWorkflow, confirmDeleteWorkflow,
        handleDuplicateWorkflow, handleRenameWorkflow, saveWorkflow, runWorkflow,
        notifyChange, isEditModalOpen, setIsEditModalOpen, isConsoleVisible, 
        setIsConsoleVisible, workflowToDelete, setWorkflowToDelete, 
        workflowToRename, setWorkflowToRename, renameInputValue, 
        setRenameInputValue, renameCategoryValue, setRenameCategoryValue,
        handleNodesChange, handleEdgesChange, handleEditNodeContext, onToggleSidebar, isSidebarOpen
    ]);

    return (
        <WorkflowEditorContext.Provider value={value}>
            <ReactFlowProvider>
                {children}
            </ReactFlowProvider>
        </WorkflowEditorContext.Provider>
    );
};

// --- Sub-Components ---

const EMPTY_OBJ = {};
let globalIsParamsExpanded = false;

const AdminWorkflowEditorView = ({ onBack }: { onBack: () => void }) => {
    const {
        activeWorkflow,
        nodeTypes,
        setActiveWorkflow,
        saveWorkflow,
        runWorkflow,
        isRunning,
        isSaving,
        activeNodeIds,
        activeClientId,
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
        onEditNode,
        notifyChange,
        isDirty
    } = useWorkflowEditor();

    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isParamsExpanded, setIsParamsExpanded] = useState(globalIsParamsExpanded);

    const handleToggleParams = useCallback(() => {
        setIsParamsExpanded(prev => {
            const newValue = !prev;
            globalIsParamsExpanded = newValue;
            return newValue;
        });
    }, []);

    const onNodesChange = useCallback((nodes: Node[]) => {
        handleNodesChange(nodes);
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            const mergedNodes = nodes.map((gn: any) => {
                const existing = prev.graph?.nodes?.find((en: any) => en.id === gn.id);
                const finalParams = existing?.data?.params || gn.data?.params || {};
                return { ...gn, data: { ...gn.data, params: finalParams } };
            });
            nodesRef.current = mergedNodes; 
            return { ...prev, graph: { ...prev.graph, nodes: mergedNodes } };
        });
        notifyChange?.();
    }, [handleNodesChange, setActiveWorkflow, notifyChange, nodesRef]);

    const onEdgesChange = useCallback((edges: Edge[]) => {
        handleEdgesChange(edges);
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return { ...prev, graph: { ...prev.graph, edges } };
        });
        edgesRef.current = edges;
        notifyChange?.();
    }, [handleEdgesChange, setActiveWorkflow, notifyChange, edgesRef]);

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        const currentNodes = nodesRef.current || [];
        const updatedNodes = currentNodes.map((n: any) =>
            n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
        );
        nodesRef.current = updatedNodes;
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return { ...prev, graph: { ...prev.graph, nodes: updatedNodes } };
        });
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev: any) => prev ? { ...prev, data: { ...prev.data, params } } : prev);
        }
        notifyChange?.();
    }, [setActiveWorkflow, notifyChange, selectedNode?.id, nodesRef]);

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
        <AppFormView
            title={activeWorkflow?.name || 'Workflow'}
            parentTitle="Workflows"
            icon="account_tree"
            isDirty={isDirty}
            onSave={saveWorkflow}
            onCancel={onBack}
            isSaving={isSaving}
            saveLabel="Save Workflow"
            fullHeight
            noPadding
            headerRightContent={
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
                </div>
            }
        >
            <div className="flex-1 flex flex-col min-h-0 relative">
                <style>{`
                    .workflow-editor-container .react-flow__pane { cursor: crosshair; }
                `}</style>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex-1 flex min-h-0 relative">
                        <div className="flex-1 flex flex-col relative workflow-editor-container">
                            {activeWorkflow && (
                                <WorkflowGraph
                                    workflow={activeWorkflow}
                                    nodeTypes={nodeTypes}
                                    isReadOnly={false}
                                    onNodesChangeCallback={onNodesChange}
                                    onEdgesChangeCallback={onEdgesChange}
                                    onNodeDoubleClickCallback={onEditNode}
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

                        <AppParametersView
                            title="Node Properties"
                            isExpanded={isParamsExpanded}
                            onToggle={handleToggleParams}
                            placeholder="No node selected"
                        >
                            {selectedNode && (
                                <NodeEditorView
                                    key={selectedNode.id}
                                    inline
                                    node={selectedNode}
                                    nodeTypes={nodeTypes}
                                    onChange={handleParamsChange}
                                    onBack={() => {
                                        setSelectedNode(null);
                                        setIsParamsExpanded(false);
                                    }}
                                />
                            )}
                        </AppParametersView>
                    </div>

                    <Console
                        logs={executionLogs}
                        isVisible={isConsoleVisible}
                        onClose={() => setIsConsoleVisible(false)}
                        runtimeData={liveRuntimeData}
                    />
                </div>
            </div>
        </AppFormView>
    );
};

const AdminWorkflowsTab = () => {
    const {
        workflows,
        activeWorkflow,
        handleCreateWorkflow,
        handleDuplicateWorkflow,
        setActiveWorkflow,
        setWorkflowToDelete,
        setWorkflowToRename,
        setRenameInputValue,
        setRenameCategoryValue,
        onToggleSidebar,
        isSidebarOpen,
        loadWorkflow
    } = useWorkflowEditor();
    
    const nav = useNavigator();

    const handleSelectWorkflow = useCallback((wf: any) => {
        loadWorkflow(wf);
        nav.push(
            <AdminWorkflowEditorView
                onBack={() => {
                    setActiveWorkflow(null);
                    nav.pop();
                }}
            />
        );
    }, [loadWorkflow, nav, setActiveWorkflow]);

    // Graph loading synchronization
    // Graph loading synchronization - only triggers on initial load or manual refresh
    useEffect(() => {
        if (activeWorkflow && !nav.canGoBack) {
            handleSelectWorkflow(activeWorkflow);
        }
    }, [nav.canGoBack, handleSelectWorkflow, activeWorkflow]);

    return (
        <WorkflowList
            workflows={workflows}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={onToggleSidebar}
            onSelectWorkflow={handleSelectWorkflow}
            onCreateWorkflow={(name) => {
                handleCreateWorkflow(name, 'Analys').then((newWf: any) => {
                    if (newWf) handleSelectWorkflow(newWf);
                });
            }}
            onDeleteWorkflow={setWorkflowToDelete}
            onRenameWorkflow={(wf) => {
                setWorkflowToRename(wf);
                setRenameInputValue(wf.name);
                setRenameCategoryValue(wf.category || 'personal');
            }}
            onDuplicateWorkflow={(wf: any) => handleDuplicateWorkflow(wf.id)}
        />
    );
};

// --- Main Entry ---

export function AdminCommonWorkflowManagement({
    onToggleSidebar,
    isSidebarOpen,
    onEditNode,
    refreshTrigger
}: {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    onEditNode?: (node: NodeType) => void;
    refreshTrigger?: number;
}) {
    return (
        <WorkflowEditorProvider
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            onEditNode={onEditNode}
            refreshTrigger={refreshTrigger}
        >
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                <Navigator
                    initialScene={<AdminWorkflowsTab />}
                />
                
                <WorkflowModals />
            </div>
        </WorkflowEditorProvider>
    );
}

// Sub-component for modals that need context
const WorkflowModals = () => {
    const {
        workflowToDelete,
        confirmDeleteWorkflow,
        setWorkflowToDelete,
        workflowToRename,
        handleRenameWorkflow,
        renameInputValue,
        setRenameInputValue,
        renameCategoryValue,
        setRenameCategoryValue,
        setWorkflowToRename,
        workflows
    } = useWorkflowEditor();

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(workflows), [workflows]);

    return (
        <>
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
                description={`Update properties for "${workflowToRename?.name}".`}
                confirmLabel="Update"
                variant="success"
                onConfirm={() => {
                    if (workflowToRename) {
                        handleRenameWorkflow(workflowToRename.id, renameInputValue, renameCategoryValue);
                    }
                    setWorkflowToRename(null);
                }}
                onCancel={() => setWorkflowToRename(null)}
            >
                <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Name</label>
                        <input
                            autoFocus
                            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                            placeholder="Workflow name"
                            value={renameInputValue}
                            onChange={(e) => setRenameInputValue(e.target.value)}
                        />
                    </div>
                    <AppCategoryInput
                        label="Category"
                        placeholder="e.g. personal, common, Analys"
                        value={renameCategoryValue}
                        onChange={setRenameCategoryValue}
                        allPaths={allCategoryPaths}
                    />
                </div>
            </ConfirmModal>
        </>
    );
};
