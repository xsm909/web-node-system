import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';

export function useWorkflowManagement() {
    const { user: currentUser } = useAuthStore();
    const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
    const [workflowsByOwner, setWorkflowsByOwner] = useState<Record<string, Workflow[]>>({});
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);

    const [isCreating, setIsCreating] = useState(false);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);

    const loadWorkflowsForUser = useCallback(async (userId: string, isPersonal = false) => {
        try {
            const { data } = await apiClient.get(`/manager/users/${userId}/workflows`);
            setWorkflowsByOwner(prev => ({
                ...prev,
                [isPersonal ? 'personal' : userId]: data
            }));
        } catch (e) {
            console.error(`Failed to load workflows for user ${userId}`, e);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const nodeTypesRes = await apiClient.get('/manager/node-types');
                setNodeTypes(nodeTypesRes.data);

                const usersRes = await apiClient.get('/manager/users');
                const users = usersRes.data;
                setAssignedUsers(users);

                if (currentUser?.id) {
                    await loadWorkflowsForUser(currentUser.id, true);
                }

                for (const user of users) {
                    await loadWorkflowsForUser(user.id);
                }
            } catch (e) {
                console.error("Initialization failed", e);
            }
        };
        init();
    }, [currentUser?.id, loadWorkflowsForUser]);

    const loadWorkflow = (wf: Workflow) => {
        // Fetch new workflow data directly, bypassing the null state flash
        apiClient.get(`/manager/workflows/${wf.id}`).then((r) => {
            setActiveWorkflow(r.data);
        }).catch((err) => {
            const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
            console.error(`[loadWorkflow] Failed to load workflow "${wf.name}":`, err?.response?.data || err);
            alert(`❌ Failed to load workflow "${wf.name}"\n\n${detail}`);
        });
    };

    const handleCreateWorkflow = async (name: string, ownerId: string) => {
        const effectiveOwnerId = ownerId === 'personal' ? currentUser?.id : ownerId;
        if (!effectiveOwnerId) return;

        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/manager/workflows', {
                name,
                owner_id: effectiveOwnerId,
            });
            setWorkflowsByOwner((prev) => ({
                ...prev,
                [ownerId]: [...(prev[ownerId] || []), data]
            }));
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWorkflow = async () => {
        if (!workflowToDelete) return;

        try {
            await apiClient.delete(`/manager/workflows/${workflowToDelete.id}`);

            setWorkflowsByOwner((prev) => {
                const newWorkflows = { ...prev };
                for (const ownerId in newWorkflows) {
                    newWorkflows[ownerId] = newWorkflows[ownerId].filter(w => w.id !== workflowToDelete.id);
                }
                return newWorkflows;
            });

            if (activeWorkflow?.id === workflowToDelete.id) {
                setActiveWorkflow(null);
            }
        } catch (error) {
            console.error('Failed to delete workflow', error);
        } finally {
            setWorkflowToDelete(null);
        }
    };

    return {
        assignedUsers,
        workflowsByOwner,
        activeWorkflow,
        nodeTypes,
        isCreating,
        workflowToDelete,
        currentUser,
        setWorkflowToDelete,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        setActiveWorkflow
    };
}
