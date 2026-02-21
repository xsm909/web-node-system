import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from 'reactflow';
import { apiClient } from '../../../shared/api/client';
import type { Workflow } from '../../../entities/workflow/model/types';

interface UseWorkflowOperationsProps {
    activeWorkflow: Workflow | null;
    nodesRef: React.MutableRefObject<Node[]>;
    edgesRef: React.MutableRefObject<Edge[]>;
}

export function useWorkflowOperations({
    activeWorkflow,
    nodesRef,
    edgesRef
}: UseWorkflowOperationsProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [executionLogs, setExecutionLogs] = useState([]);
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);

    const saveWorkflow = async () => {
        if (!activeWorkflow) return;
        await apiClient.put(`/manager/workflows/${activeWorkflow.id}`, {
            graph: { nodes: nodesRef.current, edges: edgesRef.current },
        });
    };

    const pollExecution = useCallback(async (executionId: string) => {
        try {
            const { data } = await apiClient.get(`/manager/executions/${executionId}`);
            setExecutionLogs(data.logs || []);

            if (data.status === 'success' || data.status === 'failed') {
                setIsRunning(false);
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
        if (isRunning && currentExecutionId) {
            const poll = async () => {
                const stopped = await pollExecution(currentExecutionId);
                if (!stopped) {
                    timer = setTimeout(poll, 1500);
                }
            };
            poll();
        }
        return () => clearTimeout(timer);
    }, [isRunning, currentExecutionId, pollExecution]);

    const runWorkflow = async (onConsoleOpen: () => void) => {
        if (!activeWorkflow) return;
        await saveWorkflow();
        setIsRunning(true);
        setExecutionLogs([]);
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
        executionLogs
    };
}
