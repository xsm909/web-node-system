import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../model/clientStore';
import { useProjectStore } from '../../projects/store';

export function useWorkflowManagement(_refreshTrigger?: number, projectId?: string | null) {
    const queryClient = useQueryClient();
    
    // Atomic Selectors for stability
    const currentUser = useAuthStore(s => s.user);
    const activeClientId = useClientStore(s => s.activeClientId);
    const setAssignedUsers = useClientStore(s => s.setAssignedUsers);
    
    const baseProject = useProjectStore(s => s.baseProject);
    const isBaseProjectMode = useProjectStore(s => s.isBaseProjectMode);
    
    // Determine the effective context for this hook instance.
    const effectiveProjectId = projectId !== undefined ? projectId : (isBaseProjectMode ? (baseProject?.id || null) : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isBaseProjectMode;

    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
    const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);
    const [workflowError, setWorkflowError] = useState<string | null>(null);

    // 1. Fetch Node Types (Global Query)
    const { data: nodeTypes = [] } = useQuery({
        queryKey: ['node-types', effectiveProjectId],
        queryFn: async () => {
            const headers: Record<string, string> = {};
            if (effectiveProjectId) headers['X-Force-Project-Id'] = effectiveProjectId;
            else headers['X-Project-Skip'] = 'true';
            
            const res = await apiClient.get<NodeType[]>(`/workflows/node-types?t=${Date.now()}`, { headers });
            return res.data;
        },
        enabled: !!currentUser?.id
    });

    // 2. Fetch Assigned Users (Global Query)
    const { data: assignedUsers = [] } = useQuery({
        queryKey: ['assigned-users', effectiveProjectId],
        queryFn: async () => {
            const headers: Record<string, string> = {};
            if (effectiveProjectId) headers['X-Force-Project-Id'] = effectiveProjectId;
            else headers['X-Project-Skip'] = 'true';
            
            const res = await apiClient.get<AssignedUser[]>('/workflows/users', { headers });
            setAssignedUsers(res.data); // Keep the store in sync for now
            return res.data;
        },
        enabled: !!currentUser?.id
    });

    // 3. Fetch All Workflows (Global Query)
    const { data: workflows = [], isLoading: isWorkflowsLoading, refetch: refetchWorkflows } = useQuery({
        queryKey: ['workflows', effectiveProjectId, assignedUsers],
        queryFn: async () => {
            if (!currentUser?.id) return [];

            const headers: Record<string, string> = {};
            if (effectiveProjectId) headers['X-Force-Project-Id'] = effectiveProjectId;
            else headers['X-Project-Skip'] = 'true';

            let allWfs: Workflow[] = [];

            // Fetch my workflows
            try {
                const myWfsRes = await apiClient.get<Workflow[]>(`/workflows/users/${currentUser.id.toLowerCase()}/workflows`, { headers });
                allWfs = [...allWfs, ...myWfsRes.data];
            } catch (e) {
                console.error(`Failed to load workflows for user ${currentUser.id}`, e);
            }

            // Fetch assigned client workflows
            const clientPromises = assignedUsers
                .filter((u: AssignedUser) => u.id.toLowerCase() !== currentUser?.id?.toLowerCase())
                .map((u: AssignedUser) => apiClient.get<Workflow[]>(`/workflows/users/${u.id.toLowerCase()}/workflows`, { headers }).catch(() => ({ data: [] })));
            
            const clientResults = await Promise.all(clientPromises);
            clientResults.forEach((res: any) => {
                allWfs = [...allWfs, ...res.data];
            });

            return allWfs;
        },
        enabled: !!currentUser?.id && assignedUsers.length >= 0
    });

    // Auto-close workflow if context mismatch
    useEffect(() => {
        if (activeWorkflow && currentUser) {
            const isAdmin = currentUser.role === 'admin';
            const workflowProject = activeWorkflow.project_id || null;
            const matchesContext = effectiveIsProjectMode ? workflowProject === effectiveProjectId : !workflowProject;

            if (!isAdmin && !matchesContext) {
                setActiveWorkflow(null);
            }
        }
    }, [activeWorkflow, currentUser, effectiveIsProjectMode, effectiveProjectId]);

    // Mutations
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['workflows', effectiveProjectId] });
    };

    const createMutation = useMutation({
        mutationFn: async ({ name, category, project_id, owner_id }: any) => {
            const finalProjectId = project_id !== undefined ? project_id : (effectiveProjectId || null);
            const { data } = await apiClient.post<Workflow>('/workflows/workflows', {
                name,
                category,
                owner_id: owner_id || activeClientId || currentUser?.id,
                project_id: finalProjectId
            });
            return data;
        },
        onSuccess: (data) => {
            invalidate();
            setActiveWorkflow(data);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => apiClient.delete(`/workflows/workflows/${id}`),
        onSuccess: () => {
            invalidate();
            if (activeWorkflow?.id === workflowToDelete?.id) setActiveWorkflow(null);
            setWorkflowToDelete(null);
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to delete workflow';
            setWorkflowError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
    });

    const duplicateMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data } = await apiClient.post<Workflow>(`/workflows/workflows/${id}/duplicate`);
            return data;
        },
        onSuccess: invalidate
    });

    const renameMutation = useMutation({
        mutationFn: async ({ id, name, category }: any) => {
            const { data } = await apiClient.patch<Workflow>(`/workflows/workflows/${id}/rename`, { name, category });
            return data;
        },
        onSuccess: (data) => {
            invalidate();
            if (activeWorkflow?.id === data.id) setActiveWorkflow(data);
            setWorkflowToRename(null);
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to rename workflow';
            setWorkflowError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
    });

    const loadWorkflow = useCallback(async (wfOrId: Workflow | string) => {
        const id = typeof wfOrId === 'string' ? wfOrId : wfOrId.id;
        try {
            const r = await apiClient.get<Workflow>(`/workflows/workflows/${id}?t=${Date.now()}`);
            setActiveWorkflow(r.data);
            return r.data;
        } catch (err: any) {
            console.error(`[loadWorkflow] Failed to load workflow "${id}":`, err);
            throw err;
        }
    }, []);

    return useMemo(() => ({
        assignedUsers,
        workflows,
        activeWorkflow,
        nodeTypes,
        isCreating: createMutation.isPending,
        workflowToDelete,
        workflowToRename,
        workflowError,
        currentUser,
        setWorkflowToDelete,
        setWorkflowToRename,
        setWorkflowError,
        loadWorkflow,
        handleCreateWorkflow: (name: string, category: string, pid?: string | null, oid?: string | null) => 
            createMutation.mutateAsync({ name, category, project_id: pid, owner_id: oid }),
        confirmDeleteWorkflow: () => deleteMutation.mutateAsync(workflowToDelete?.id || ''),
        handleDuplicateWorkflow: (id: string) => duplicateMutation.mutateAsync(id),
        handleRenameWorkflow: (id: string, name: string, cat?: string) => renameMutation.mutateAsync({ id, name, category: cat }),
        setActiveWorkflow,
        setWorkflows: (wfs: Workflow[]) => queryClient.setQueryData(['workflows', effectiveProjectId], wfs),
        activeProjectId: effectiveProjectId,
        isLoading: isWorkflowsLoading,
        refetch: refetchWorkflows
    }), [
        assignedUsers, workflows, activeWorkflow, nodeTypes, createMutation, 
        workflowToDelete, workflowToRename, workflowError, currentUser,
        loadWorkflow, deleteMutation, duplicateMutation, renameMutation, 
        effectiveProjectId, isWorkflowsLoading, refetchWorkflows, queryClient
    ]);
}
