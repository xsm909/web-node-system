import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
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
    
    loadWorkflow: (wf: any) => Promise<void>;
    handleCreateWorkflow: (name: string, category: string, projectId?: string | null) => Promise<any>;
    handleDuplicateWorkflow: (workflowId: string) => Promise<void>;
    handleRenameWorkflow: (workflowId: string, newName: string, category: string) => Promise<void>;
    confirmDeleteWorkflow: () => Promise<void>;
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
}> = ({ 
    children, 
    onToggleSidebar, 
    isSidebarOpen = false, 
    onEditNode: onEditNodeProp, 
    refreshTrigger, 
    activeWorkflowId,
    projectId,
    isHotkeysEnabled
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
        if (activeWorkflowId && workflows.length > 0 && (!activeWorkflow || activeWorkflow.id !== activeWorkflowId)) {
            const wf = workflows.find(w => w.id === activeWorkflowId);
            if (wf) {
                loadWorkflow(wf);
            }
        }
    }, [activeWorkflowId, workflows, activeWorkflow, loadWorkflow]);

    const nodesRef = useRef<Node[]>([]);
    const edgesRef = useRef<Edge[]>([]);
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
        isSaving: isSavingOps
    } = useWorkflowOperations({
        activeWorkflow,
        nodesRef,
        edgesRef,
        onUpdateLocalWorkflow: setActiveWorkflow,
        onExecutionComplete: () => {
             if (activeWorkflow) loadWorkflow(activeWorkflow);
        }
    });

    const isSaving = isCreatingWf || isSavingOps;

    useEffect(() => {
        if (activeWorkflow?.graph) {
            nodesRef.current = activeWorkflow.graph.nodes || [];
            edgesRef.current = activeWorkflow.graph.edges || [];
        }
    }, [activeWorkflow?.id, activeWorkflow?.graph]);

    const onNodesChange = useCallback((nodes: Node[]) => {
        nodesRef.current = nodes;
    }, []);

    const onEdgesChange = useCallback((edges: Edge[]) => {
        edgesRef.current = edges;
    }, []);

    const { activeClientId } = useClientStore();
    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'admin';
    const { activeProject } = useProjectStore();
    const activeProjectId = projectId || activeProject?.id || null;

    const [creationProjectId, setCreationProjectId] = useState<string | null>(null);

    const handleCreateWorkflowWithProject = useCallback(async (name: string, category: string, projectId?: string | null) => {
        const finalProjectId = projectId || activeProjectId || null;
        setCreationProjectId(finalProjectId);
        return handleCreateWorkflow(name, category, finalProjectId);
    }, [handleCreateWorkflow, activeProjectId]);

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

    const value: WorkflowEditorContextType = {
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
        isDirty: (notifyChange as any).isDirty || false,
        activeClientId,
        isAdmin,
        activeProjectId,
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
    };

    return (
        <WorkflowEditorContext.Provider value={value}>
            {children}
        </WorkflowEditorContext.Provider>
    );
};
