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


/* eslint-disable @typescript-eslint/no-explicit-any */

const EMPTY_OBJ = {};

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
    onEditNode
}: any) => {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isDirty, setIsDirty] = useState(false);

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

    useEffect(() => {
        if (!initialWorkflowRef.current) return;

        const currentDataStr = JSON.stringify({
            graph: activeWorkflow?.graph,
            workflow_data: activeWorkflow?.workflow_data
        });
        if (initialWorkflowRef.current !== currentDataStr) {
            setIsDirty(true);
        }
    }, [activeWorkflow]);

    const onNodesChange = useCallback((nodes: Node[]) => {
        handleNodesChange(nodes);
        if (initialNodesStrRef.current && JSON.stringify(nodes) !== initialNodesStrRef.current) {
            setIsDirty(true);
        }
    }, [handleNodesChange]);

    const onEdgesChange = useCallback((edges: Edge[]) => {
        handleEdgesChange(edges);
        if (initialEdgesStrRef.current && JSON.stringify(edges) !== initialEdgesStrRef.current) {
            setIsDirty(true);
        }
    }, [handleEdgesChange]);

    const onSaveInternal = async () => {
        await saveWorkflow();
        setIsDirty(false);
        onBack();
    };

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
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
        <AppFormView
            title={activeWorkflow?.name || 'Workflow'}
            parentTitle="Workflows"
            icon="account_tree"
            isDirty={isDirty}
            onSave={onSaveInternal}
            onCancel={onBack}
            isSaving={isSaving}
            saveLabel="Save Workflow"
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
            <div className="flex-1 flex flex-col min-h-[600px] relative -m-10">
                <style>{`
                    .workflow-editor-container .react-flow__pane {
                        cursor: crosshair;
                    }
                `}</style>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex-1 flex min-h-0 relative">
                        <div className="flex-1 relative workflow-editor-container">
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
        </AppFormView>
    );
};

const AdminWorkflowsTabWithNavigator = ({
    workflowsByOwner,
    activeWorkflow,
    nodeTypes,
    setWorkflowToDelete,
    setWorkflowToRename,
    loadWorkflow,
    handleCreateWorkflow,
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
    handleNodesChange,
    handleEdgesChange,
    nodesRef,
    edgesRef,
    onEditNode
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

    useEffect(() => {
        if (activeWorkflow && nav.canGoBack) {
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
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkflow, isRunning, isSaving, isEditModalOpen, nodeTypes, activeNodeIds, activeClientId, canSave, isConsoleVisible, executionLogs, liveRuntimeData]);

    return (
        <WorkflowList
            workflowsByOwner={workflowsByOwner}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={onToggleSidebar}
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

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);

    const {
        workflowsByOwner,
        activeWorkflow,
        nodeTypes,
        workflowToDelete,
        workflowToRename,
        setWorkflowToDelete,
        setWorkflowToRename,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
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
                workflowsByOwner={workflowsByOwner}
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
                handleNodesChange={handleNodesChange}
                handleEdgesChange={handleEdgesChange}
                nodesRef={nodesRef}
                edgesRef={edgesRef}
                onEditNode={handleNodeDoubleClick}
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
        </div>
    );
}
