import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    useReactFlow,
    Panel,
    type Node,
    type Edge,
    type Connection,
    type OnConnectStartParams,
    type XYPosition,
    SelectionMode,
    applyNodeChanges,
    applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';

import { NodeContextMenu } from '../../node-context-menu/NodeContextMenu';
import { StartNode } from '../../../entities/node-type/ui/StartNode';
import { DefaultNode } from '../../../entities/node-type/ui/DefaultNode';
import { AddNodeMenu } from '../../add-node-menu';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '../../../shared/lib/hotkeys/HotkeysContext';
import { useClipboardStore } from '../../../features/workflow-management/model/clipboardStore';
import { useViewportStore } from '../../../features/workflow-management/model/viewportStore';

const nodeTypesConfig = {
    start: StartNode,
    action: DefaultNode,
    default: DefaultNode,
    regular: DefaultNode,
    conditional: DefaultNode,
    special: DefaultNode,
    agent: DefaultNode,
    provider: DefaultNode,
};

interface WorkflowGraphProps {
    workflow: Workflow | null;
    nodeTypes: NodeType[];
    isReadOnly?: boolean;
    onNodesChangeCallback?: (nodes: Node[]) => void;
    onEdgesChangeCallback?: (edges: Edge[]) => void;
    onNodeDoubleClickCallback?: (event: React.MouseEvent, node: Node) => void;
    onNodeSelectCallback?: (node: Node | null) => void;
    activeNodeIds?: string[];
    isHotkeysEnabled?: boolean;
}

export const WorkflowGraph = React.memo(({
    workflow,
    nodeTypes,
    isReadOnly = false,
    onNodesChangeCallback,
    onEdgesChangeCallback,
    onNodeDoubleClickCallback,
    onNodeSelectCallback,
    activeNodeIds = [],
    isHotkeysEnabled = true
}: WorkflowGraphProps) => {
    const lastInitializedIdRef = useRef<string | null>(null);
    const nodesRefInternal = useRef<Node[]>([]);
    const edgesRefInternal = useRef<Edge[]>([]);

    const initialNodes = useMemo(() => 
        (workflow?.graph?.nodes || []).map((n: any) => n.type === 'default' ? { ...n, type: 'action' } : n)
    , [workflow?.id]); 

    const [nodes, setNodes] = useNodesState(initialNodes);
    const [edges, setEdges] = useEdgesState(workflow?.graph?.edges || []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSelectionMode] = useState(false);
    const { screenToFlowPosition, fitView } = useReactFlow();
    const mousePosition = useRef<XYPosition>({ x: 0, y: 0 });
    const { nodes: clipboardNodes, edges: clipboardEdges, center: clipboardCenter, setClipboard } = useClipboardStore();
    const setPersistentViewport = useViewportStore(state => state.setViewport);

    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [addNodeMenu, setAddNodeMenu] = useState<{ x: number, y: number, clientX: number, clientY: number, connectionStart: OnConnectStartParams } | null>(null);

    // Initialization logic: ONLY on ID change
    useEffect(() => {
        if (!workflow?.id) {
            setNodes([]);
            setEdges([]);
            lastInitializedIdRef.current = null;
            return;
        }

        // Check if we need to re-initialize nodes even if ID hasn't changed.
        // This happens right after workflow creation where we might have a skeleton object first.
        const needsDataSync = lastInitializedIdRef.current === workflow.id && 
                            nodes.length === 0 && 
                            (workflow.graph?.nodes?.length || 0) > 0;

        if (lastInitializedIdRef.current === workflow.id && !needsDataSync) return;

        console.log('[WorkflowGraph] Initializing workflow data:', workflow.id, 'needsSync:', needsDataSync);
        const graphNodes = (workflow.graph?.nodes || []).map((n: any) => {
            const base = n.type === 'default' ? { ...n, type: 'action' } : { ...n };
            const ntDef = nodeTypes.find(t => t.id === base.data?.nodeTypeId || t.name === base.data?.label);
            if (ntDef) {
                const merged = { ...(base.data?.params || {}) };
                ntDef.parameters?.forEach(p => {
                    if (merged[p.name] === undefined && p.default !== undefined) merged[p.name] = p.default;
                });
                base.data = { ...base.data, params: merged, icon: ntDef.icon || base.data?.icon };
            }
            return base;
        });

        const graphEdges = workflow.graph?.edges || [];

        setNodes(graphNodes);
        setEdges(graphEdges);
        nodesRefInternal.current = graphNodes;
        edgesRefInternal.current = graphEdges;
        lastInitializedIdRef.current = workflow?.id;
    }, [workflow?.id, workflow?.graph?.nodes, setNodes, setEdges, nodeTypes, nodes.length]);

    // Compute initial viewport once per workflow ID TO avoid blinking
    const initialViewport = useMemo(() => {
        if (!workflow?.id) return { x: 0, y: 0, zoom: 1 };
        const storeViewports = useViewportStore.getState().viewports;
        return storeViewports[workflow.id] || workflow.workflow_data?.viewport || { x: 0, y: 0, zoom: 1 };
    }, [workflow?.id]);

    // Fallback fitView only if NO viewport exists
    useEffect(() => {
        if (!workflow?.id) return;
        const storeViewports = useViewportStore.getState().viewports;
        if (!storeViewports[workflow.id] && !workflow.workflow_data?.viewport) {
             const timer = setTimeout(() => fitView({ padding: 50 }), 100);
             return () => clearTimeout(timer);
        }
    }, [workflow?.id, fitView]);

    // Targeted Parameter Sync: 
    // This allows sidebar edits to show up on the graph WITHOUT resetting the entire graph structure.
    useEffect(() => {
        if (!workflow?.graph?.nodes || !lastInitializedIdRef.current) return;
        const externalNodes = workflow.graph.nodes;

        setNodes(nds => {
            let hasChanges = false;
            const next = nds.map(local => {
                const external = externalNodes.find((en: any) => en.id === local.id);
                if (!external) return local; // Keep local nodes that are not in the master graph (drafts)
                
                const localParamsStr = JSON.stringify(local.data?.params);
                const externalParamsStr = JSON.stringify(external.data?.params);

                if (localParamsStr !== externalParamsStr) {
                    hasChanges = true;
                    // MERGE ONLY THE PARAMS. Do NOT merge type, label, or position from props while editing.
                    return { ...local, data: { ...local.data, params: external.data?.params } };
                }
                return local;
            });

            if (hasChanges) {
                nodesRefInternal.current = next;
                onNodesChangeCallback?.(next); // Sync back to Ref
                return next;
            }
            return nds;
        });
    }, [workflow?.graph?.nodes, setNodes, onNodesChangeCallback]);

    // Synchronous state propagation to parent Ref
    const notifyNodesChange = useCallback((nextNodes: Node[]) => {
        nodesRefInternal.current = nextNodes;
        onNodesChangeCallback?.(nextNodes);
    }, [onNodesChangeCallback]);

    const notifyEdgesChange = useCallback((nextEdges: Edge[]) => {
        edgesRefInternal.current = nextEdges;
        onEdgesChangeCallback?.(nextEdges);
    }, [onEdgesChangeCallback]);

    const onNodesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        setNodes(nds => {
            const filtered = changes.filter((c: any) => !(c.type === 'remove' && (c.id === 'node_start' || nds.find(n => n.id === c.id)?.type === 'start')));
            const next = applyNodeChanges(filtered, nds);
            
            if (filtered.some((c: any) => c.type === 'remove' && c.id === selectedNodeId)) {
                setSelectedNodeId(null);
                onNodeSelectCallback?.(null);
            }

            notifyNodesChange(next);
            return next;
        });
    }, [isReadOnly, selectedNodeId, onNodeSelectCallback, setNodes, notifyNodesChange]);

    const onEdgesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        setEdges(eds => {
            const next = applyEdgeChanges(changes, eds);
            notifyEdgesChange(next);
            return next;
        });
    }, [isReadOnly, setEdges, notifyEdgesChange]);

    const onConnect = useCallback((params: Connection) => {
        if (isReadOnly) return;
        const newEdge = { ...params, id: `e_${params.source}-${params.target}`, sourceHandle: params.sourceHandle || 'output' };
        setEdges(eds => {
            const next = addEdge(newEdge, eds);
            notifyEdgesChange(next);
            return next;
        });
        (window as any)._connectionEstablished = true;
    }, [isReadOnly, setEdges, notifyEdgesChange]);

    const onMoveEnd = useCallback((_: any, viewport: { x: number, y: number, zoom: number }) => {
        if (workflow?.id) {
            // Update Zustand store for persistence
            setPersistentViewport(workflow.id, viewport);
        }
    }, [workflow?.id, setPersistentViewport]);

    const handleCopy = useCallback(() => {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        if (!selectedNodes.length) return;

        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 250)));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 100)));

        setClipboard(
            selectedNodes.map(n => ({ ...n, selected: false })),
            selectedEdges.map(e => ({ ...e, selected: false })),
            { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 }
        );
    }, [nodes, edges, setClipboard]);

    const handlePaste = useCallback((useMouse = true) => {
        if (!clipboardNodes?.length) return;
        const offset = useMouse 
            ? { x: mousePosition.current.x - clipboardCenter.x, y: mousePosition.current.y - clipboardCenter.y }
            : { x: 40, y: 40 };

        const nodeIdMap: Record<string, string> = {};
        const newNodes = clipboardNodes
            .filter(n => n.id !== 'node_start' && n.type !== 'start')
            .map((node: any) => {
                const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                nodeIdMap[node.id] = newId;
                return { ...node, id: newId, position: { x: node.position.x + offset.x, y: node.position.y + offset.y }, selected: true };
            });

        const newEdges = (clipboardEdges || [])
            .filter(e => nodeIdMap[e.source] && nodeIdMap[e.target])
            .map(edge => ({
                ...edge,
                id: `e_${nodeIdMap[edge.source]}-${nodeIdMap[edge.target]}`,
                source: nodeIdMap[edge.source],
                target: nodeIdMap[edge.target],
                selected: true
            }));

        setNodes(nds => {
            const next = nds.map(n => ({ ...n, selected: false })).concat(newNodes);
            notifyNodesChange(next);
            return next;
        });
        setEdges(eds => {
            const next = eds.map(e => ({ ...e, selected: false })).concat(newEdges);
            notifyEdgesChange(next);
            return next;
        });
    }, [clipboardNodes, clipboardEdges, clipboardCenter, setNodes, setEdges, notifyNodesChange, notifyEdgesChange]);

    const handleDeleteSelected = useCallback(() => {
        if (isReadOnly) return;
        const selectedNds = nodes.filter(n => n.selected && n.id !== 'node_start' && n.type !== 'start');
        const selectedEds = edges.filter(e => e.selected);
        
        if (selectedNds.length === 0 && selectedEds.length === 0) return;

        const selectedNodeIds = selectedNds.map(n => n.id);
        const selectedEdgeIds = selectedEds.map(e => e.id);

        setNodes(nds => {
            const next = nds.filter(n => !selectedNodeIds.includes(n.id));
            if (next.length !== nds.length) notifyNodesChange(next);
            return next;
        });

        setEdges(eds => {
            const next = eds.filter(e => 
                !selectedEdgeIds.includes(e.id) &&
                !selectedNodeIds.includes(e.source) && 
                !selectedNodeIds.includes(e.target)
            );
            if (next.length !== eds.length) notifyEdgesChange(next);
            return next;
        });

        if (selectedNodeIds.includes(selectedNodeId as string)) {
            setSelectedNodeId(null);
            onNodeSelectCallback?.(null);
        }
        setMenu(null);
    }, [isReadOnly, nodes, edges, selectedNodeId, onNodeSelectCallback, notifyNodesChange, notifyEdgesChange]);

    const handleDeleteNode = useCallback((nodeId: string) => {
        if (isReadOnly || nodeId === 'node_start') return;
        setNodes(nds => {
            const next = nds.filter(n => n.id !== nodeId);
            notifyNodesChange(next);
            return next;
        });
        setEdges(eds => {
            const next = eds.filter(e => e.source !== nodeId && e.target !== nodeId);
            notifyEdgesChange(next);
            return next;
        });
        setMenu(null);
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
            onNodeSelectCallback?.(null);
        }
    }, [isReadOnly, setNodes, setEdges, selectedNodeId, onNodeSelectCallback, notifyNodesChange, notifyEdgesChange]);

    const onDisconnectInput = useCallback((nodeId: string) => {
        if (isReadOnly) return;
        setEdges(eds => {
            const next = eds.filter(e => e.target !== nodeId);
            notifyEdgesChange(next);
            return next;
        });
    }, [isReadOnly, setEdges, notifyEdgesChange]);

    const hasSelection = useMemo(() => 
        nodes.some(n => n.selected) || edges.some(e => e.selected)
    , [nodes, edges]);

    const hasClipboard = useMemo(() => 
        clipboardNodes.length > 0
    , [clipboardNodes]);

    useHotkeys([
        { 
            key: 'cmd+c', 
            description: 'Copy', 
            handler: handleCopy, 
            enabled: isHotkeysEnabled && !isReadOnly && hasSelection 
        },
        { 
            key: 'ctrl+c', 
            description: 'Copy', 
            handler: handleCopy, 
            enabled: isHotkeysEnabled && !isReadOnly && hasSelection 
        },
        { 
            key: 'cmd+v', 
            description: 'Paste', 
            handler: () => handlePaste(true), 
            enabled: isHotkeysEnabled && !isReadOnly && hasClipboard 
        },
        { 
            key: 'ctrl+v', 
            description: 'Paste', 
            handler: () => handlePaste(true), 
            enabled: isHotkeysEnabled && !isReadOnly && hasClipboard 
        },
        { 
            key: 'backspace', 
            description: 'Delete', 
            handler: handleDeleteSelected, 
            enabled: isHotkeysEnabled && !isReadOnly && hasSelection 
        },
        { 
            key: 'delete', 
            description: 'Delete', 
            handler: handleDeleteSelected, 
            enabled: isHotkeysEnabled && !isReadOnly && hasSelection 
        },
    ], { 
        scopeName: `workflow-${workflow?.id}`, 
        enabled: isHotkeysEnabled,
        level: HOTKEY_LEVEL.FRAGMENT
    });

    const onMouseMove = useCallback((event: React.MouseEvent) => {
        mousePosition.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    }, [screenToFlowPosition]);

    const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
        if (isReadOnly) return;
        (window as any)._lastConnectStartParams = params;
        (window as any)._connectionEstablished = false;
    }, [isReadOnly]);

    const onConnectEnd = useCallback((event: any) => {
        if (isReadOnly) return;
        if (!(window as any)._connectionEstablished && (window as any)._lastConnectStartParams) {
            setAddNodeMenu({ 
                x: event.clientX, 
                y: event.clientY, 
                clientX: event.clientX, 
                clientY: event.clientY, 
                connectionStart: (window as any)._lastConnectStartParams 
            });
        }
    }, [isReadOnly]);

    const addNodeWithConnection = (type: NodeType, position: { x: number, y: number }, connectionStart: OnConnectStartParams) => {
        const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const flowPos = screenToFlowPosition({ x: position.x - 125, y: position.y });
        const initialParams = (type.parameters || []).reduce((acc: any, p: any) => {
            if (p.default !== undefined) acc[p.name] = p.default;
            return acc;
        }, {});

        const newNode: Node = {
            id: newNodeId,
            type: 'action',
            position: { x: Math.round(flowPos.x / 10) * 10, y: Math.round(flowPos.y / 10) * 10 },
            data: { nodeTypeId: type.id, label: type.name, category: type.category, params: initialParams, icon: type.icon },
        };

        setNodes(nds => {
            const next = nds.concat(newNode);
            notifyNodesChange(next);
            return next;
        });

        if (connectionStart.nodeId) {
            const newEdge = connectionStart.handleType === 'target' 
                ? { id: `e_${newNodeId}-${connectionStart.nodeId}`, source: newNodeId, target: connectionStart.nodeId, targetHandle: connectionStart.handleId }
                : { id: `e_${connectionStart.nodeId}-${newNodeId}`, source: connectionStart.nodeId, sourceHandle: connectionStart.handleId, target: newNodeId, targetHandle: 'top' };
            setEdges(eds => {
                const next = addEdge(newEdge, eds);
                notifyEdgesChange(next);
                return next;
            });
        }
        setAddNodeMenu(null);
    };

    const renderedNodes = useMemo(() => {
        return nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                isExecuting: activeNodeIds.includes(node.id),
                isRightInputProvider: !!nodeTypes.find(t => t.id === node.data?.nodeTypeId && (t as any).isRightInputProvider)
            }
        }));
    }, [nodes, nodeTypes, activeNodeIds]);

    if (!workflow) return <div className="flex items-center justify-center h-full text-slate-500">No workflow data</div>;

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }} onMouseMove={onMouseMove}>
            <ReactFlow
                key={workflow?.id || 'empty'}
                nodes={renderedNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeClick={(e, node) => { 
                    if (e.altKey) {
                        e.preventDefault();
                        onDisconnectInput(node.id);
                    } else {
                        setSelectedNodeId(node.id); 
                        onNodeSelectCallback?.(node); 
                    }
                }}
                onPaneClick={() => { setSelectedNodeId(null); onNodeSelectCallback?.(null); setMenu(null); }}
                onNodeDoubleClick={onNodeDoubleClickCallback}
                onNodeContextMenu={(e, n) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, nodeId: n.id }); }}
                onMoveEnd={onMoveEnd}
                nodeTypes={nodeTypesConfig}
                defaultViewport={initialViewport}
                fitView={!initialViewport || (initialViewport.x === 0 && initialViewport.y === 0 && initialViewport.zoom === 1)}
                snapToGrid={true}
                snapGrid={[10, 10]}
                selectionMode={isSelectionMode ? SelectionMode.Full : SelectionMode.Partial}
                selectionKeyCode="Shift"
                multiSelectionKeyCode="Shift"
                panOnDrag={!isSelectionMode}
                selectNodesOnDrag={!isSelectionMode}
                deleteKeyCode={null}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Controls />
                <Panel position="top-right"><div/></Panel>
            </ReactFlow>

            {menu && (
                <NodeContextMenu
                    x={menu.x}
                    y={menu.y}
                    nodeId={menu.nodeId}
                    onClose={() => setMenu(null)}
                    onDelete={() => handleDeleteNode(menu.nodeId)}
                    onDisconnectInput={() => onDisconnectInput(menu.nodeId)}
                />
            )}

            {addNodeMenu && (
                <AddNodeMenu
                    clientX={addNodeMenu.clientX}
                    clientY={addNodeMenu.clientY}
                    nodeTypes={nodeTypes}
                    onCancel={() => setAddNodeMenu(null)}
                    onAddNode={(type) => addNodeWithConnection(type, { x: addNodeMenu.clientX, y: addNodeMenu.clientY }, addNodeMenu.connectionStart)}
                />
            )}
        </div>
    );
});
WorkflowGraph.displayName = 'WorkflowGraph';
