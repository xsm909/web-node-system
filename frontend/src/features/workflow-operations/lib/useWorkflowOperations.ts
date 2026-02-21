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

    useEffect(() => {
        setIsRunning(false);
        setCurrentExecutionId(null);
        setExecutionLogs([]);
        setLiveRuntimeData({});
    }, [activeWorkflow?.id]);

    const onExecutionCompleteRef = useRef(onExecutionComplete);
    useEffect(() => {
        onExecutionCompleteRef.current = onExecutionComplete;
    }, [onExecutionComplete]);

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
        await apiClient.put(`/manager/workflows/${activeWorkflow.id}`, {
            graph: { nodes: nodesRef.current, edges: edgesRef.current },
            workflow_data_schema: activeWorkflow.workflow_data_schema,
            workflow_data: activeWorkflow.workflow_data,
            runtime_data_schema: activeWorkflow.runtime_data_schema,
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
            const { data } = await apiClient.get(`/manager/executions/${executionId}`);
            setExecutionLogs(data.logs || []);
            if (data.current_runtime_data) {
                setLiveRuntimeData(data.current_runtime_data);
            }

            if (data.status === 'success' || data.status === 'failed') {
                setIsRunning(false);
                if (onExecutionCompleteRef.current) onExecutionCompleteRef.current();
                return true; // Stop polling
            }
            return false;
        } catch {
            setIsRunning(false);
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

    const runWorkflow = async (onConsoleOpen: () => void) => {
        if (!activeWorkflow) return;
        await saveWorkflow();
        setCurrentExecutionId(null);
        setIsRunning(true);
        setExecutionLogs([]);
        setLiveRuntimeData({});
        onConsoleOpen();

        try {
            const { data } = await apiClient.post(`/manager/workflows/${activeWorkflow.id}/run`);
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
        setLiveRuntimeData
    };
}
