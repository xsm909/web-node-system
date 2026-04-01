import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { ReactFlowProvider } from 'reactflow';
import { useWorkflowManagement } from '../../../features/workflow-management';
import { useWorkflowOperations } from '../../../features/workflow-operations';
import { useAuthStore } from '../../../features/auth/store';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';
import { useProjectStore } from '../../../features/projects/store';
import { usePresets, type Preset } from '../../../entities/preset';
import type { NodeType } from '../../../entities/node-type/model/types';

interface WorkflowEditorContextType {
    workflows: any[];
    activeWorkflow: any;
    nodeTypes: any[];
    isCreating: boolean;
    workflowToDelete: any;
    workflowToRename: any;
    workflowError: string | null;
    isSaving: boolean;
    isRunning: boolean;
    activeNodeIds: string[];
    isConsoleVisible: boolean;
    executionLogs: any[];
    liveRuntimeData: any;
    renameInputValue: string;
    renameCategoryValue: string;
    isDirty: boolean;
    activeClientId: string | null;
    isAdmin: boolean;
    activeProjectId: string | null;
    creationProjectId: string | null;
    isHotkeysEnabled?: boolean;
    lastExternalUpdate: number;
    setLastExternalUpdate: (v: number) => void;
    
    // Presets
    isPresetModalOpen: boolean;
    isPresetPickerOpen: boolean;
    presetPickerPosition: { x: number, y: number } | undefined;
    isSavingPreset: boolean;
    setIsPresetModalOpen: (v: boolean) => void;
    setIsPresetPickerOpen: (v: boolean) => void;
    setPresetPickerPosition: (v: { x: number, y: number } | undefined) => void;
    saveSelectionAsPreset: () => void;
    openPresetPicker: (position?: { x: number, y: number }) => void;
    onApplyPreset: (preset: Preset, useMouse?: boolean, mousePos?: { x: number, y: number }) => void;
    handleSavePreset: (name: string, category?: string) => void;
    
    setWorkflowToDelete: (wf: any) => void;
    setWorkflowToRename: (wf: any) => void;
    setRenameInputValue: (v: string) => void;
    setRenameCategoryValue: (v: string) => void;
    setWorkflowError: (v: string | null) => void;
    setIsConsoleVisible: (v: boolean) => void;
    setActiveWorkflow: (wf: any) => void;
    
    loadWorkflow: (wf: any) => Promise<any>;
    handleCreateWorkflow: (name: string, category: string, projectId?: string | null) => Promise<any>;
    handleDuplicateWorkflow: (workflowId: string) => Promise<any>;
    handleRenameWorkflow: (workflowId: string, newName: string, category: string) => Promise<any>;
    confirmDeleteWorkflow: () => Promise<any>;
    saveWorkflow: () => Promise<void>;
    runWorkflow: (onStart?: () => void, clientId?: string | null) => Promise<void>;
    
    onNodesChange: (nodes: Node[]) => void;
    onEdgesChange: (edges: Edge[]) => void;
    notifyChange: () => void;
    
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
    
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    onEditNode?: (event: React.MouseEvent | React.KeyboardEvent, node: Node) => void;
}

const WorkflowEditorContext = createContext<WorkflowEditorContextType | null>(null);

export const useWorkflowEditor = () => {
    const context = useContext(WorkflowEditorContext);
    if (!context) throw new Error('useWorkflowEditor must be used within WorkflowEditorProvider');
    return context;
};

export const WorkflowEditorProvider: React.FC<{
    children: React.ReactNode;
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    onEditNode?: (node: NodeType) => void;
    refreshTrigger?: number;
    activeWorkflowId?: string;
    projectId?: string | null;
    isHotkeysEnabled?: boolean;
    isPinned?: boolean;
}> = ({ 
    children, 
    onToggleSidebar, 
    isSidebarOpen = false, 
    onEditNode: onEditNodeProp, 
    refreshTrigger, 
    activeWorkflowId,
    projectId,
    isHotkeysEnabled,
    isPinned = false
}) => {
    const {
        workflows,
        activeWorkflow,
        nodeTypes,
        isCreating: isCreatingWf,
        workflowToDelete,
        workflowToRename,
        setWorkflowToDelete,
        setWorkflowToRename,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow
    } = useWorkflowManagement(refreshTrigger, projectId);

    // Auto-load workflow from ID
    useEffect(() => {
        if (activeWorkflowId) {
            // If the active workflow is different or not loaded, fetch a fresh copy
            if (!activeWorkflow || activeWorkflow.id !== activeWorkflowId) {
                // We pass a dummy object with just the ID to trigger a fresh fetch in useWorkflowManagement
                loadWorkflow({ id: activeWorkflowId } as any);
            }
        }
    }, [activeWorkflowId, activeWorkflow?.id, loadWorkflow]);

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);
    const lastInitializedIdRef = useRef<string | null>(null);
    const [workflowError, setWorkflowError] = useState<string | null>(null);
    const [isConsoleVisible, setIsConsoleVisible] = useState(false);
    const [renameInputValue, setRenameInputValue] = useState('');
    const [renameCategoryValue, setRenameCategoryValue] = useState<string>('personal');

    const {
        saveWorkflow,
        runWorkflow,
        isRunning,
        executionLogs,
        liveRuntimeData,
        activeNodeIds,
        notifyChange,
        isDirty,
        isSaving: isSavingOps
    } = useWorkflowOperations({
        activeWorkflow,
        nodesRef,
        edgesRef,
        onUpdateLocalWorkflow: setActiveWorkflow,
        onExecutionComplete: () => {
             // NO LOAD here - polling already gets the logs/status. 
             // Fresh fetch would reset the UI to stale 'Saved' state.
        },
        isPinned
    });

    const { savePreset: saveWorkflowPreset, isLoading: isSavingPreset } = usePresets('workflow');

    // Presets Management
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [isPresetPickerOpen, setIsPresetPickerOpen] = useState(false);
    const [presetPickerPosition, setPresetPickerPosition] = useState<{ x: number, y: number } | undefined>();
    const [capturedPresetData, setCapturedPresetData] = useState<any>(null);
    const [lastExternalUpdate, setLastExternalUpdate] = useState(0);

    const captureSelection = useCallback(() => {
        const nodes = nodesRef.current;
        const edges = edgesRef.current;
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return null;

        const allCapturedNodeIds = new Set<string>();
        const nodesToProcess = [...selectedNodes];

        while (nodesToProcess.length > 0) {
            const node = nodesToProcess.pop()!;
            if (allCapturedNodeIds.has(node.id)) continue;
            allCapturedNodeIds.add(node.id);

            if (node.type === 'group') {
                const children = nodes.filter(n => n.parentId === node.id);
                nodesToProcess.push(...children);
            }
        }

        const capturedNodes = nodes.filter((n: Node) => allCapturedNodeIds.has(n.id));
        const capturedEdges = edges.filter((e: Edge) => allCapturedNodeIds.has(e.source) && allCapturedNodeIds.has(e.target));

        const nodesWithAbsolutePositions = capturedNodes.map((n: Node) => {
            let absX = n.position.x;
            let absY = n.position.y;
            let parentId = n.parentId;
            
            while (parentId) {
                const parent = nodes.find((node: Node) => node.id === parentId);
                if (parent) {
                    absX += parent.position.x;
                    absY += parent.position.y;
                    parentId = parent.parentId;
                } else {
                    break;
                }
            }
            return { ...n, position: { x: absX, y: absY } };
        });

        const minX = Math.min(...nodesWithAbsolutePositions.map(n => n.position.x));
        const minY = Math.min(...nodesWithAbsolutePositions.map(n => n.position.y));
        const maxX = Math.max(...nodesWithAbsolutePositions.map(n => n.position.x + (n.width || 220)));
        const maxY = Math.max(...nodesWithAbsolutePositions.map(n => n.position.y + (n.height || 80)));

        return {
            nodes: nodesWithAbsolutePositions.map(n => ({ ...n, selected: false })),
            edges: capturedEdges.map(e => ({ ...e, selected: false })),
            center: { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 }
        };
    }, [nodesRef, edgesRef]);

    const saveSelectionAsPreset = useCallback(() => {
        const data = captureSelection();
        if (!data) return;
        setCapturedPresetData(data);
        setIsPresetModalOpen(true);
    }, [captureSelection]);

    const openPresetPicker = useCallback((position?: { x: number, y: number }) => {
        setPresetPickerPosition(position);
        setIsPresetPickerOpen(true);
    }, []);

    const handleSavePreset = useCallback(async (name: string, category?: string) => {
        if (!capturedPresetData) return;
        try {
            await saveWorkflowPreset(name, capturedPresetData, category);
            setIsPresetModalOpen(false);
            setCapturedPresetData(null);
        } catch (err) {
            console.error('Failed to save preset:', err);
        }
    }, [capturedPresetData, saveWorkflowPreset]);

    const onApplyPreset = useCallback((preset: Preset, useMouse = true, mousePos?: { x: number, y: number }) => {
        const data = preset.preset_data;
        if (!data || !data.nodes) return;

        const targetPos = mousePos || { x: 0, y: 0 };
        const offset = useMouse 
            ? { x: targetPos.x - (data.center?.x || 0), y: targetPos.y - (data.center?.y || 0) }
            : { x: 0, y: 0 };

        const nodeIdMap: Record<string, string> = {};
        const intermediateNodes = data.nodes.map((node: any) => {
            const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            nodeIdMap[node.id] = newId;
            return { 
                ...node, 
                id: newId, 
                position: { x: node.position.x + offset.x, y: node.position.y + offset.y }, 
                selected: true 
            };
        });

        const newNodes = intermediateNodes.map((node: any) => {
            const oldParentId = node.parentId;
            const newParentId = oldParentId ? nodeIdMap[oldParentId] : undefined;

            if (newParentId) {
                const newParent = intermediateNodes.find((n: any) => n.id === newParentId);
                if (newParent) {
                    return {
                        ...node,
                        parentId: newParentId,
                        position: {
                            x: node.position.x - newParent.position.x,
                            y: node.position.y - newParent.position.y
                        }
                    };
                }
            }
            const { parentId, ...rest } = node;
            return { ...rest, selected: true };
        });

        const newEdges = (data.edges || [])
            .filter((e: any) => nodeIdMap[e.source] && nodeIdMap[e.target])
            .map((edge: any) => ({
                ...edge,
                id: `e_${nodeIdMap[edge.source]}-${nodeIdMap[edge.target]}`,
                source: nodeIdMap[edge.source],
                target: nodeIdMap[edge.target],
                selected: true
            }));

        nodesRef.current = nodesRef.current.map((n: Node) => ({ ...n, selected: false })).concat(newNodes);
        edgesRef.current = edgesRef.current.map((e: Edge) => ({ ...e, selected: false })).concat(newEdges);
        
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                graph: {
                    nodes: nodesRef.current,
                    edges: edgesRef.current
                }
            };
        });

        setIsPresetPickerOpen(false);
        setLastExternalUpdate(Date.now());
        notifyChange();
    }, [setActiveWorkflow, notifyChange, nodesRef, edgesRef]);

    const isSaving = isCreatingWf || isSavingOps;

    // Only INITIALIZE from backend data when ID changes. 
    // Do NOT overwrite Ref during edits (graph changes but ID is same).
    useEffect(() => {
        if (activeWorkflow?.id && lastInitializedIdRef.current !== activeWorkflow.id) {
            nodesRef.current = activeWorkflow.graph?.nodes || [];
            edgesRef.current = activeWorkflow.graph?.edges || [];
            lastInitializedIdRef.current = activeWorkflow.id;
            console.log('[WorkflowEditorProvider] Initialized Ref from Workflow:', activeWorkflow.id);
        }
    }, [activeWorkflow?.id]); // Only watch ID, not graph content

    const onNodesChange = useCallback((nodes: Node[]) => {
        if (!nodes) return;
        nodesRef.current = nodes;
        // Defer notification to avoid React "update during render" warning from child to parent
        setTimeout(() => notifyChange(), 0);
    }, [notifyChange]);

    const onEdgesChange = useCallback((edges: Edge[]) => {
        if (!edges) return;
        edgesRef.current = edges;
        // Defer notification to avoid React "update during render" warning from child to parent
        setTimeout(() => notifyChange(), 0);
    }, [notifyChange]);

    const activeClientId = useClientStore(s => s.activeClientId);
    const currentUser = useAuthStore(s => s.user);
    const activeProject = useProjectStore(s => s.activeProject);

    const isAdmin = currentUser?.role === 'admin';
    // Prioritize explicitly passed projectId (Pinned Tabs), then the workflow's own project context, then the sidebar selection.
    const activeProjectIdFromContext = projectId !== undefined ? projectId : (activeWorkflow ? (activeWorkflow.project_id || null) : (activeProject?.id || null));

    const [creationProjectId, setCreationProjectId] = useState<string | null>(null);

    const handleCreateWorkflowWithProject = useCallback(async (name: string, category: string, projectId?: string | null) => {
        const finalProjectId = projectId || activeProjectIdFromContext || null;
        setCreationProjectId(finalProjectId);
        return handleCreateWorkflow(name, category, finalProjectId);
    }, [handleCreateWorkflow, activeProjectIdFromContext]);

    const onEditNode = useCallback((_event: React.MouseEvent | React.KeyboardEvent, node: Node) => {
        if (!nodeTypes || nodeTypes.length === 0) return;
        
        const nodeLabel = node.data?.label || '';
        const nodeTypeId = node.data?.nodeTypeId;
        const nodeTypeRef = node.data?.nodeType;

        const ntDef = nodeTypes.find((t: any) =>
            (nodeTypeId && t.id === nodeTypeId) ||
            t.name.toLowerCase() === (nodeTypeRef || nodeLabel).toLowerCase()
        );

        if (ntDef && onEditNodeProp) {
            onEditNodeProp(ntDef);
        }
    }, [nodeTypes, onEditNodeProp]);

    const handleRunWorkflow = useCallback(async (onStart?: () => void, clientId?: string | null) => {
        return runWorkflow(onStart || (() => {}), clientId);
    }, [runWorkflow]);

    const value = useMemo(() => ({
        workflows,
        activeWorkflow,
        nodeTypes,
        isCreating: isCreatingWf || isSavingOps,
        workflowToDelete,
        workflowToRename,
        workflowError,
        isSaving,
        isRunning,
        activeNodeIds,
        isConsoleVisible,
        executionLogs,
        liveRuntimeData,
        renameInputValue,
        renameCategoryValue,
        isDirty,
        activeClientId,
        isAdmin,
        activeProjectId: activeProjectIdFromContext,
        creationProjectId: creationProjectId,
        isHotkeysEnabled,
        
        isPresetModalOpen,
        isPresetPickerOpen,
        presetPickerPosition,
        isSavingPreset,
        setIsPresetModalOpen,
        setIsPresetPickerOpen,
        setPresetPickerPosition,
        saveSelectionAsPreset,
        openPresetPicker,
        onApplyPreset,
        handleSavePreset,
        
        setWorkflowToDelete,
        setWorkflowToRename,
        setRenameInputValue,
        setRenameCategoryValue,
        setWorkflowError,
        setIsConsoleVisible,
        setActiveWorkflow,
        
        loadWorkflow,
        handleCreateWorkflow: handleCreateWorkflowWithProject,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        confirmDeleteWorkflow,
        saveWorkflow,
        runWorkflow: handleRunWorkflow,
        
        onNodesChange,
        onEdgesChange,
        notifyChange,
        
        nodesRef,
        edgesRef,
        
        onToggleSidebar,
        isSidebarOpen,
        onEditNode,
        lastExternalUpdate,
        setLastExternalUpdate
    }), [
        workflows, activeWorkflow, nodeTypes, isCreatingWf, isSavingOps, 
        workflowToDelete, workflowToRename, workflowError, isRunning, 
        activeNodeIds, isConsoleVisible, executionLogs, liveRuntimeData, 
        renameInputValue, renameCategoryValue, isDirty, activeClientId, 
        isAdmin, activeProjectIdFromContext, creationProjectId, isHotkeysEnabled,
        setWorkflowToDelete, setWorkflowToRename, setRenameInputValue, 
        setRenameCategoryValue, setWorkflowError, setIsConsoleVisible, 
        setActiveWorkflow, loadWorkflow, handleCreateWorkflowWithProject, 
        handleDuplicateWorkflow, handleRenameWorkflow, confirmDeleteWorkflow, 
        saveWorkflow, handleRunWorkflow, onNodesChange, onEdgesChange, notifyChange, 
        onToggleSidebar, isSidebarOpen, onEditNode,
        lastExternalUpdate, setLastExternalUpdate
    ]);

    return (
        <ReactFlowProvider>
            <WorkflowEditorContext.Provider value={value}>
                {children}
            </WorkflowEditorContext.Provider>
        </ReactFlowProvider>
    );
};
