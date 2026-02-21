import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    useReactFlow,
} from 'reactflow';
import type {
    Node,
    Edge,
    Connection,
    OnConnectStartParams
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';

import { NodeContextMenu } from '../../node-context-menu/NodeContextMenu';
import { StartNode } from '../../../entities/node-type/ui/StartNode';
import { DefaultNode } from '../../../entities/node-type/ui/DefaultNode';
import { NodeProperties } from '../../node-properties/ui/NodeProperties';
import { AddNodeMenu } from '../../add-node-menu';

const nodeTypesConfig = {
    start: StartNode,
    action: DefaultNode,
    default: DefaultNode,
};

interface WorkflowGraphProps {
    workflow: Workflow | null;
    nodeTypes: NodeType[];
    isReadOnly?: boolean;
    onNodesChangeCallback?: (nodes: Node[]) => void;
    onEdgesChangeCallback?: (edges: Edge[]) => void;
}

export function WorkflowGraph({
    workflow,
    nodeTypes,
    isReadOnly = false,
    onNodesChangeCallback,
    onEdgesChangeCallback
}: WorkflowGraphProps) {
    const [nodes, setNodes, onNodesChangeRaw] = useNodesState([]);
    const [edges, setEdges, onEdgesChangeRaw] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const { screenToFlowPosition, setCenter } = useReactFlow();

    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [addNodeMenu, setAddNodeMenu] = useState<{ x: number, y: number, clientX: number, clientY: number, connectionStart: OnConnectStartParams } | null>(null);

    // Load workflow data
    useEffect(() => {
        const wf = workflow as any;
        if (!wf || !wf.graph) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const graphNodes = wf.graph.nodes || [];
        const graphEdges = wf.graph.edges || [];

        const loadedNodes = graphNodes.map((n: any) =>
            n.type === 'default' ? { ...n, type: 'action' } : n
        );

        setNodes(loadedNodes);
        setEdges(graphEdges);

        setTimeout(() => {
            const startNode = loadedNodes.find((n: any) => n.id === 'node_start' || n.type === 'start');
            if (startNode) {
                setCenter(startNode.position.x + 100, startNode.position.y + 60, { zoom: 0.5, duration: 200 });
            }
        }, 50);
    }, [workflow, setNodes, setEdges, setCenter]);

    // Propagate changes up
    useEffect(() => {
        if (onNodesChangeCallback) onNodesChangeCallback(nodes);
    }, [nodes, onNodesChangeCallback]);

    useEffect(() => {
        if (onEdgesChangeCallback) onEdgesChangeCallback(edges);
    }, [edges, onEdgesChangeCallback]);

    const onNodesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        const filteredChanges = changes.filter((change: any) => {
            if (change.type === 'remove' && (change.id === 'node_start' || nodes.find(n => n.id === change.id)?.type === 'start')) {
                return false;
            }
            return true;
        });

        const isRemoved = filteredChanges.some((c: any) => c.type === 'remove' && c.id === selectedNodeId);
        if (isRemoved) setSelectedNodeId(null);

        onNodesChangeRaw(filteredChanges);
    }, [onNodesChangeRaw, nodes, selectedNodeId, isReadOnly]);

    const onEdgesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        onEdgesChangeRaw(changes);
    }, [onEdgesChangeRaw, isReadOnly]);

    const onConnect = useCallback(
        (params: Connection) => {
            if (isReadOnly) return;
            setEdges((eds) => addEdge(params, eds));
            (window as any)._connectionEstablished = true;
        },
        [setEdges, isReadOnly]
    );

    const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
        if (isReadOnly) return;
        setAddNodeMenu(null);
        (window as any)._lastConnectStartParams = params;
        (window as any)._connectionEstablished = false;
    }, [isReadOnly]);

    const onConnectEnd = useCallback((event: any) => {
        if (isReadOnly) return;
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
    }, [isReadOnly]);

    const addNodeWithConnection = (type: NodeType, position: { x: number, y: number }, connectionStart: OnConnectStartParams) => {
        if (isReadOnly) return;
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

        const sourceWidth = sourceNode?.width ?? 250;
        const sourceHeight = sourceNode?.height ?? 100;
        const targetWidth = 250;

        const newNode: Node = {
            id: newNodeId,
            type: 'action',
            position: {
                x: sourceNode
                    ? Math.round((sourceNode.position.x + sourceWidth / 2 - targetWidth / 2) / 10) * 10
                    : Math.round(flowPos.x / 10) * 10,
                y: sourceNode
                    ? Math.round((sourceNode.position.y + sourceHeight + 40) / 10) * 10
                    : Math.round(flowPos.y / 10) * 10
            },
            data: {
                label: type.name,
                params: initialParams
            },
        };

        setNodes((nds) => nds.concat(newNode));

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

    const handleDeleteNode = useCallback((nodeId: string) => {
        if (isReadOnly) return;
        if (nodeId === 'node_start') {
            alert('Cannot delete the Start node. It is required for the workflow.');
            return;
        }
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        setMenu(null);
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [setNodes, setEdges, selectedNodeId, isReadOnly]);

    const handleParamsChange = (nodeId: string, params: any) => {
        if (isReadOnly) return;
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

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setSelectedNodeId(node.id);

        if (!isReadOnly && (event.button === 2 || event.ctrlKey)) {
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
    }, [isReadOnly]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

    return (
        <div className="flex-1 flex overflow-hidden relative">
            <section className="flex-1 bg-[var(--bg-app)] relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onNodeDragStart={() => setMenu(null)}
                    onNodesDelete={() => { setMenu(null); setSelectedNodeId(null); }}
                    onMoveStart={() => setMenu(null)}
                    onPaneClick={() => {
                        setMenu(null);
                        setSelectedNodeId(null);
                    }}
                    nodeTypes={nodeTypesConfig}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    proOptions={{ hideAttribution: true }}
                    snapToGrid={true}
                    snapGrid={[10, 10]}
                    nodesDraggable={!isReadOnly}
                    nodesConnectable={!isReadOnly}
                    elementsSelectable={true}
                >
                    <Background
                        variant={BackgroundVariant.Dots}
                        color="currentColor"
                        gap={20}
                        size={1.5}
                        className="text-[var(--text-muted)] opacity-20 dark:opacity-30"
                    />
                    <Controls className="!bg-surface-800 !border-[var(--border-base)] !rounded-2xl !shadow-2xl !overflow-hidden [&_button]:!border-[var(--border-base)] [&_button]:!bg-transparent [&_button:hover]:!bg-brand/10 [&_svg]:!fill-[var(--text-main)] [&_svg]:!opacity-60" />
                </ReactFlow>

                {addNodeMenu && !isReadOnly && (
                    <AddNodeMenu
                        clientX={addNodeMenu.clientX}
                        clientY={addNodeMenu.clientY}
                        nodeTypes={nodeTypes}
                        onAddNode={(type) => addNodeWithConnection(type, { x: addNodeMenu.x, y: addNodeMenu.y }, addNodeMenu.connectionStart)}
                        onCancel={() => setAddNodeMenu(null)}
                    />
                )}
                {menu && !isReadOnly && (
                    <NodeContextMenu
                        x={menu.x}
                        y={menu.y}
                        nodeId={menu.nodeId}
                        onDelete={handleDeleteNode}
                        onClose={() => setMenu(null)}
                    />
                )}
            </section>

            {selectedNode && (
                <NodeProperties
                    node={selectedNode}
                    nodeTypes={nodeTypes}
                    onChange={handleParamsChange}
                    onClose={() => setSelectedNodeId(null)}
                    isReadOnly={isReadOnly}
                />
            )}
        </div>
    );
}
