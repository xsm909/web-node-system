import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import { Console } from '../../console/ui/Console';
import { WorkflowDataEditorTabs } from '../../workflow-data-editor';
import { WorkflowList } from '../../workflow-list';
import { useNavigator } from '../../../shared/ui/navigator';
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


/* eslint-disable @typescript-eslint/no-explicit-any */

const EMPTY_OBJ = {};
let globalIsParamsExpanded = false;

// We can reuse the WorkflowEditorView structure from ManagerPage
const AdminWorkflowEditorView = ({
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
    onBack,
    onEditNode,
    notifyChange
}: any) => {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isParamsExpanded, setIsParamsExpanded] = useState(globalIsParamsExpanded);

    const handleToggleParams = useCallback(() => {
        setIsParamsExpanded(prev => {
            const newValue = !prev;
            globalIsParamsExpanded = newValue;
            return newValue;
        });
    }, []);

    // Track initial state to detect changes from external data (edit modal)
    const initialWorkflowRef = useRef<string | null>(null);
    const initialNodesStrRef = useRef<string | null>(null);
    const initialEdgesStrRef = useRef<string | null>(null);

    useEffect(() => {
        // Only capture initial state once workflow is loaded with its graph
        if (activeWorkflow?.graph && !initialNodesStrRef.current) {
            initialNodesStrRef.current = JSON.stringify(activeWorkflow.graph.nodes || []);
            initialEdgesStrRef.current = JSON.stringify(activeWorkflow.graph.edges || []);
            initialWorkflowRef.current = JSON.stringify({
                graph: activeWorkflow.graph,
                workflow_data: activeWorkflow.workflow_data
            });
        }
    }, [activeWorkflow]);


    const onNodesChange = useCallback((nodes: Node[]) => {
        handleNodesChange(nodes);

        // Sync to parent state so changes are preserved if we remount (e.g. returning from Node Type editor)
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;

            // Merge graph nodes with existing parameters from parent state
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

            console.log('[AdminCommonWorkflow] onNodesChange (graph update) Merging nodes. Preserving params from state.');
            
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
    }, [handleNodesChange, setActiveWorkflow, notifyChange]);

    const onEdgesChange = useCallback((edges: Edge[]) => {
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
    }, [handleEdgesChange, setActiveWorkflow, notifyChange]);

    const onSaveInternal = async () => {
        await saveWorkflow();
    };

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        console.log('[AdminCommonWorkflow] handleParamsChange nodeId:', nodeId, 'params:', params);
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

    return (
        <AppFormView
            title={activeWorkflow?.name || 'Workflow'}
            parentTitle="Workflows"
            icon="account_tree"
            isDirty={notifyChange.isDirty} // Pass isDirty from operations hook
            onSave={onSaveInternal}
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
                    .workflow-editor-container .react-flow__pane {
                        cursor: crosshair;
                    }
                `}</style>
                <div className="flex-1 flex flex-col min-h-0 relative">
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
            </div>
        </AppFormView>
    );
};

const AdminWorkflowsTabWithNavigator = ({
    workflows,
    activeWorkflow,
    nodeTypes,
    setWorkflowToDelete,
    setWorkflowToRename,
    loadWorkflow,
    handleCreateWorkflow,
    handleDuplicateWorkflow,
    setActiveWorkflow,
    saveWorkflow,
    runWorkflow,
    isRunning,
    isSaving,
    activeNodeIds,
    isSidebarOpen,
    onToggleSidebar,
    activeClientId,
    canSave,
    isEditModalOpen,
    setIsEditModalOpen,
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
    onEditNode,
    notifyChange
}: any) => {
    const nav = useNavigator();

    const handleSelectWorkflow = useCallback((wf: any) => {
        loadWorkflow(wf);
        nav.push(
            <AdminWorkflowEditorView
                activeWorkflow={wf}
                nodeTypes={nodeTypes}
                setActiveWorkflow={setActiveWorkflow}
                saveWorkflow={saveWorkflow}
                runWorkflow={runWorkflow}
                isRunning={isRunning}
                isSaving={isSaving}
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
                onEditNode={onEditNode}
                notifyChange={notifyChange}
                onBack={() => {
                    setActiveWorkflow(null);
                    nav.pop();
                }}
            />
        );
    }, [nodeTypes, setActiveWorkflow, saveWorkflow, runWorkflow, isRunning, isSaving, activeNodeIds, activeClientId, canSave, isEditModalOpen, setIsEditModalOpen, isConsoleVisible, setIsConsoleVisible, executionLogs, liveRuntimeData, handleNodesChange, handleEdgesChange, nodesRef, edgesRef, onEditNode, loadWorkflow, nav]);

    useEffect(() => {
        if (activeWorkflow && !nav.canGoBack) {
            handleSelectWorkflow(activeWorkflow);
        }
    }, [activeWorkflow, nav.canGoBack, handleSelectWorkflow]);

    // Only replace scene if we are in the editor and graph JUST arrived
    const hasGraph = !!activeWorkflow?.graph;

    useEffect(() => {
        if (hasGraph && nav.canGoBack) {
            console.log('[AdminWorkflowsTab] Refreshing editor scene for:', activeWorkflow?.id);
            nav.replace(
                <AdminWorkflowEditorView
                    activeWorkflow={activeWorkflow}
                    nodeTypes={nodeTypes}
                    setActiveWorkflow={setActiveWorkflow}
                    saveWorkflow={saveWorkflow}
                    runWorkflow={runWorkflow}
                    isRunning={isRunning}
                    isSaving={isSaving}
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
                    onEditNode={onEditNode}
                    notifyChange={notifyChange}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
    }, [activeWorkflow, isRunning, isSaving, isEditModalOpen, nodeTypes, activeNodeIds, activeClientId, canSave, isConsoleVisible, executionLogs, liveRuntimeData, nav, notifyChange]);

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

    const handleNodeDoubleClick = useCallback(async (event: React.MouseEvent, node: Node) => {
        if (!onEditNode) return;
        event.preventDefault();
        event.stopPropagation();
        const ntDef = nodeTypes.find(t =>
            (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) ||
            (t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase())
        );
        if (ntDef) {
            try {
                // Fetch full node type to ensure `code` is included
                const { data } = await apiClient.get(`/admin/node-types/${ntDef.id}`);
                onEditNode(data);
            } catch (error) {
                console.error("Failed to fetch full node type for editing:", error);
                // Fallback to the partial def if the full fetch fails
                onEditNode(ntDef);
            }
        }
    }, [onEditNode, nodeTypes]);

    return (
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
            <AdminWorkflowsTabWithNavigator
                workflows={workflows}
                activeWorkflow={activeWorkflow}
                nodeTypes={nodeTypes}
                setWorkflowToDelete={setWorkflowToDelete}
                setWorkflowToRename={setWorkflowToRename}
                loadWorkflow={loadWorkflow}
                handleCreateWorkflow={handleCreateWorkflow}
                setActiveWorkflow={setActiveWorkflow}
                saveWorkflow={saveWorkflow}
                runWorkflow={runWorkflow}
                isRunning={isRunning}
                isSaving={isSaving}
                activeNodeIds={activeNodeIds}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={onToggleSidebar}
                activeClientId={activeClientId}
                canSave={true}
                isEditModalOpen={isEditModalOpen}
                setIsEditModalOpen={setIsEditModalOpen}
                isConsoleVisible={isConsoleVisible}
                setIsConsoleVisible={setIsConsoleVisible}
                executionLogs={executionLogs}
                liveRuntimeData={liveRuntimeData}
                setRenameInputValue={setRenameInputValue}
                setRenameCategoryValue={setRenameCategoryValue}
                handleDuplicateWorkflow={handleDuplicateWorkflow}
                handleNodesChange={handleNodesChange}
                handleEdgesChange={handleEdgesChange}
                nodesRef={nodesRef}
                edgesRef={edgesRef}
                onEditNode={handleNodeDoubleClick}
                notifyChange={notifyChange}
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
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && workflowToRename && renameInputValue.trim()) {
                                    handleRenameWorkflow(workflowToRename.id, renameInputValue, renameCategoryValue);
                                    setWorkflowToRename(null);
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Category</label>
                        <input
                            className="w-full px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-brand transition-all font-medium"
                            placeholder="e.g. personal, common, Analys"
                            value={renameCategoryValue}
                            onChange={(e) => setRenameCategoryValue(e.target.value)}
                        />
                    </div>
                </div>
            </ConfirmModal>
        </div>
    );
}
