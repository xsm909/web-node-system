import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../model/clientStore';
import { useProjectStore } from '../../projects/store';

export function useWorkflowManagement(refreshTrigger?: number) {
    const { user: currentUser } = useAuthStore();
    const { activeClientId, setAssignedUsers } = useClientStore();
    const [assignedUsers, setAssignedUsersState] = useState<AssignedUser[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const { activeProject, isProjectMode } = useProjectStore();

    const [isCreating, setIsCreating] = useState(false);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
    const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);

    // Auto-close workflow if it doesn't belong to the active context (client or current user)
    useEffect(() => {
        if (activeWorkflow) {
            const isPersonal = activeWorkflow.owner_id === currentUser?.id;
            const belongsToActiveClient = activeClientId && activeWorkflow.owner_id === activeClientId;
            const belongsToActiveProject = isProjectMode && activeProject && activeWorkflow.project_id === activeProject.id;

            if (!isPersonal && !belongsToActiveClient && !belongsToActiveProject) {
                setActiveWorkflow(null);
            }
        }
    }, [activeClientId, activeWorkflow, currentUser?.id]);

    useEffect(() => {
        const init = async () => {
            try {
                // Clear state when switching project/mode to ensure isolation
                setWorkflows([]);
                setActiveWorkflow(null);

                const [nodeTypesRes, usersRes] = await Promise.all([
                    apiClient.get('/workflows/node-types'),
                    apiClient.get('/workflows/users')
                ]);
                
                setNodeTypes(nodeTypesRes.data);
                const users = usersRes.data;
                setAssignedUsersState(users); // Keep this to update local state
                setAssignedUsers(users);

                // Collect all workflows locally to avoid race conditions with multiple setWorkflows
                let allWfs: Workflow[] = [];

                // 2. Load workflows for current user
                if (currentUser?.id) {
                    try {
                        const myWfsRes = await apiClient.get(`/workflows/users/${currentUser.id.toLowerCase()}/workflows`);
                        allWfs = [...allWfs, ...myWfsRes.data];
                    } catch (e) {
                        console.error(`Failed to load workflows for user ${currentUser.id}`, e);
                    }
                }

                // 3. Load workflows for clients
                // Use Promise.all to load concurrently but merge correctly
                const clientPromises = users
                    .filter((u: AssignedUser) => u.id.toLowerCase() !== currentUser?.id?.toLowerCase())
                    .map((u: AssignedUser) => apiClient.get(`/workflows/users/${u.id.toLowerCase()}/workflows`).catch(() => ({ data: [] })));
                
                const clientResults = await Promise.all(clientPromises);
                clientResults.forEach((res: any) => {
                    allWfs = [...allWfs, ...res.data];
                });

                setWorkflows(allWfs);
            } catch (e) {
                console.error("Initialization failed", e);
            }
        };

        if (currentUser?.id) {
            init();
        }
    }, [currentUser?.id, setAssignedUsers, isProjectMode, activeProject?.id]);

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

    const handleCreateWorkflow = async (name: string, category: string = 'general', project_id?: string | null, owner_id?: string | null) => {
        if (!currentUser?.id) return;

        setIsCreating(true);
        try {
            const finalOwnerId = owner_id || (isProjectMode ? activeProject?.owner_id : activeClientId) || currentUser.id;
            const { data } = await apiClient.post('/workflows/workflows', {
                name,
                category,
                owner_id: finalOwnerId,
                project_id: project_id || activeProject?.id || null
            });

            setWorkflows((prev) => [...prev, data]);
            loadWorkflow(data);
            return data;
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
        setActiveWorkflow,
        setWorkflows
    };
}
