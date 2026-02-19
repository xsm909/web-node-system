import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import type { Connection, Node } from 'reactflow';
import 'reactflow/dist/style.css';

import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';

import type { AssignedUser } from '../../entities/user/model/types';
import type { Workflow } from '../../entities/workflow/model/types';
import type { NodeType } from '../../entities/node-type/model/types';

import { UserList } from '../../widgets/user-list/ui/UserList';
import { WorkflowList } from '../../widgets/workflow-list/ui/WorkflowList';
import { NodeLibrary } from '../../widgets/node-library/ui/NodeLibrary';
import { Console } from '../../widgets/console/ui/Console';
import { CreateWorkflowForm } from '../../features/create-workflow/ui/CreateWorkflowForm';
import { NodeContextMenu } from '../../widgets/node-context-menu/NodeContextMenu';
import { StartNode } from '../../entities/node-type/ui/StartNode';
import { NodeProperties } from '../../widgets/node-properties/ui/NodeProperties';
import { WorkflowHeader } from '../../widgets/workflow-header';
import { ConfirmModal } from '../../shared/ui/confirm-modal';

const nodeTypesConfig = {
    start: StartNode,
};

import styles from './ManagerPage.module.css';

export default function ManagerPage() {
    const { logout } = useAuthStore();
    const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<AssignedUser | null>(null);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [nodes, setNodes, onNodesChangeRaw] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const onNodesChange = useCallback((changes: any) => {
        const filteredChanges = changes.filter((change: any) => {
            if (change.type === 'remove' && (change.id === 'node_start' || nodes.find(n => n.id === change.id)?.type === 'start')) {
                return false;
            }
            return true;
        });

        // Clear selection if selected node is removed
        const isRemoved = filteredChanges.some((c: any) => c.type === 'remove' && c.id === selectedNodeId);
        if (isRemoved) setSelectedNodeId(null);

        onNodesChangeRaw(filteredChanges);
    }, [onNodesChangeRaw, nodes, selectedNodeId]);

    const [isRunning, setIsRunning] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [executionLogs, setExecutionLogs] = useState([]);
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [currentExecutionId, setCurrentExecutionId] = useState<number | null>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);

    useEffect(() => {
        apiClient.get('/manager/users').then((r) => setAssignedUsers(r.data)).catch(() => { });
        apiClient.get('/manager/node-types').then((r) => setNodeTypes(r.data)).catch(() => { });
    }, []);

    const loadWorkflows = (userId: number) => {
        apiClient.get(`/manager/users/${userId}/workflows`).then((r) => setWorkflows(r.data)).catch(() => { });
    };

    const handleUserSelect = (user: AssignedUser) => {
        setSelectedUser(user);
        setSelectedNodeId(null);
        loadWorkflows(user.id);
    };

    const loadWorkflow = (wf: Workflow) => {
        setActiveWorkflow(wf);
        setSelectedNodeId(null);
        apiClient.get(`/manager/workflows/${wf.id}`).then((r) => {
            const graph = r.data.graph || { nodes: [], edges: [] };
            setNodes(graph.nodes || []);
            setEdges(graph.edges || []);
        }).catch(() => { });
    };

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setSelectedNodeId(node.id);

        if (event.button === 2 || event.ctrlKey) {
            // Disable context menu for Start node
            if (node.id === 'node_start' || node.type === 'start') {
                setMenu(null);
                return;
            }

            const containerRect = (event.currentTarget as HTMLElement)
                .closest('.react-flow')
                ?.parentElement?.getBoundingClientRect();

            if (!containerRect) return;

            const nodeRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

            setMenu({
                x: nodeRect.left - containerRect.left + nodeRect.width / 2,
                y: nodeRect.bottom - containerRect.top,
                nodeId: node.id,
            });
        }
    }, []);

    const onNodeDragStart = useCallback(() => {
        setMenu(null);
    }, []);

    const onNodesDelete = useCallback(() => {
        setMenu(null);
        setSelectedNodeId(null);
    }, []);

    const onMoveStart = useCallback(() => {
        setMenu(null);
    }, []);

    const handleDeleteNode = useCallback((nodeId: string) => {
        if (nodeId === 'node_start') {
            alert('Cannot delete the Start node. It is required for the workflow.');
            return;
        }
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        setMenu(null);
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [setNodes, setEdges, selectedNodeId]);

    const handleCreateWorkflow = async (name: string) => {
        if (!selectedUser) return;
        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/manager/workflows', {
                name,
                owner_id: selectedUser.id,
            });
            setWorkflows((prev) => [...prev, data]);
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWorkflow = async () => {
        if (!workflowToDelete) return;
        console.log('Confirming deletion for workflow:', workflowToDelete);

        try {
            const response = await apiClient.delete(`/manager/workflows/${workflowToDelete.id}`);
            console.log('Delete response:', response.data);
            setWorkflows((prev) => prev.filter(w => w.id !== workflowToDelete.id));
            if (activeWorkflow?.id === workflowToDelete.id) {
                setActiveWorkflow(null);
                setNodes([]);
                setEdges([]);
            }
        } catch (error) {
            console.error('Failed to delete workflow', error);
        } finally {
            setWorkflowToDelete(null);
        }
    };

    const addNode = (type: NodeType) => {
        const newNode: Node = {
            id: `node_${Date.now()}`,
            type: 'default',
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
                label: type.name,
                params: {}
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
        await apiClient.put(`/manager/workflows/${activeWorkflow.id}`, {
            graph: { nodes, edges },
        });
    };

    const handleParamsChange = (nodeId: string, params: any) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: { ...node.data, params }
                };
            }
            return node;
        }));
    };

    const pollExecution = useCallback(async (executionId: number) => {
        try {
            const { data } = await apiClient.get(`/manager/executions/${executionId}`);
            setExecutionLogs(data.logs || []);

            if (data.status === 'success' || data.status === 'failed') {
                setIsRunning(false);
                return true; // Stop polling
            }
            return false;
        } catch (e) {
            setIsRunning(false);
            return true;
        }
    }, []);

    useEffect(() => {
        let timer: any;
        if (isRunning && currentExecutionId) {
            const poll = async () => {
                const stopped = await pollExecution(currentExecutionId);
                if (!stopped) {
                    timer = setTimeout(poll, 1500);
                }
            };
            poll();
        }
        return () => clearTimeout(timer);
    }, [isRunning, currentExecutionId, pollExecution]);

    const runWorkflow = async () => {
        if (!activeWorkflow) return;
        await saveWorkflow();
        setIsRunning(true);
        setExecutionLogs([]);
        setIsConsoleVisible(true);
        try {
            const { data } = await apiClient.post(`/manager/workflows/${activeWorkflow.id}/run`);
            setCurrentExecutionId(data.execution_id);
        } catch (e) {
            setIsRunning(false);
        }
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

    return (
        <div className={`${styles.layout} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
            {isSidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setIsSidebarOpen(false)} />}

            <aside className={styles.sidebar}>
                <button className={styles.sidebarClose} onClick={() => setIsSidebarOpen(false)} aria-label="Close menu">×</button>
                <div className={styles.logo}>⚡ Workflow Engine</div>

                <UserList
                    users={assignedUsers}
                    selectedUserId={selectedUser?.id}
                    onSelect={handleUserSelect}
                />

                {selectedUser && (
                    <>
                        <CreateWorkflowForm
                            onCreate={handleCreateWorkflow}
                            isCreating={isCreating}
                        />
                        <WorkflowList
                            workflows={workflows}
                            activeWorkflowId={activeWorkflow?.id}
                            onSelect={loadWorkflow}
                            onDelete={(wf) => {
                                console.log('Requesting deletion for workflow:', wf);
                                setWorkflowToDelete(wf);
                            }}
                        />
                    </>
                )}

                {activeWorkflow && (
                    <NodeLibrary
                        nodeTypes={nodeTypes}
                        onAddNode={addNode}
                    />
                )}

                <button className={styles.logout} onClick={logout}>Sign Out</button>
            </aside>

            <main className={styles.main}>
                <WorkflowHeader
                    title={activeWorkflow ? activeWorkflow.name : 'Select a workflow'}
                    isRunning={isRunning}
                    isSidebarOpen={isSidebarOpen}
                    onSave={saveWorkflow}
                    onRun={runWorkflow}
                    onToggleSidebar={toggleSidebar}
                    canAction={!!activeWorkflow}
                />

                <div className={styles.canvasContainer}>
                    <div className={styles.canvas}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            onNodeDragStart={onNodeDragStart}
                            onNodesDelete={onNodesDelete}
                            onMoveStart={onMoveStart}
                            onPaneClick={() => {
                                setMenu(null);
                                setSelectedNodeId(null);
                            }}
                            nodeTypes={nodeTypesConfig}
                            fitView
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background color="#333" gap={16} />
                            <Controls />
                        </ReactFlow>
                        {menu && (
                            <NodeContextMenu
                                x={menu.x}
                                y={menu.y}
                                nodeId={menu.nodeId}
                                onDelete={handleDeleteNode}
                                onClose={() => setMenu(null)}
                            />
                        )}
                    </div>
                    {selectedNode && (
                        <NodeProperties
                            node={selectedNode}
                            nodeTypes={nodeTypes}
                            onChange={handleParamsChange}
                            onClose={() => setSelectedNodeId(null)}
                        />
                    )}
                </div>

                <Console
                    logs={executionLogs}
                    isVisible={isConsoleVisible}
                    onClose={() => setIsConsoleVisible(false)}
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
        </div>
    );
}
