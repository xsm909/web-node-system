import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { apiClient } from '../../../shared/api/client';
import type { Workflow } from '../../../entities/workflow/model/types';
import { useRegisterBlocker } from '../../../shared/lib/navigation-guard/useNavigationGuard';

interface UseWorkflowOperationsProps {
    activeWorkflow: Workflow | null;
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
    onUpdateLocalWorkflow?: (workflow: Workflow) => void;
    onExecutionComplete?: () => void;
}

export function useWorkflowOperations({
    activeWorkflow,
    nodesRef,
    edgesRef,
    onUpdateLocalWorkflow,
    onExecutionComplete
}: UseWorkflowOperationsProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [executionLogs, setExecutionLogs] = useState([]);
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
    const [liveRuntimeData, setLiveRuntimeData] = useState<Record<string, any>>({});
    const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);

    // We use a nonce to trigger dirty check when nodes/edges change
    const [changeNonce, setChangeNonce] = useState(0);

    useEffect(() => {
        setIsRunning(false);
        setCurrentExecutionId(null);
        setExecutionLogs([]);
        setLiveRuntimeData({});
        setActiveNodeIds([]);
        setChangeNonce(0);
    }, [activeWorkflow?.id]);

    const isDirty = useMemo(() => {
        if (!activeWorkflow) return false;
        
        // Simple comparison of nodes and edges length first
        const currentNodes = nodesRef.current || [];
        const currentEdges = edgesRef.current || [];
        const initialNodes = activeWorkflow.graph?.nodes || [];
        const initialEdges = activeWorkflow.graph?.edges || [];

        if (currentNodes.length !== initialNodes.length) return true;
        if (currentEdges.length !== initialEdges.length) return true;

        // Use stringify for deep comparison as a simple way for graphs
        // Note: activeWorkflow.graph should be what was originally loaded
        const currentGraphStr = JSON.stringify({ nodes: currentNodes, edges: currentEdges });
        const initialGraphStr = JSON.stringify({ nodes: initialNodes, edges: initialEdges });

        return currentGraphStr !== initialGraphStr;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkflow, activeWorkflow?.graph, changeNonce]);

    const onExecutionCompleteRef = useRef(onExecutionComplete);
    useEffect(() => {
        onExecutionCompleteRef.current = onExecutionComplete;
    }, [onExecutionComplete]);

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
        setIsSaving(true);
        try {
            await apiClient.put(`/workflows/workflows/${activeWorkflow.id}`, {
                graph: { nodes: nodesRef.current, edges: edgesRef.current },
                workflow_data: activeWorkflow.workflow_data,
                runtime_data: activeWorkflow.runtime_data,
            });
            if (onUpdateLocalWorkflow) {
                onUpdateLocalWorkflow({
                    ...activeWorkflow,
                    graph: { nodes: nodesRef.current, edges: edgesRef.current }
                });
            }
            // Reset dirty state by mimicking fresh load
            setChangeNonce(0);
        } finally {
            setIsSaving(false);
        }
    };

    // Register with navigation guard
    useRegisterBlocker(
        activeWorkflow ? `workflow-${activeWorkflow.id}` : 'workflow-editor',
        isDirty,
        saveWorkflow,
        () => {
            // Discard: we don't need to do anything specifically here 
            // because navigation will happen and state will be lost/reloaded anyway
        }
    );

    const pollExecution = useCallback(async (executionId: string) => {
        try {
            const { data } = await apiClient.get(`/workflows/executions/${executionId}`);
            setExecutionLogs(data.logs || []);
            if (data.current_runtime_data) {
                setLiveRuntimeData(data.current_runtime_data);
            }
            if (data.node_results) {
                const runningNodes = data.node_results
                    .filter((n: any) => n.status === 'running')
                    .map((n: any) => n.node_id);
                setActiveNodeIds(runningNodes);
            }

            if (data.status === 'success' || data.status === 'failed') {
                setIsRunning(false);
                setActiveNodeIds([]);
                if (onExecutionCompleteRef.current) onExecutionCompleteRef.current();
                return true; // Stop polling
            }
            return false;
        } catch {
            setIsRunning(false);
            setActiveNodeIds([]);
            return true;
        }
    }, []);

    useEffect(() => {
        let timer: any;
        let isEffectActive = true;
        if (isRunning && currentExecutionId) {
            const poll = async () => {
                if (!isEffectActive) return;
                const stopped = await pollExecution(currentExecutionId);
                if (!stopped && isEffectActive) {
                    timer = setTimeout(poll, 1000);
                }
            };
            poll();
        }
        return () => {
            isEffectActive = false;
            clearTimeout(timer);
        };
    }, [isRunning, currentExecutionId, pollExecution]);

    const runWorkflow = async (onConsoleOpen: () => void, activeClientId?: string | null) => {
        if (!activeWorkflow) return;
        try {
            await saveWorkflow();
        } catch (err: any) {
            // If the user doesn't have permission to save (e.g. non-admin running common workflow),
            // just continue to run the workflow as it is saved in the database
            if (err?.response?.status !== 403) {
                console.error("Failed to save workflow before running:", err);
                // Optionally alert the user here if it's not a 403
            } else {
                console.warn("Could not save workflow before running (403 Forbidden). Proceeding with execution using existing backend state.");
            }
        }
        setCurrentExecutionId(null);
        setIsRunning(true);
        setExecutionLogs([]);
        setLiveRuntimeData({});
        setActiveNodeIds([]);
        onConsoleOpen();

        try {
            const { data } = await apiClient.post(`/workflows/workflows/${activeWorkflow.id}/run`, {
                target_client_id: activeClientId
            });
            setCurrentExecutionId(data.execution_id);
        } catch {
            setIsRunning(false);
        }
    };

    return {
        saveWorkflow,
        runWorkflow,
        isRunning,
        isSaving,
        executionLogs,
        liveRuntimeData,
        setLiveRuntimeData,
        activeNodeIds,
        isDirty,
        notifyChange: () => setChangeNonce(n => n + 1)
    };
}
