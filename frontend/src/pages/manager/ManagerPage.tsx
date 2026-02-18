import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';
import styles from './ManagerPage.module.css';

interface AssignedUser {
    id: number;
    username: string;
}

interface Workflow {
    id: number;
    name: string;
    status: string;
}

interface NodeType {
    id: number;
    name: string;
    version: string;
    description: string;
}

export default function ManagerPage() {
    const { logout } = useAuthStore();
    const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<AssignedUser | null>(null);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        apiClient.get('/manager/users').then((r) => setAssignedUsers(r.data)).catch(() => { });
        apiClient.get('/manager/node-types').then((r) => setNodeTypes(r.data)).catch(() => { });
    }, []);

    const loadWorkflows = (userId: number) => {
        apiClient.get(`/manager/users/${userId}/workflows`).then((r) => setWorkflows(r.data)).catch(() => { });
    };

    const loadWorkflow = (wf: Workflow) => {
        setActiveWorkflow(wf);
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

    const createWorkflow = async () => {
        if (!selectedUser || !newWorkflowName) return;
        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/manager/workflows', {
                name: newWorkflowName,
                owner_id: selectedUser.id,
            });
            setWorkflows((prev) => [...prev, data]);
            setNewWorkflowName('');
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const addNode = (type: NodeType) => {
        const newNode: Node = {
            id: `node_${Date.now()}`,
            type: 'default',
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { label: type.name },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
        await apiClient.put(`/manager/workflows/${activeWorkflow.id}`, {
            graph: { nodes, edges },
        });
    };

    const runWorkflow = async () => {
        if (!activeWorkflow) return;
        setIsRunning(true);
        try {
            await apiClient.post(`/manager/workflows/${activeWorkflow.id}/run`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <div className={styles.logo}>⚡ Workflow Engine</div>
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>My Users</h3>
                    {assignedUsers.map((u) => (
                        <button
                            key={u.id}
                            className={selectedUser?.id === u.id ? styles.activeItem : styles.item}
                            onClick={() => { setSelectedUser(u); loadWorkflows(u.id); }}
                        >
                            👤 {u.username}
                        </button>
                    ))}
                </div>
                {selectedUser && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Workflows</h3>
                        <div className={styles.createForm}>
                            <input
                                type="text"
                                placeholder="Workflow name..."
                                value={newWorkflowName}
                                onChange={(e) => setNewWorkflowName(e.target.value)}
                                className={styles.createInput}
                            />
                            <button
                                onClick={createWorkflow}
                                disabled={isCreating || !newWorkflowName}
                                className={styles.createBtn}
                            >
                                {isCreating ? '...' : '+'}
                            </button>
                        </div>
                        {workflows.map((wf) => (
                            <button
                                key={wf.id}
                                className={activeWorkflow?.id === wf.id ? styles.activeItem : styles.item}
                                onClick={() => loadWorkflow(wf)}
                            >
                                📋 {wf.name}
                            </button>
                        ))}
                    </div>
                )}
                {activeWorkflow && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Node Library</h3>
                        <div className={styles.nodeLibrary}>
                            {nodeTypes.map((type) => (
                                <button
                                    key={type.id}
                                    className={styles.LibraryItem}
                                    onClick={() => addNode(type)}
                                    title={type.description}
                                >
                                    <span className={styles.nodeIcon}>📦</span>
                                    <div className={styles.nodeInfo}>
                                        <div className={styles.nodeName}>{type.name}</div>
                                        <div className={styles.nodeVersion}>v{type.version}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <button className={styles.logout} onClick={logout}>Sign Out</button>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <h1>{activeWorkflow ? activeWorkflow.name : 'Select a workflow'}</h1>
                    <div className={styles.actions}>
                        <button className={styles.saveBtn} onClick={saveWorkflow} disabled={!activeWorkflow}>Save</button>
                        <button className={styles.runBtn} onClick={runWorkflow} disabled={!activeWorkflow || isRunning}>
                            {isRunning ? '⏳ Running...' : '▶ Play'}
                        </button>
                    </div>
                </header>

                <div className={styles.canvas}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                    >
                        <Background color="#333" gap={16} />
                        <Controls />
                        <MiniMap nodeColor="#7c3aed" maskColor="rgba(0,0,0,0.5)" />
                    </ReactFlow>
                </div>
            </main>
        </div>
    );
}
