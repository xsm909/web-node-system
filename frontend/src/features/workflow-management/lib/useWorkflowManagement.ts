import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../model/clientStore';

export function useWorkflowManagement(refreshTrigger?: number) {
    const { user: currentUser } = useAuthStore();
    const { activeClientId, setAssignedUsers } = useClientStore();
    const [assignedUsers, setAssignedUsersState] = useState<AssignedUser[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);

    const [isCreating, setIsCreating] = useState(false);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
    const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);

    // Auto-close workflow if it doesn't belong to the active context (client or current user)
    useEffect(() => {
        if (activeWorkflow) {
            const isPersonal = activeWorkflow.owner_id === currentUser?.id;
            const belongsToActiveClient = activeClientId && activeWorkflow.owner_id === activeClientId;

            if (!isPersonal && !belongsToActiveClient) {
                setActiveWorkflow(null);
            }
        }
    }, [activeClientId, activeWorkflow, currentUser?.id]);

    const loadWorkflowsForUser = useCallback(async (userId: string) => {
        try {
            const { data } = await apiClient.get(`/workflows/users/${userId.toLowerCase()}/workflows`);

            setWorkflows(prev => {
                // Remove existing workflows for this user to avoid duplicates on refresh
                const otherUsersWorkflows = prev.filter(w => w.owner_id.toLowerCase() !== userId.toLowerCase());
                return [...otherUsersWorkflows, ...data];
            });
        } catch (e) {
            console.error(`Failed to load workflows for user ${userId}`, e);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const nodeTypesRes = await apiClient.get('/workflows/node-types');
                setNodeTypes(nodeTypesRes.data);

                const usersRes = await apiClient.get('/workflows/users');
                const users = usersRes.data;
                setAssignedUsersState(users);
                setAssignedUsers(users);

                // Load workflows for current user
                if (currentUser?.id) {
                    await loadWorkflowsForUser(currentUser.id);
                }

                // Load workflows for all assigned clients (if admin or manager)
                for (const user of users) {
                    if (user.id.toLowerCase() === currentUser?.id?.toLowerCase()) continue;
                    await loadWorkflowsForUser(user.id);
                }
            } catch (e) {
                console.error("Initialization failed", e);
            }
        };
        init();
    }, [currentUser?.id, loadWorkflowsForUser, setAssignedUsers]);

    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            apiClient.get('/workflows/node-types').then(res => setNodeTypes(res.data)).catch(console.error);
        }
    }, [refreshTrigger]);

    const loadWorkflow = async (wf: Workflow) => {
        try {
            const r = await apiClient.get(`/workflows/workflows/${wf.id}`);
            setActiveWorkflow(r.data);
            return r.data;
        } catch (err: any) {
            const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
            console.error(`[loadWorkflow] Failed to load workflow "${wf.name}":`, err?.response?.data || err);
            alert(`❌ Failed to load workflow "${wf.name}"\n\n${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
            throw err;
        }
    };

    const handleCreateWorkflow = async (name: string, category: string = 'general') => {
        if (!currentUser?.id) return;

        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/workflows/workflows', {
                name,
                category
            });

            setWorkflows((prev) => [...prev, data]);
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWorkflow = async () => {
        if (!workflowToDelete) return;

        try {
            await apiClient.delete(`/workflows/workflows/${workflowToDelete.id}`);

            setWorkflows((prev) => prev.filter(w => w.id !== workflowToDelete.id));

            if (activeWorkflow?.id === workflowToDelete.id) {
                setActiveWorkflow(null);
            }
        } catch (error) {
            console.error('Failed to delete workflow', error);
        } finally {
            setWorkflowToDelete(null);
        }
    };

    const handleDuplicateWorkflow = async (workflowId: string) => {
        try {
            const { data } = await apiClient.post(`/workflows/workflows/${workflowId}/duplicate`);
            
            setWorkflows((prev) => [...prev, data]);
            
            return data;
        } catch (error) {
            console.error('Failed to duplicate workflow', error);
            throw error;
        }
    };

    const handleRenameWorkflow = async (workflowId: string, newName: string, newCategory?: string) => {
        if (!newName.trim()) return;
        try {
            const { data } = await apiClient.patch(`/workflows/workflows/${workflowId}/rename`, {
                name: newName,
                category: newCategory
            });

            setWorkflows((prev) => {
                return prev.map(w => w.id === workflowId ? data : w);
            });

            if (activeWorkflow?.id === workflowId) {
                setActiveWorkflow(data);
            }
        } catch (error) {
            console.error('Failed to rename workflow', error);
        }
    };

    return {
        assignedUsers,
        workflows,
        activeWorkflow,
        nodeTypes,
        isCreating,
        workflowToDelete,
        workflowToRename,
        currentUser,
        setWorkflowToDelete,
        setWorkflowToRename,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow
    };
}
