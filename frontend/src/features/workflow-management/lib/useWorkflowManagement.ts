import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../model/clientStore';
import { getCookie, setCookie, eraseCookie } from '../../../shared/lib/cookieUtils';

export function useWorkflowManagement(refreshTrigger?: number) {
    const { user: currentUser } = useAuthStore();
    const { activeClientId, setAssignedUsers } = useClientStore();
    const [assignedUsers, setAssignedUsersState] = useState<AssignedUser[]>([]);
    const [workflowsByOwner, setWorkflowsByOwner] = useState<Record<string, Workflow[]>>({});
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);

    const [isCreating, setIsCreating] = useState(false);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
    const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);

    // Auto-close workflow if it doesn't belong to the active context (client or personal)
    useEffect(() => {
        if (activeWorkflow) {
            if (activeWorkflow.owner_id === 'common') {
                return;
            }
            const isPersonal = activeWorkflow.owner_id === currentUser?.id;
            const belongsToActiveClient = activeClientId && activeWorkflow.owner_id === activeClientId;

            if (!isPersonal && !belongsToActiveClient) {
                setActiveWorkflow(null);
            }
        }
    }, [activeClientId, activeWorkflow, currentUser?.id, currentUser?.role]);

    const loadWorkflowsForUser = useCallback(async (userId: string, isPersonal = false) => {
        try {
            const normalizedUserId = userId.toLowerCase();
            const { data } = await apiClient.get(`/workflows/users/${normalizedUserId}/workflows`);

            setWorkflowsByOwner(prev => {
                const newState = { ...prev };
                if (isPersonal) {
                    newState['personal'] = data;
                } else {
                    newState[normalizedUserId] = data;
                }
                return newState;
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

                // 1. Load personal workflows
                if (currentUser?.id) {
                    await loadWorkflowsForUser(currentUser.id, true);
                }

                // 2. Load common workflows
                const { data: commonWfs } = await apiClient.get('/workflows/common');
                setWorkflowsByOwner(prev => ({ ...prev, common: commonWfs }));

                // 3. Load other users' workflows (avoiding re-loading personal if possible)
                for (const user of users) {
                    if (user.id.toLowerCase() === currentUser?.id?.toLowerCase()) continue;
                    await loadWorkflowsForUser(user.id);
                }

                // 4. Restore active workflow from cookie for admin
                if (currentUser?.role === 'admin') {
                    const savedWorkflowId = getCookie('active_workflow_id');
                    if (savedWorkflowId) {
                        // Check if we have this workflow in our loaded state
                        apiClient.get(`/workflows/workflows/${savedWorkflowId}`).then((r) => {
                            setActiveWorkflow(r.data);
                        }).catch(() => {
                            // If it fails to load (e.g. deleted), just ignore
                        });
                    }
                }
            } catch (e) {
                console.error("Initialization failed", e);
            }
        };
        init();
    }, [currentUser?.id, currentUser?.role, loadWorkflowsForUser, setAssignedUsers]);

    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            apiClient.get('/workflows/node-types').then(res => setNodeTypes(res.data)).catch(console.error);
        }
    }, [refreshTrigger]);

    const loadWorkflow = (wf: Workflow) => {
        if (currentUser?.role === 'admin') {
            setCookie('active_workflow_id', wf.id);
        }
        apiClient.get(`/workflows/workflows/${wf.id}`).then((r) => {
            setActiveWorkflow(r.data);
        }).catch((err) => {
            const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
            console.error(`[loadWorkflow] Failed to load workflow "${wf.name}":`, err?.response?.data || err);
            alert(`❌ Failed to load workflow "${wf.name}"\n\n${detail}`);
        });
    };

    const handleCreateWorkflow = async (name: string, ownerId: string, category: 'personal' | 'common' = 'personal') => {
        const normalizedOwnerId = ownerId.toLowerCase();
        const isCommon = normalizedOwnerId === 'common';
        const effectiveOwnerId = normalizedOwnerId === 'personal' ? currentUser?.id : normalizedOwnerId;
        if (!effectiveOwnerId) return;

        const effectiveCategory = isCommon ? 'common' : category;

        setIsCreating(true);
        try {
            const { data } = await apiClient.post('/workflows/workflows', {
                name,
                owner_id: effectiveOwnerId,
                category: effectiveCategory
            });

            setWorkflowsByOwner((prev) => ({
                ...prev,
                [normalizedOwnerId]: [...(prev[normalizedOwnerId] || []), data]
            }));
            loadWorkflow(data);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWorkflow = async () => {
        if (!workflowToDelete) return;

        try {
            await apiClient.delete(`/workflows/workflows/${workflowToDelete.id}`);

            setWorkflowsByOwner((prev) => {
                const newWorkflows = { ...prev };
                for (const ownerId in newWorkflows) {
                    newWorkflows[ownerId] = newWorkflows[ownerId].filter(w => w.id !== workflowToDelete.id);
                }
                return newWorkflows;
            });

            if (activeWorkflow?.id === workflowToDelete.id) {
                if (currentUser?.role === 'admin') {
                    eraseCookie('active_workflow_id');
                }
                setActiveWorkflow(null);
            }
        } catch (error) {
            console.error('Failed to delete workflow', error);
        } finally {
            setWorkflowToDelete(null);
        }
    };

    const handleRenameWorkflow = async (workflowId: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            const { data } = await apiClient.patch(`/workflows/workflows/${workflowId}/rename`, {
                name: newName,
            });

            setWorkflowsByOwner((prev) => {
                const newWorkflows = { ...prev };
                for (const ownerId in newWorkflows) {
                    newWorkflows[ownerId] = newWorkflows[ownerId].map(w =>
                        w.id === workflowId ? { ...w, name: data.name } : w
                    );
                }
                return newWorkflows;
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
        workflowsByOwner,
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
        handleRenameWorkflow,
        setActiveWorkflow
    };
}
