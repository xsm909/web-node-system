import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import { Console } from '../../console/ui/Console';
import { WorkflowDataEditorTabs } from '../../workflow-data-editor';
import { AppHeader } from '../../app-header';
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

/* eslint-disable @typescript-eslint/no-explicit-any */

const EMPTY_OBJ = {};

// We can reuse the WorkflowEditorView structure from ManagerPage
const AdminWorkflowEditorView = ({
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
    setIsConsoleVisible,
    handleNodesChange,
    handleEdgesChange,
    onBack,
    onEditNode,
    onNodeSelect
}: any) => {
    return (
        <div className="flex-1 flex flex-col min-h-0 w-full relative">
            <AppHeader
                onBack={onBack}
                onToggleSidebar={() => { }} // not needed when back button is present
                isSidebarOpen={false}
                leftContent={
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                            {activeWorkflow?.name}
                        </h1>
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-surface-700 text-[var(--text-main)] opacity-70 border border-[var(--border-base)]">
                            {activeWorkflow?.owner_id === 'common' ? 'Common' : 'Admin Workflow'}
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
            
            {activeWorkflow && (
                <WorkflowGraph
                    workflow={activeWorkflow}
                    nodeTypes={nodeTypes}
                    isReadOnly={false}
                    onNodesChangeCallback={handleNodesChange}
                    onEdgesChangeCallback={handleEdgesChange}
                    onNodeDoubleClickCallback={onEditNode}
                    onNodeSelectCallback={onNodeSelect}
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
    );
};

const AdminWorkflowsTabWithNavigator = ({
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
    onToggleSidebar,
    activeClientId,
    canSave,
    isEditModalOpen,
    setIsEditModalOpen,
    setIsConsoleVisible,
    setRenameInputValue,
    handleNodesChange,
    handleEdgesChange,
    onEditNode
}: any) => {
    const nav = useNavigator();

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            const updatedNodes = (prev.graph?.nodes || []).map((n: any) =>
                n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
            );
            return { ...prev, graph: { ...prev.graph, nodes: updatedNodes } };
        });
    }, [setActiveWorkflow]);

    const handleNodeSelect = useCallback((node: Node | null) => {
        if (!node || !nodeTypes) return;
        const ntDef = nodeTypes.find((t: any) =>
            (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) ||
            t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase()
        );
        if (!ntDef || !ntDef.parameters?.length) return;
        nav.push(
            <NodeEditorView
                node={node}
                nodeTypes={nodeTypes}
                onChange={handleParamsChange}
                onBack={() => nav.pop()}
            />
        );
    }, [nav, nodeTypes, handleParamsChange]);

    const handleSelectWorkflow = useCallback((wf: any) => {
        loadWorkflow(wf);
        nav.push(
            <AdminWorkflowEditorView
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
                setIsConsoleVisible={setIsConsoleVisible}
                handleNodesChange={handleNodesChange}
                handleEdgesChange={handleEdgesChange}
                onEditNode={onEditNode}
                onNodeSelect={handleNodeSelect}
                onBack={() => {
                    setActiveWorkflow(null);
                    nav.pop();
                }}
            />
        );
    }, [nodeTypes, isCreating, setActiveWorkflow, saveWorkflow, runWorkflow, isRunning, activeNodeIds, activeClientId, canSave, isEditModalOpen, setIsEditModalOpen, setIsConsoleVisible, handleNodesChange, handleEdgesChange, onEditNode, handleNodeSelect, loadWorkflow, nav]);

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
                    setIsConsoleVisible={setIsConsoleVisible}
                    handleNodesChange={handleNodesChange}
                    handleEdgesChange={handleEdgesChange}
                    onEditNode={onEditNode}
                    onNodeSelect={handleNodeSelect}
                    onBack={() => {
                        setActiveWorkflow(null);
                        nav.pop();
                    }}
                />
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkflow, isRunning, isCreating, isEditModalOpen, nodeTypes, activeNodeIds, activeClientId, canSave, handleNodeSelect]);

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
    } = useWorkflowManagement(refreshTrigger);

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
                onToggleSidebar={onToggleSidebar}
                activeClientId={activeClientId}
                canSave={true}
                isEditModalOpen={isEditModalOpen}
                setIsEditModalOpen={setIsEditModalOpen}
                setIsConsoleVisible={setIsConsoleVisible}
                setRenameInputValue={setRenameInputValue}
                handleNodesChange={handleNodesChange}
                handleEdgesChange={handleEdgesChange}
                onEditNode={handleNodeDoubleClick}
            />


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
