/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    useReactFlow,
    Panel,
} from 'reactflow';
import type {
    Node,
    Edge,
    Connection,
    OnConnectStartParams,
    XYPosition
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';

import { NodeContextMenu } from '../../node-context-menu/NodeContextMenu';
import { StartNode } from '../../../entities/node-type/ui/StartNode';
import { DefaultNode } from '../../../entities/node-type/ui/DefaultNode';
import { AddNodeMenu } from '../../add-node-menu';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';

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

// Global trackers to survive component remounts (e.g. when returning from NodeType editor).
let globalLastCenteredWorkflowId: string | null = null;
const globalViewportCache: Record<string, { x: number, y: number, zoom: number }> = {};

interface WorkflowGraphProps {
    workflow: Workflow | null;
    nodeTypes: NodeType[];
    isReadOnly?: boolean;
    onNodesChangeCallback?: (nodes: Node[]) => void;
    onEdgesChangeCallback?: (edges: Edge[]) => void;
    onNodeDoubleClickCallback?: (event: React.MouseEvent, node: Node) => void;
    onNodeSelectCallback?: (node: Node | null) => void;
    activeNodeIds?: string[];
}

export function WorkflowGraph({
    workflow,
    nodeTypes,
    isReadOnly = false,
    onNodesChangeCallback,
    onEdgesChangeCallback,
    onNodeDoubleClickCallback,
    onNodeSelectCallback,
    activeNodeIds = []
}: WorkflowGraphProps) {
    const initialNodes = (workflow?.graph?.nodes || []).map((n: any) => n.type === 'default' ? { ...n, type: 'action' } : n);
    const [nodes, setNodes, onNodesChangeRaw] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChangeRaw] = useEdgesState(workflow?.graph?.edges || []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const { screenToFlowPosition, setCenter, fitView, setViewport } = useReactFlow();
    const mousePosition = React.useRef<XYPosition>({ x: 0, y: 0 });
    const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[], center: XYPosition } | null>(null);

    console.log('[WorkflowGraph] Rendering. Workflow ID:', workflow?.id, 'Node count:', nodes.length, 'Edge count:', edges.length);

    const [menu, setMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
    const [addNodeMenu, setAddNodeMenu] = useState<{ x: number, y: number, clientX: number, clientY: number, connectionStart: OnConnectStartParams } | null>(null);

    // Load workflow data
    useEffect(() => {
        const wf = workflow as any;
        if (!wf || !wf.id) {
            setNodes([]);
            setEdges([]);
            globalLastCenteredWorkflowId = null;
            return;
        }

        const hasNodes = nodes.length > 0;
        const isSameWorkflow = globalLastCenteredWorkflowId === wf.id;

        if (isSameWorkflow && hasNodes) {
            // Even if same workflow, check if props have different count (e.g. node added externally)
            if (nodes.length === (wf.graph?.nodes?.length || 0) && edges.length === (wf.graph?.edges?.length || 0)) {
                return;
            }
        }

        if (!wf.graph) {
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

        // Only center/fit the viewport when switching to a DIFFERENT workflow AND we have no cache.
        if (globalLastCenteredWorkflowId !== wf.id) {
            console.log('[WorkflowGraph] Workflow ID changed from', globalLastCenteredWorkflowId, 'to', wf.id);
            const cachedViewport = globalViewportCache[wf.id];
            
            // Mark as centered/loaded IMMEDIATELY
            globalLastCenteredWorkflowId = wf.id;
            
            if (!cachedViewport) {
                console.log('[WorkflowGraph] No cached viewport, fitting view...');
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
        }
    }, [workflow?.id, workflow?.graph, setViewport, setCenter, fitView, setNodes, setEdges, nodeTypes]);

    // Downward synchronization: update internal nodes state when workflow.graph.nodes changes externally (e.g. from parameters panel)
    useEffect(() => {
        if (!workflow?.graph?.nodes) return;
        const externalNodes = workflow.graph.nodes;
        
        setNodes(nds => {
            let hasChanges = false;
            const nextNodes = nds.map(localNode => {
                const externalNode = externalNodes.find((en: any) => en.id === localNode.id);
                if (!externalNode) return localNode;

                // If params changed externally, sync them to local state
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
            globalViewportCache[workflow.id] = viewport;
        }
    }, [workflow?.id]);

    // Propagate changes up — use a ref to prevent infinite loops if callbacks trigger parent re-renders
    const lastNodesRef = React.useRef<string>('');
    useEffect(() => {
        const nodesStr = JSON.stringify(nodes.map(n => ({ 
            id: n.id, 
            position: n.position, 
            nodeTypeId: n.data?.nodeTypeId,
            selected: n.selected
        })));
        if (nodesStr !== lastNodesRef.current) {
            lastNodesRef.current = nodesStr;
            if (onNodesChangeCallback) onNodesChangeCallback(nodes);
        }
    }, [nodes, onNodesChangeCallback]);

    const lastEdgesRef = React.useRef<string>('');
    useEffect(() => {
        const edgesStr = JSON.stringify(edges.map(e => ({ 
            id: e.id, 
            source: e.source, 
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
        })));
        if (edgesStr !== lastEdgesRef.current) {
            lastEdgesRef.current = edgesStr;
            if (onEdgesChangeCallback) onEdgesChangeCallback(edges);
        }
    }, [edges, onEdgesChangeCallback]);

    const handleCopy = useCallback(() => {
        const selectedNodes = nodes.filter((node) => node.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);

        if (selectedNodes.length === 0) return;

        // Calculate center of selected nodes
        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 250)));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 100)));

        const center = {
            x: minX + (maxX - minX) / 2,
            y: minY + (maxY - minY) / 2,
        };

        setClipboard({
            nodes: selectedNodes.map(n => ({ ...n, selected: false })),
            edges: selectedEdges.map(e => ({ ...e, selected: false })),
            center,
        });
    }, [nodes, edges]);

    const handlePaste = useCallback((useMouse: boolean = true) => {
        if (!clipboard) return;

        let offset: XYPosition;
        if (useMouse) {
            offset = {
                x: mousePosition.current.x - clipboard.center.x,
                y: mousePosition.current.y - clipboard.center.y,
            };
        } else {
            // Paste nearby (offset from original position)
            offset = { x: 40, y: 40 };
        }

        const nodeIdMap: Record<string, string> = {};

        const newNodes = clipboard.nodes
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

        const newEdges = clipboard.edges
            .filter((edge: any) => nodeIdMap[edge.source] && nodeIdMap[edge.target])
            .map((edge: any) => ({
                ...edge,
                id: `e_${nodeIdMap[edge.source]}-${nodeIdMap[edge.target]}-${Date.now()}`,
                source: nodeIdMap[edge.source],
                target: nodeIdMap[edge.target],
                selected: true,
            }));

        // Deselect current nodes
        setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        setEdges((eds) => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
    }, [clipboard, setNodes, setEdges]);

    useHotkeys([
        { key: 'cmd+c', description: 'Copy Nodes', enabled: nodes.some(n => n.selected), handler: () => handleCopy() },
        { key: 'ctrl+c', description: 'Copy Nodes', enabled: nodes.some(n => n.selected), handler: () => handleCopy() },
        { key: 'cmd+v', description: 'Paste Nodes', enabled: !!clipboard, handler: () => handlePaste() },
        { key: 'ctrl+v', description: 'Paste Nodes', enabled: !!clipboard, handler: () => handlePaste() }
    ], { scopeName: 'Workflow Graph' });

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

        onNodesChangeRaw(filteredChanges);
    }, [onNodesChangeRaw, nodes, selectedNodeId, isReadOnly, onNodeSelectCallback]);

    const onEdgesChange = useCallback((changes: any) => {
        if (isReadOnly) return;
        onEdgesChangeRaw(changes);
    }, [onEdgesChangeRaw, isReadOnly]);

    const onConnect = useCallback(
        (params: Connection) => {
            if (isReadOnly) return;
            // Prevent same node connecting to itself
            if (params.source === params.target) return;

            // Ensure if targetHandle is not set or empty, it defaults to 'top'
            // Unless the source is dropping explicitly onto a named targetHandle
            const newEdgeParams: Edge = {
                ...params,
                source: params.source || '',
                target: params.target || '',
                id: `e_${params.source}-${params.target}-${Date.now()}`,
                targetHandle: params.targetHandle || 'top',
                sourceHandle: params.sourceHandle || 'output'
            };
            setEdges((eds) => addEdge(newEdgeParams, eds));
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

        const isProvider = !!type.isRightInputProvider;
        const nodeWidth = isProvider ? 70 : 250;
        const newNodeId = `node_${Date.now()}`;

        // Center horizontally (half width) and align top vertically
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

        setNodes((nds) => nds.concat(newNode));

        if (connectionStart.nodeId) {
            let newEdge: any;
            if (connectionStart.handleType === 'target') {
                // Dragged from an input (target) handle, so the new node provides the data (source)
                newEdge = {
                    id: `e_${newNodeId}-${connectionStart.nodeId}`,
                    source: newNodeId,
                    sourceHandle: 'output',
                    target: connectionStart.nodeId,
                    targetHandle: connectionStart.handleId,
                };
            } else {
                // Dragged from an output (source) handle, so the new node receives the data (target)
                // We force targetHandle: 'top' so it points to the explicit top input, not a specialized Right input.
                newEdge = {
                    id: `e_${connectionStart.nodeId}-${newNodeId}`,
                    source: connectionStart.nodeId,
                    sourceHandle: connectionStart.handleId,
                    target: newNodeId,
                    targetHandle: 'top',
                };
            }
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


    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (!isReadOnly && event.altKey) {
            event.stopPropagation();
            event.preventDefault();
            setEdges((eds) => eds.filter(e => !(e.target === node.id && (e.targetHandle === 'top' || !e.targetHandle))));
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
    }, [isReadOnly, setEdges, onNodeSelectCallback]);

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

    // Inject isActive + maxThan (from nodeType definition) into each node's data
    const renderedNodes = React.useMemo(() => nodes.map(node => {
        const ntDef = nodeTypes.find((t: NodeType) => {
            // Prefer looking up by UID
            if (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) {
                return true;
            }
            // Fallback to name/category
            const nameMatches = t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase();
            if (node.data?.category && t.category) {
                return nameMatches && t.category === node.data.category;
            }
            return nameMatches;
        });
        // Determine MAX_THEN from nodeType parameters definition
        const maxThenParam = ntDef?.parameters?.find((p: any) => p.name === 'MAX_THEN' || p.name === 'MAX_THAN');
        const maxThen = node.data?.params?.MAX_THEN ?? node.data?.params?.maxThen ?? node.data?.params?.MAX_THAN ?? node.data?.params?.maxThan ?? maxThenParam?.default ?? 0;

        // Extract inputs from input_schema
        const inputs = ntDef?.input_schema?.inputs || [];

        return {
            ...node,
            data: {
                ...node.data,
                // Always use the latest label and icon from the library if available
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
                        console.log('[WorkflowGraph] onNodeDoubleClick triggered for node:', node.id);
                        if (onNodeDoubleClickCallback) onNodeDoubleClickCallback(event, node);
                        else console.warn('[WorkflowGraph] No onNodeDoubleClickCallback provided');
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
                    defaultViewport={workflow?.id ? globalViewportCache[workflow.id] : undefined}
                    snapToGrid={true}
                    snapGrid={[10, 10]}
                    nodesDraggable={!isReadOnly}
                    nodesConnectable={!isReadOnly}
                    elementsSelectable={true}
                    panOnDrag={!isSelectionMode}
                    selectionOnDrag={true}
                    selectionKeyCode={isSelectionMode ? null : 'Shift'}
                    multiSelectionKeyCode="Shift"
                >
                    <Panel position="top-left" className="bg-surface-800 border-[var(--border-base)] rounded-xl p-1 shadow-2xl flex gap-1 ml-4 mt-2">
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
                            disabled={!clipboard}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 text-[var(--text-muted)] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Paste nodes nearby"
                        >
                            Paste
                        </button>
                    </Panel>
                    <Background
                        variant={BackgroundVariant.Dots}
                        color="currentColor"
                        gap={20}
                        size={1.5}
                        className="text-[var(--text-muted)] opacity-20 dark:opacity-30"
                    />
                    <Controls className="!bg-surface-800 !border-[var(--border-base)] !rounded-2xl !shadow-2xl !overflow-hidden [&_button]:!border-[var(--border-base)] [&_button]:!bg-transparent [&_button:hover]:!bg-brand/10 [&_svg]:!fill-[var(--text-main)] [&_svg]:!opacity-60" />
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
                            setEdges((eds) => eds.filter(e => !(e.target === id && (e.targetHandle === 'top' || !e.targetHandle))));
                        }}
                        onClose={() => setMenu(null)}
                    />
                )}
            </section>
        </div>
    );
}
