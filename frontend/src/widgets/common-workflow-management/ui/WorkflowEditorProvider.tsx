import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { ReactFlowProvider } from 'reactflow';
import { useWorkflowManagement } from '../../../features/workflow-management';
import { useWorkflowOperations } from '../../../features/workflow-operations';
import { useAuthStore } from '../../../features/auth/store';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';
import { useProjectStore } from '../../../features/projects/store';
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
        isCreating: isSaving,
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
        isHotkeysEnabled,
        
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
        creationProjectId,
        
        onNodesChange,
        onEdgesChange,
        notifyChange,
        
        nodesRef,
        edgesRef,
        
        onToggleSidebar,
        isSidebarOpen,
        onEditNode
    }), [
        workflows, activeWorkflow, nodeTypes, isSaving, workflowToDelete,
        workflowToRename, workflowError, isRunning, activeNodeIds, 
        isConsoleVisible, executionLogs, liveRuntimeData, renameInputValue,
        renameCategoryValue, notifyChange, activeClientId, isAdmin, 
        activeProjectIdFromContext, isHotkeysEnabled, setWorkflowToDelete,
        setWorkflowToRename, setRenameInputValue, setRenameCategoryValue,
        setWorkflowError, setIsConsoleVisible, setActiveWorkflow, loadWorkflow,
        handleCreateWorkflowWithProject, handleDuplicateWorkflow,
        handleRenameWorkflow, confirmDeleteWorkflow, saveWorkflow,
        handleRunWorkflow, creationProjectId, onNodesChange, onEdgesChange,
        nodesRef, edgesRef, onToggleSidebar, isSidebarOpen, onEditNode
    ]);

    return (
        <ReactFlowProvider>
            <WorkflowEditorContext.Provider value={value}>
                {children}
            </WorkflowEditorContext.Provider>
        </ReactFlowProvider>
    );
};
