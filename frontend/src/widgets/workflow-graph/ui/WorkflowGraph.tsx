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
    type XYPosition
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';

import { NodeContextMenu } from '../../node-context-menu/NodeContextMenu';
import { StartNode } from '../../../entities/node-type/ui/StartNode';
import { DefaultNode } from '../../../entities/node-type/ui/DefaultNode';
import { AddNodeMenu } from '../../add-node-menu';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { useClipboardStore } from '../../../features/workflow-management/model/clipboardStore';

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

// Internal component state will handle viewport tracking via refs
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
    // Instance-specific trackers
    const lastInitializedIdRef = useRef<string | null>(null);
    const viewportCacheRef = useRef<Record<string, { x: number, y: number, zoom: number }>>({});

    const initialNodes = useMemo(() => 
        (workflow?.graph?.nodes || []).map((n: any) => n.type === 'default' ? { ...n, type: 'action' } : n)
    , [workflow?.id]); 

    const [nodes, setNodes, onNodesChangeRaw] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChangeRaw] = useEdgesState(workflow?.graph?.edges || []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const { screenToFlowPosition, setCenter, fitView, setViewport } = useReactFlow();
    const mousePosition = useRef<XYPosition>({ x: 0, y: 0 });
    const { nodes: clipboardNodes, edges: clipboardEdges, center: clipboardCenter, setClipboard } = useClipboardStore();

    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [addNodeMenu, setAddNodeMenu] = useState<{ x: number, y: number, clientX: number, clientY: number, connectionStart: OnConnectStartParams } | null>(null);

    // Initialize workflow data
    useEffect(() => {
        const wf = workflow as any;
        if (!wf || !wf.id) {
            setNodes([]);
            setEdges([]);
            lastInitializedIdRef.current = null;
            return;
        }

        // If this SPECIFIC instance has already initialized this ID, skip to avoid loops
        if (lastInitializedIdRef.current === wf.id) {
            return;
        }

        if (!wf.graph) {
            setNodes([]);
            setEdges([]);
            return;
        }


        const graphNodes = wf.graph.nodes || [];
        const graphEdges = wf.graph.edges || [];

        // Sanitize nodes: ensure EVERY node has a valid numeric x/y position
        const sanitizedNodes = graphNodes.filter((n: any) =>
            n.position &&
            typeof n.position.x === 'number' && !isNaN(n.position.x) &&
            typeof n.position.y === 'number' && !isNaN(n.position.y)
        );

        const loadedNodes = sanitizedNodes.map((n: any) => {
            const base = n.type === 'default' ? { ...n, type: 'action' } : { ...n };
            const ntDef = nodeTypes.find((t: NodeType) => {
                if (base.data?.nodeTypeId && t.id === base.data.nodeTypeId) {
                    return true;
                }
                const nameMatches = t.name.toLowerCase() === (base.data?.nodeType || base.data?.label || '').toLowerCase();
                if (base.data?.category && t.category) {
                    return nameMatches && t.category === base.data.category;
                }
                return nameMatches;
            });
            if (ntDef) {
                const merged = { ...(base.data?.params || {}) };
                if (ntDef.parameters) {
                    ntDef.parameters.forEach((p: any) => {
                        if (merged[p.name] === undefined && p.default !== undefined && p.default !== null) {
                            merged[p.name] = p.default;
                        }
                    });
                }

                const nodeCode = base.data?.code || ntDef.code || '';
                const maxThenMatch = nodeCode.match(/MAX_THEN\s*(?::\s*\w+\s*)?=\s*(\d+)/) || nodeCode.match(/MAX_THAN\s*(?::\s*\w+\s*)?=\s*(\d+)/);
                const defaultOutputMatch = nodeCode.match(/DEFAULT_OUTPUT\s*(?::\s*\w+\s*)?=\s*(true|false|True|False)/);
                const customOutputMatch = nodeCode.match(/CUSTOM_OUTPUT\s*(?::\s*\w+\s*)?=\s*(true|false|True|False)/);

                const extractedMaxThen = maxThenMatch ? parseInt(maxThenMatch[1], 10) : undefined;
                const extractedDefaultOutput = defaultOutputMatch ? (defaultOutputMatch[1].toLowerCase() === 'true') : undefined;
                const extractedCustomOutput = customOutputMatch ? (customOutputMatch[1].toLowerCase() === 'true') : undefined;

                base.data = {
                    ...base.data,
                    params: merged,
                    icon: ntDef.icon || base.data?.icon,
                    extractedMaxThen,
                    extractedDefaultOutput,
                    extractedCustomOutput
                };
            }
            return base;
        });

        setNodes(loadedNodes);
        setEdges(graphEdges);

        console.log('[WorkflowGraph] Initialized workflow:', wf.id);
        const cachedViewport = viewportCacheRef.current[wf.id];
        lastInitializedIdRef.current = wf.id;

        if (!cachedViewport) {
            const timer = setTimeout(() => {
                fitView({ padding: 50 });
                const startNode = loadedNodes.find((n: any) => n.id === 'node_start' || n.type === 'start');
                if (startNode && typeof startNode.position?.x === 'number' && typeof startNode.position?.y === 'number') {
                    if (!isNaN(startNode.position.x) && !isNaN(startNode.position.y)) {
                        setCenter(startNode.position.x + 100, startNode.position.y + 60, { zoom: 0.5, duration: 400 });
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [workflow, setViewport, setCenter, fitView, setNodes, setEdges, nodeTypes]);

    // Downward synchronization: update internal nodes state when workflow.graph.nodes changes externally (e.g. from parameters panel)
    useEffect(() => {
        if (!workflow?.graph?.nodes) return;
        const externalNodes = workflow.graph.nodes;

        setNodes(nds => {
            let hasChanges = false;
            const nextNodes = nds.map(localNode => {
                const externalNode = externalNodes.find((en: any) => en.id === localNode.id);
                if (!externalNode) return localNode;

                // Sync params if changed externally (important for the parameter panel live sync)
                if (JSON.stringify(localNode.data?.params) !== JSON.stringify(externalNode.data?.params)) {
                    hasChanges = true;
                    return {
                        ...localNode,
                        data: {
                            ...localNode.data,
                            params: externalNode.data?.params
                        }
                    };
                }
                return localNode;
            });
            return hasChanges ? nextNodes : nds;
        });
    }, [workflow?.graph?.nodes, setNodes]);

    // Save viewport state on change
    const onMoveEnd = useCallback((_event: any, viewport: { x: number, y: number, zoom: number }) => {
        if (workflow?.id) {
            viewportCacheRef.current[workflow.id] = viewport;
        }
    }, [workflow?.id]);

    const handleCopy = useCallback(() => {
        const selectedNodes = nodes.filter((node) => node.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);

        if (selectedNodes.length === 0) return;

        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 250)));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 100)));

        const center = {
            x: minX + (maxX - minX) / 2,
            y: minY + (maxY - minY) / 2,
        };

        setClipboard(
            selectedNodes.map(n => ({ ...n, selected: false })),
            selectedEdges.map(e => ({ ...e, selected: false })),
            center,
        );
    }, [nodes, edges, setClipboard]);

    const handlePaste = useCallback((useMouse: boolean = true) => {
        if (!clipboardNodes || clipboardNodes.length === 0) return;

        let offset: XYPosition;
        if (useMouse) {
            offset = {
                x: mousePosition.current.x - clipboardCenter.x,
                y: mousePosition.current.y - clipboardCenter.y,
            };
        } else {
            offset = { x: 40, y: 40 };
        }

        const nodeIdMap: Record<string, string> = {};

        const newNodes = (clipboardNodes as any[])
            .filter((node: any) => node.id !== 'node_start' && node.type !== 'start')
            .map((node: any) => {
                const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                nodeIdMap[node.id] = newId;

                return {
                    ...node,
                    id: newId,
                    position: {
                        x: Math.round((node.position.x + offset.x) / 10) * 10,
                        y: Math.round((node.position.y + offset.y) / 10) * 10,
                    },
                    selected: true,
                };
            });

        const newEdges = (clipboardEdges as any[])
            .filter((edge: any) => nodeIdMap[edge.source] && nodeIdMap[edge.target])
            .map((edge: any) => ({
                ...edge,
                id: `e_${nodeIdMap[edge.source]}-${nodeIdMap[edge.target]}-${Date.now()}`,
                source: nodeIdMap[edge.source],
                target: nodeIdMap[edge.target],
                selected: true,
            }));

        const finalNodes = nodes.map(n => ({ ...n, selected: false })).concat(newNodes);
        const finalEdges = edges.map(e => ({ ...e, selected: false })).concat(newEdges);
        
        setNodes(finalNodes);
        setEdges(finalEdges);

        // Notify parent of the new structure immediately
        if (onNodesChangeCallback) onNodesChangeCallback(finalNodes);
        if (onEdgesChangeCallback) onEdgesChangeCallback(finalEdges);
    }, [clipboardNodes, clipboardEdges, clipboardCenter, nodes, edges, setNodes, setEdges, onNodesChangeCallback, onEdgesChangeCallback]);

    useHotkeys([
        { key: 'cmd+c', description: 'Copy Nodes', enabled: nodes.some(n => n.selected), handler: () => handleCopy() },
        { key: 'ctrl+c', description: 'Copy Nodes', enabled: nodes.some(n => n.selected), handler: () => handleCopy() },
        { key: 'cmd+v', description: 'Paste Nodes', enabled: clipboardNodes.length > 0, handler: () => handlePaste() },
        { key: 'ctrl+v', description: 'Paste Nodes', enabled: clipboardNodes.length > 0, handler: () => handlePaste() }
    ], { 
        scopeName: 'Workflow Graph',
        enabled: isHotkeysEnabled && !isReadOnly
    });

    const onMouseMove = useCallback((event: React.MouseEvent) => {
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });
        mousePosition.current = position;
    }, [screenToFlowPosition]);

    const onNodesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        const filteredChanges = changes.filter((change: any) => {
            if (change.type === 'remove' && (change.id === 'node_start' || nodes.find(n => n.id === change.id)?.type === 'start')) {
                return false;
            }
            return true;
        });

        const isRemoved = filteredChanges.some((c: any) => c.type === 'remove' && c.id === selectedNodeId);
        if (isRemoved) {
            setSelectedNodeId(null);
            if (onNodeSelectCallback) onNodeSelectCallback(null);
        }

        // Apply changes locally first
        onNodesChangeRaw(filteredChanges);
        
        // Notify parent directly in the next tick to avoid render-phase updates
        setTimeout(() => {
            setNodes(currentNodes => {
                if (onNodesChangeCallback) onNodesChangeCallback(currentNodes);
                return currentNodes;
            });
        }, 0);
    }, [onNodesChangeRaw, nodes, selectedNodeId, isReadOnly, onNodeSelectCallback, onNodesChangeCallback, setNodes]);

    const onEdgesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        
        // Apply changes locally
        onEdgesChangeRaw(changes);

        // Notify parent in next tick
        setTimeout(() => {
            setEdges(currentEdges => {
                if (onEdgesChangeCallback) onEdgesChangeCallback(currentEdges);
                return currentEdges;
            });
        }, 0);
    }, [onEdgesChangeRaw, isReadOnly, onEdgesChangeCallback, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => {
            if (isReadOnly) return;
            if (params.source === params.target) return;

            const newEdgeParams: Edge = {
                ...params,
                source: params.source || '',
                target: params.target || '',
                id: `e_${params.source}-${params.target}-${Date.now()}`,
                targetHandle: params.targetHandle || 'top',
                sourceHandle: params.sourceHandle || 'output'
            };
            
            setEdges((eds) => {
                const nextEdges = addEdge(newEdgeParams, eds);
                if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
                return nextEdges;
            });
            (window as any)._connectionEstablished = true;
        },
        [setEdges, isReadOnly, onEdgesChangeCallback]
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
            setAddNodeMenu({
                x: event.clientX,
                y: event.clientY,
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

        const isProvider = !!(type as any).isRightInputProvider;
        const nodeWidth = isProvider ? 70 : 250;
        const newNodeId = `node_${Date.now()}`;

        const flowPos = screenToFlowPosition({
            x: position.x - (nodeWidth / 2),
            y: position.y
        });

        const newNode: Node = {
            id: newNodeId,
            type: 'action',
            position: {
                x: Math.round(flowPos.x / 10) * 10,
                y: Math.round(flowPos.y / 10) * 10
            },
            data: {
                nodeTypeId: type.id,
                label: type.name,
                category: type.category,
                params: initialParams,
                icon: type.icon
            },
        };

        setNodes((nds) => {
            const nextNodes = nds.concat(newNode);
            if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
            return nextNodes;
        });

        if (connectionStart.nodeId) {
            let newEdge: any;
            if (connectionStart.handleType === 'target') {
                newEdge = {
                    id: `e_${newNodeId}-${connectionStart.nodeId}`,
                    source: newNodeId,
                    sourceHandle: 'output',
                    target: connectionStart.nodeId,
                    targetHandle: connectionStart.handleId,
                };
            } else {
                newEdge = {
                    id: `e_${connectionStart.nodeId}-${newNodeId}`,
                    source: connectionStart.nodeId,
                    sourceHandle: connectionStart.handleId,
                    target: newNodeId,
                    targetHandle: 'top',
                };
            }
            setEdges((eds) => {
                const nextEdges = addEdge(newEdge, eds);
                if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
                return nextEdges;
            });
        }

        setAddNodeMenu(null);
    };

    const handleDeleteNode = useCallback((nodeId: string) => {
        if (isReadOnly) return;
        if (nodeId === 'node_start') {
            alert('Cannot delete the Start node. It is required for the workflow.');
            return;
        }
        setNodes((nds) => {
            const nextNodes = nds.filter((node) => node.id !== nodeId);
            if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
            return nextNodes;
        });
        setEdges((eds) => {
            const nextEdges = eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
            if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
            return nextEdges;
        });
        setMenu(null);
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [setNodes, setEdges, selectedNodeId, isReadOnly, onNodesChangeCallback, onEdgesChangeCallback]);


    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (!isReadOnly && event.altKey) {
            event.stopPropagation();
            event.preventDefault();
            setEdges((eds) => {
                const nextEdges = eds.filter(e => !(e.target === node.id && (e.targetHandle === 'top' || !e.targetHandle)));
                if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
                return nextEdges;
            });
            return;
        }

        if (!isReadOnly && event.button === 2) {
            event.stopPropagation();
            event.preventDefault();
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

        setSelectedNodeId(node.id);
        if (onNodeSelectCallback) onNodeSelectCallback(node);
    }, [isReadOnly, setEdges, onNodeSelectCallback, onEdgesChangeCallback]);

    const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
        if (selectedNodes.length !== 1) {
            setSelectedNodeId(null);
            if (onNodeSelectCallback) onNodeSelectCallback(null);
        } else {
            const node = selectedNodes[0];
            setSelectedNodeId(node.id);
            if (onNodeSelectCallback) onNodeSelectCallback(node);
        }
    }, [onNodeSelectCallback]);


    const rightConnectedSources = new Set(
        edges.filter(e => e.targetHandle && e.targetHandle !== 'null' && e.targetHandle !== 'top')
            .map(e => e.source)
    );

    const renderedNodes = useMemo(() => nodes.map(node => {
        const ntDef = nodeTypes.find((t: NodeType) => {
            if (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) {
                return true;
            }
            const nameMatches = t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase();
            if (node.data?.category && t.category) {
                return nameMatches && t.category === node.data.category;
            }
            return nameMatches;
        });
        const maxThenParam = ntDef?.parameters?.find((p: any) => p.name === 'MAX_THEN' || p.name === 'MAX_THAN');
        const maxThen = node.data?.params?.MAX_THEN ?? node.data?.params?.maxThen ?? node.data?.params?.MAX_THAN ?? node.data?.params?.maxThan ?? maxThenParam?.default ?? 0;

        const inputs = ntDef?.input_schema?.inputs || [];

        return {
            ...node,
            data: {
                ...node.data,
                label: ntDef?.name || node.data?.label,
                isActive: activeNodeIds.includes(node.id),
                maxThen: Number(maxThen),
                inputs: inputs,
                icon: ntDef?.icon || node.data?.icon,
                isRightInputProvider: rightConnectedSources.has(node.id)
            }
        };
    }), [nodes, nodeTypes, activeNodeIds, rightConnectedSources]);

    const isLoading = !workflow || !(workflow as any).graph;

    const onFitView = useCallback(() => {
        fitView({ padding: 50 });
    }, [fitView]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative w-full h-full min-h-0">
            <section className="flex-1 bg-[var(--bg-app)] relative w-full h-full min-h-0">
                <ReactFlow
                    nodes={renderedNodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onNodeDoubleClick={(event, node) => {
                        if (onNodeDoubleClickCallback) onNodeDoubleClickCallback(event, node);
                    }}
                    onMouseMove={onMouseMove}
                    onNodeDragStart={() => setMenu(null)}
                    onNodesDelete={() => { setMenu(null); setSelectedNodeId(null); }}
                    onMoveStart={() => setMenu(null)}
                    onMoveEnd={onMoveEnd}
                    onPaneClick={() => {
                        setMenu(null);
                        setSelectedNodeId(null);
                        if (onNodeSelectCallback) onNodeSelectCallback(null);
                    }}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypesConfig}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    proOptions={{ hideAttribution: true }}
                    defaultViewport={workflow?.id ? viewportCacheRef.current[workflow.id] : undefined}
                    snapToGrid={true}
                    snapGrid={[10, 10]}
                    nodesDraggable={!isReadOnly}
                    nodesConnectable={!isReadOnly}
                    elementsSelectable={true}
                    panOnDrag={!isSelectionMode}
                    selectionOnDrag={true}
                    selectionKeyCode={isSelectionMode ? null : 'Shift'}
                    multiSelectionKeyCode="Shift"
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                        event.preventDefault();
                        if (isReadOnly) return;

                        const typeJson = event.dataTransfer.getData('application/reactflow');
                        if (!typeJson) return;

                        const type = JSON.parse(typeJson) as NodeType;
                        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

                        const nodeUnder = nodes.find(n => {
                            const nodeWidth = n.width || 250;
                            const nodeHeight = n.height || 100;
                            return (
                                flowPos.x >= n.position.x &&
                                flowPos.x <= n.position.x + nodeWidth &&
                                flowPos.y >= n.position.y &&
                                flowPos.y <= n.position.y + nodeHeight
                            );
                        });

                        const newNodeId = `node_${Date.now()}`;
                        const initialParams: Record<string, any> = {};
                        if (type.parameters) {
                            type.parameters.forEach((param: any) => {
                                if (param.default !== undefined && param.default !== null) {
                                    initialParams[param.name] = param.default;
                                }
                            });
                        }

                        let newNode: Node;

                        if (nodeUnder) {
                            const nodeHeight = nodeUnder.height || 100;
                            const verticalGap = 60;
                            
                            newNode = {
                                id: newNodeId,
                                type: 'action',
                                position: {
                                    x: nodeUnder.position.x,
                                    y: nodeUnder.position.y + nodeHeight + verticalGap
                                },
                                data: {
                                    nodeTypeId: type.id,
                                    label: type.name,
                                    category: type.category,
                                    params: initialParams,
                                    icon: type.icon
                                },
                            };

                            const newEdge: Edge = {
                                id: `e_${nodeUnder.id}-${newNodeId}`,
                                source: nodeUnder.id,
                                sourceHandle: 'output',
                                target: newNodeId,
                                targetHandle: 'top',
                            };

                            setNodes((nds) => {
                                const nextNodes = nds.concat(newNode);
                                if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
                                return nextNodes;
                            });
                            setEdges((eds) => {
                                const nextEdges = addEdge(newEdge, eds);
                                if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
                                return nextEdges;
                            });
                        } else {
                            newNode = {
                                id: newNodeId,
                                type: 'action',
                                position: {
                                    x: Math.round((flowPos.x - 125) / 10) * 10,
                                    y: Math.round((flowPos.y - 50) / 10) * 10
                                },
                                data: {
                                    nodeTypeId: type.id,
                                    label: type.name,
                                    category: type.category,
                                    params: initialParams,
                                    icon: type.icon
                                },
                            };
                            setNodes((nds) => {
                                const nextNodes = nds.concat(newNode);
                                if (onNodesChangeCallback) onNodesChangeCallback(nextNodes);
                                return nextNodes;
                            });
                        }
                    }}
                >
                    <Panel position="top-left" className="flex flex-col gap-4 mt-2">
                        <div className="bg-surface-800 border-[var(--border-base)] rounded-xl p-1 shadow-2xl flex gap-1 ml-4">
                            <button
                                onClick={() => setIsSelectionMode(false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${!isSelectionMode ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                                title="Move tool"
                            >
                                Move
                            </button>
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${isSelectionMode ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                                title="Selection tool"
                            >
                                Select
                            </button>
                            <div className="w-[1px] h-4 bg-[var(--border-base)] mx-1 self-center" />
                            <button
                                onClick={handleCopy}
                                disabled={!nodes.some(n => n.selected)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Copy selected nodes"
                            >
                                Copy
                            </button>
                            <button
                                onClick={() => handlePaste(false)}
                                disabled={clipboardNodes.length === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Paste nodes nearby"
                            >
                                Paste
                            </button>
                            <div className="w-[1px] h-4 bg-[var(--border-base)] mx-1 self-center" />
                            <button
                                onClick={onFitView}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 text-[var(--text-muted)] hover:bg-white/5"
                                title="Fit view (F)"
                            >
                                Fit
                            </button>
                        </div>
                    </Panel>
                    <Background
                        variant={BackgroundVariant.Dots}
                        color="currentColor"
                        gap={20}
                        size={2.1}
                        className="text-[var(--text-muted)] opacity-25 dark:opacity-35"
                    />
                    <Controls
                        showInteractive={false}
                        className="!bg-surface-800 !border-[var(--border-base)] !rounded-2xl !shadow-2xl !overflow-hidden [&_button]:!border-[var(--border-base)] [&_button]:!bg-transparent [&_button:hover]:!bg-brand/10 [&_svg]:!fill-[var(--text-main)] [&_svg]:!opacity-60 !bottom-[25px]"
                    />
                </ReactFlow>

                {isLoading && (
                    <div className="absolute inset-0 z-[10] flex items-center justify-center bg-[var(--bg-app)]/50 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin shadow-lg shadow-brand/20"></div>
                            <p className="text-sm font-bold text-[var(--text-main)] opacity-70 animate-pulse uppercase tracking-[0.2em]">Loading graph data...</p>
                        </div>
                    </div>
                )}

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
                        onDisconnectInput={(id) => {
                            setEdges((eds) => {
                                const nextEdges = eds.filter(e => !(e.target === id && (e.targetHandle === 'top' || !e.targetHandle)));
                                if (onEdgesChangeCallback) onEdgesChangeCallback(nextEdges);
                                return nextEdges;
                            });
                        }}
                        onClose={() => setMenu(null)}
                    />
                )}
            </section>
        </div>
    );
});
