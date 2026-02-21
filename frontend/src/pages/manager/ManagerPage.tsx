import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    useReactFlow,
} from 'reactflow';
import type { Connection, Node, OnConnectStartParams } from 'reactflow';
import 'reactflow/dist/style.css';

import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';

import type { AssignedUser } from '../../entities/user/model/types';
import type { Workflow } from '../../entities/workflow/model/types';
import type { NodeType } from '../../entities/node-type/model/types';

import { Console } from '../../widgets/console/ui/Console';
import { NodeContextMenu } from '../../widgets/node-context-menu/NodeContextMenu';
import { StartNode } from '../../entities/node-type/ui/StartNode';
import { NodeProperties } from '../../widgets/node-properties/ui/NodeProperties';
import { WorkflowHeader } from '../../widgets/workflow-header';
import { ConfirmModal } from '../../shared/ui/confirm-modal';
import { AddNodeMenu } from '../../widgets/add-node-menu';

const nodeTypesConfig = {
    start: StartNode,
};

import styles from './ManagerPage.module.css';

export default function ManagerPage() {
    const { logout, user: currentUser } = useAuthStore();
    const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
    const [workflowsByOwner, setWorkflowsByOwner] = useState<Record<string, Workflow[]>>({});
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [nodes, setNodes, onNodesChangeRaw] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { screenToFlowPosition } = useReactFlow();

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
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [addNodeMenu, setAddNodeMenu] = useState<{ x: number, y: number, clientX: number, clientY: number, connectionStart: OnConnectStartParams } | null>(null);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);

    const loadWorkflowsForUser = useCallback(async (userId: string, isPersonal = false) => {
        try {
            const { data } = await apiClient.get(`/manager/users/${userId}/workflows`);
            setWorkflowsByOwner(prev => ({
                ...prev,
                [isPersonal ? 'personal' : userId]: data
            }));
        } catch (e) {
            console.error(`Failed to load workflows for user ${userId}`, e);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const nodeTypesRes = await apiClient.get('/manager/node-types');
                setNodeTypes(nodeTypesRes.data);

                const usersRes = await apiClient.get('/manager/users');
                const users = usersRes.data;
                setAssignedUsers(users);

                // Load personal workflows
                if (currentUser?.id) {
                    await loadWorkflowsForUser(currentUser.id, true);
                }

                // Load workflows for each client
                for (const user of users) {
                    await loadWorkflowsForUser(user.id);
                }
            } catch (e) {
                console.error("Initialization failed", e);
            }
        };
        init();
    }, [currentUser?.id, loadWorkflowsForUser]);

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
        (params: Connection) => {
            setEdges((eds) => addEdge(params, eds));
            (window as any)._connectionEstablished = true;
        },
        [setEdges]
    );

    const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
        setAddNodeMenu(null);
        (window as any)._lastConnectStartParams = params;
        (window as any)._connectionEstablished = false;
    }, []);

    const onConnectEnd = useCallback((event: any) => {
        const targetIsPane = event.target.classList.contains('react-flow__pane');
        const startParams = (window as any)._lastConnectStartParams;
        const connectionEstablished = (window as any)._connectionEstablished;

        if (targetIsPane && startParams && !connectionEstablished) {
            const containerRect = event.target.closest('.react-flow').getBoundingClientRect();
            setAddNodeMenu({
                x: event.clientX - containerRect.left - 20,
                y: event.clientY - containerRect.top - 20,
                clientX: event.clientX,
                clientY: event.clientY,
                connectionStart: startParams,
            });
        }
    }, []);

    const addNodeWithConnection = (type: NodeType, position: { x: number, y: number }, connectionStart: OnConnectStartParams) => {
        const initialParams: Record<string, any> = {};
        if (type.parameters) {
            type.parameters.forEach((param: any) => {
                if (param.default !== undefined && param.default !== null) {
                    initialParams[param.name] = param.default;
                }
            });
        }

        const newNodeId = `node_${Date.now()}`;
        const sourceNode = nodes.find(n => n.id === connectionStart.nodeId);
        const flowPos = screenToFlowPosition({ x: position.x, y: position.y });

        const newNode: Node = {
            id: newNodeId,
            type: 'default',
            position: {
                x: sourceNode ? sourceNode.position.x : flowPos.x,
                y: sourceNode ? sourceNode.position.y + 60 : flowPos.y
            },
            data: {
                label: type.name,
                params: initialParams
            },
        };

        setNodes((nds) => nds.concat(newNode));

        // Create connection
        if (connectionStart.nodeId) {
            const newEdge = {
                id: `e_${connectionStart.nodeId}-${newNodeId}`,
                source: connectionStart.nodeId,
                sourceHandle: connectionStart.handleId,
                target: newNodeId,
                targetHandle: null,
            };
            setEdges((eds) => addEdge(newEdge, eds));
        }

        setAddNodeMenu(null);
    };

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

    const handleCreateWorkflow = async (name: string, ownerId: string) => {
        const effectiveOwnerId = ownerId === 'personal' ? currentUser?.id : ownerId;
        if (!effectiveOwnerId) return;

        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/manager/workflows', {
                name,
                owner_id: effectiveOwnerId,
            });
            setWorkflowsByOwner((prev) => ({
                ...prev,
                [ownerId]: [...(prev[ownerId] || []), data]
            }));
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWorkflow = async () => {
        if (!workflowToDelete) return;

        try {
            await apiClient.delete(`/manager/workflows/${workflowToDelete.id}`);

            setWorkflowsByOwner((prev) => {
                const newWorkflows = { ...prev };
                for (const ownerId in newWorkflows) {
                    newWorkflows[ownerId] = newWorkflows[ownerId].filter(w => w.id !== workflowToDelete.id);
                }
                return newWorkflows;
            });

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

    const pollExecution = useCallback(async (executionId: string) => {
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

                <div className={styles.sidebarComingSoon}>
                    {/* Sidebar content will be added in future updates */}
                </div>

                <button className={styles.logout} onClick={logout}>Sign Out</button>
            </aside>

            <main className={styles.main}>
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
                    onRun={runWorkflow}
                    onToggleSidebar={toggleSidebar}
                    canAction={!!activeWorkflow}
                    isCreating={isCreating}
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
                            onConnectStart={onConnectStart}
                            onConnectEnd={onConnectEnd}
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background color="#333" gap={16} />
                            <Controls />
                        </ReactFlow>
                        {addNodeMenu && (
                            <AddNodeMenu
                                x={addNodeMenu.x}
                                y={addNodeMenu.y}
                                nodeTypes={nodeTypes}
                                onSelect={(type) => addNodeWithConnection(type, { x: addNodeMenu.clientX, y: addNodeMenu.clientY }, addNodeMenu.connectionStart)}
                                onClose={() => setAddNodeMenu(null)}
                            />
                        )}
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
