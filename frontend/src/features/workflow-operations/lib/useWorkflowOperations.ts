import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import { apiClient } from '../../../shared/api/client';
import type { Workflow } from '../../../entities/workflow/model/types';

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
    const [executionLogs, setExecutionLogs] = useState([]);
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
    const [liveRuntimeData, setLiveRuntimeData] = useState<Record<string, any>>({});
    const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);

    useEffect(() => {
        setIsRunning(false);
        setCurrentExecutionId(null);
        setExecutionLogs([]);
        setLiveRuntimeData({});
        setActiveNodeIds([]);
    }, [activeWorkflow?.id]);

    const onExecutionCompleteRef = useRef(onExecutionComplete);
    useEffect(() => {
        onExecutionCompleteRef.current = onExecutionComplete;
    }, [onExecutionComplete]);

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
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
    };

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
        executionLogs,
        liveRuntimeData,
        setLiveRuntimeData,
        activeNodeIds
    };
}
