import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import { Console } from '../../console/ui/Console';
import { WorkflowHeader } from '../../workflow-header';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { WorkflowGraph } from '../../workflow-graph';
import type { NodeType } from '../../../entities/node-type/model/types';
import { WorkflowDataEditorTabs } from '../../workflow-data-editor';
import { useWorkflowOperations } from '../../../features/workflow-operations';
import { useWorkflowManagement } from '../../../features/workflow-management';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';
import { Icon } from '../../../shared/ui/icon';
import { apiClient } from '../../../shared/api/client';

export function AdminCommonWorkflowManagement({
    onToggleSidebar,
    onEditNode,
    refreshTrigger
}: {
    onToggleSidebar: () => void;
    onEditNode?: (node: NodeType) => void;
    refreshTrigger?: number;
}) {
    const { activeClientId } = useClientStore();
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');
    const [workflowToCreateOwnerId, setWorkflowToCreateOwnerId] = useState<string | null>(null);
    const [createInputValue, setCreateInputValue] = useState('');

    const EMPTY_OBJ = useRef({});
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
    }, [activeWorkflow?.id]);

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
            <WorkflowHeader
                title={activeWorkflow ? activeWorkflow.name : 'Select a common workflow'}
                activeWorkflowId={activeWorkflow?.id}
                users={[]} // No assigned users for common workflows
                workflowsByOwner={workflowsByOwner}
                isRunning={isRunning}
                isSidebarOpen={false} // dummy
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
                onToggleSidebar={onToggleSidebar}
                canAction={!!activeWorkflow}
                isCreating={isCreating}
                onOpenEditModal={() => setIsEditModalOpen(true)}
                showClientSelector={true}
                canSave={true}
            />

            {activeWorkflow ? (
                <WorkflowGraph
                    workflow={activeWorkflow}
                    nodeTypes={nodeTypes}
                    isReadOnly={false}
                    onNodesChangeCallback={handleNodesChange}
                    onEdgesChangeCallback={handleEdgesChange}
                    onNodeDoubleClickCallback={handleNodeDoubleClick}
                    activeNodeIds={activeNodeIds}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface-900/50">
                    <div className="w-20 h-20 rounded-3xl bg-brand/10 flex items-center justify-center mb-6">
                        <Icon name="account_tree" size={40} className="text-brand opacity-60" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">Common Workflows</h2>
                    <p className="text-[var(--text-muted)] max-w-md">
                        Select an existing common workflow from the top dropdown or create a new one to get started.
                        These workflows are shared among all administrators.
                    </p>
                </div>
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
                title={workflowToCreateOwnerId === 'common' ? "New Common Workflow" : "New Personal Workflow"}
                description={workflowToCreateOwnerId === 'common'
                    ? "Enter a name for the new common workflow."
                    : "Enter a name for your new personal workflow."}
                confirmLabel="Create"
                variant="success"
                onConfirm={() => {
                    if (workflowToCreateOwnerId && createInputValue.trim()) {
                        const category = workflowToCreateOwnerId === 'common' ? 'common' : 'personal';
                        handleCreateWorkflow(createInputValue, workflowToCreateOwnerId, category);
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
                            const category = workflowToCreateOwnerId === 'common' ? 'common' : 'personal';
                            handleCreateWorkflow(createInputValue, workflowToCreateOwnerId, category);
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
        </div>
    );
}
