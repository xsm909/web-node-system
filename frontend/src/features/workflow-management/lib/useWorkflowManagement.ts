import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import { useAuthStore } from '../../auth/store';
import type { AssignedUser } from '../../../entities/user/model/types';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useClientStore } from '../model/clientStore';
import { useProjectStore } from '../../projects/store';

export function useWorkflowManagement(refreshTrigger?: number, projectId?: string | null) {
    // Atomic Selectors for stability
    const currentUser = useAuthStore(s => s.user);
    const activeClientId = useClientStore(s => s.activeClientId);
    const setAssignedUsers = useClientStore(s => s.setAssignedUsers);
    
    const baseProject = useProjectStore(s => s.baseProject);
    const isBaseProjectMode = useProjectStore(s => s.isBaseProjectMode);
    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);

    const [assignedUsers, setAssignedUsersState] = useState<AssignedUser[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    
    // Determine the effective context for this hook instance.
    const effectiveProjectId = projectId !== undefined ? projectId : (isBaseProjectMode ? (baseProject?.id || null) : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isBaseProjectMode;

    const [isCreating, setIsCreating] = useState(false);
    const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
    const [workflowToRename, setWorkflowToRename] = useState<Workflow | null>(null);
    const [workflowError, setWorkflowError] = useState<string | null>(null);

    // Auto-close workflow if it doesn't belong to the active context
    useEffect(() => {
        if (activeWorkflow && currentUser) {
            const isAdmin = currentUser.role === 'admin';
            const isPersonal = activeWorkflow.owner_id === currentUser.id;
            const belongsToActiveClient = activeClientId && activeWorkflow.owner_id === activeClientId;
            
            // Check Project Alignment
            const workflowProject = activeWorkflow.project_id || null;
            const belongsToActiveProject = effectiveIsProjectMode && effectiveProjectId && workflowProject === effectiveProjectId;
            const matchesGlobalContext = !effectiveIsProjectMode && !workflowProject;

            // admins are generally allowed to see everything, but we still want to maintain some separation.
            // however, to prevent infinite loops during context switching, we must allow 
            // shared global workflows in global mode and respect admin status.
            const isAllowed = isAdmin || isPersonal || belongsToActiveClient || belongsToActiveProject || matchesGlobalContext;

            if (!isAllowed) {
                console.log('[useWorkflowManagement] Auto-closing workflow due to context mismatch', {
                    workflowId: activeWorkflow.id,
                    workflowProject,
                    effectiveProjectId,
                    effectiveIsProjectMode
                });
                setActiveWorkflow(null);
            }
        }
    }, [activeClientId, activeWorkflow, currentUser, effectiveIsProjectMode, effectiveProjectId]);

    const lastLoadedContextRef = useRef<{ id: string | null, isProjectMode: boolean } | null>(null);

    const init = useCallback(async () => {
        if (lastLoadedContextRef.current?.id === effectiveProjectId && 
            lastLoadedContextRef.current?.isProjectMode === effectiveIsProjectMode) {
            return;
        }
        
        lastLoadedContextRef.current = { id: effectiveProjectId, isProjectMode: effectiveIsProjectMode };

        try {
            setWorkflows([]);
            setActiveWorkflow(null);
            
            const headers: Record<string, string> = {};
            const targetProjectId = projectId !== undefined ? projectId : (isBaseProjectMode ? (baseProject?.id || null) : null);
            
            if (targetProjectId) {
                headers['X-Force-Project-Id'] = targetProjectId;
            } else if (projectId === null || (!isBaseProjectMode && projectId === undefined)) {
                headers['X-Project-Skip'] = 'true';
            }

            const [nodeTypesRes, usersRes] = await Promise.all([
                apiClient.get(`/workflows/node-types?t=${Date.now()}`, { headers }),
                apiClient.get('/workflows/users', { headers })
            ]);
            
            setNodeTypes(nodeTypesRes.data);
            const users = usersRes.data;
            setAssignedUsersState(users);
            setAssignedUsers(users);

            let allWfs: Workflow[] = [];

            if (currentUser?.id) {
                try {
                    const myWfsRes = await apiClient.get(`/workflows/users/${currentUser.id.toLowerCase()}/workflows`, { headers });
                    allWfs = [...allWfs, ...myWfsRes.data];
                } catch (e) {
                    console.error(`Failed to load workflows for user ${currentUser.id}`, e);
                }
            }

            const clientPromises = users
                .filter((u: AssignedUser) => u.id.toLowerCase() !== currentUser?.id?.toLowerCase())
                .map((u: AssignedUser) => apiClient.get(`/workflows/users/${u.id.toLowerCase()}/workflows`, { headers }).catch(() => ({ data: [] })));
            
            const clientResults = await Promise.all(clientPromises);
            clientResults.forEach((res: any) => {
                allWfs = [...allWfs, ...res.data];
            });

            setWorkflows(allWfs);
        } catch (e) {
            console.error("Initialization failed", e);
        }
    }, [effectiveProjectId, effectiveIsProjectMode, projectId, isBaseProjectMode, baseProject?.id, currentUser?.id, setAssignedUsers]);

    useEffect(() => {
        if (currentUser?.id) {
            init();
        }
    }, [currentUser?.id, init]);

    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            apiClient.get(`/workflows/node-types?t=${Date.now()}`).then(res => setNodeTypes(res.data)).catch(console.error);
        }
    }, [refreshTrigger]);

    const loadWorkflow = useCallback(async (wf: Workflow) => {
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
    }, [setActiveWorkflow]);

    const handleCreateWorkflow = useCallback(async (name: string, category: string = 'general', project_id?: string | null, owner_id?: string | null) => {
        if (!currentUser?.id) return;

        setIsCreating(true);
        try {
            const finalOwnerId = owner_id || (isProjectMode ? activeProject?.owner_id : activeClientId) || currentUser.id;
            const { data } = await apiClient.post('/workflows/workflows', {
                name,
                category,
                owner_id: finalOwnerId,
                project_id: project_id !== undefined ? project_id : (projectId || activeProject?.id || null)
            });

            setWorkflows((prev) => [...prev, data]);
            loadWorkflow(data);
            return data;
        } finally {
            setIsCreating(false);
        }
    }, [currentUser?.id, isProjectMode, activeProject?.owner_id, activeProject?.id, activeClientId, projectId, loadWorkflow]);

    const confirmDeleteWorkflow = useCallback(async () => {
        if (!workflowToDelete) return;

        try {
            setWorkflowError(null);
            await apiClient.delete(`/workflows/workflows/${workflowToDelete.id}`);

            setWorkflows((prev) => prev.filter(w => w.id !== workflowToDelete.id));

            if (activeWorkflow?.id === workflowToDelete.id) {
                setActiveWorkflow(null);
            }
            setWorkflowToDelete(null);
        } catch (error: any) {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to delete workflow';
            setWorkflowError(typeof detail === 'string' ? detail : JSON.stringify(detail));
            console.error('Failed to delete workflow', error);
        }
    }, [workflowToDelete, activeWorkflow?.id, setActiveWorkflow]);

    const handleDuplicateWorkflow = useCallback(async (workflowId: string) => {
        try {
            const { data } = await apiClient.post(`/workflows/workflows/${workflowId}/duplicate`);
            setWorkflows((prev) => [...prev, data]);
            return data;
        } catch (error) {
            console.error('Failed to duplicate workflow', error);
            throw error;
        }
    }, []);

    const handleRenameWorkflow = useCallback(async (workflowId: string, newName: string, newCategory?: string) => {
        if (!newName.trim()) return;
        try {
            setWorkflowError(null);
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
            setWorkflowToRename(null);
        } catch (error: any) {
            const detail = error?.response?.data?.detail || error?.message || 'Failed to rename workflow';
            setWorkflowError(typeof detail === 'string' ? detail : JSON.stringify(detail));
            console.error('Failed to rename workflow', error);
        }
    }, [activeWorkflow?.id, setActiveWorkflow]);

    return useMemo(() => ({
        assignedUsers,
        workflows,
        activeWorkflow,
        nodeTypes,
        isCreating,
        workflowToDelete,
        workflowToRename,
        workflowError,
        currentUser,
        setWorkflowToDelete,
        setWorkflowToRename,
        setWorkflowError,
        loadWorkflow,
        handleCreateWorkflow,
        confirmDeleteWorkflow,
        handleDuplicateWorkflow,
        handleRenameWorkflow,
        setActiveWorkflow,
        setWorkflows,
        activeProjectId: effectiveProjectId
    }), [
        assignedUsers, workflows, activeWorkflow, nodeTypes, isCreating, 
        workflowToDelete, workflowToRename, workflowError, currentUser,
        loadWorkflow, handleCreateWorkflow, confirmDeleteWorkflow,
        handleDuplicateWorkflow, handleRenameWorkflow, effectiveProjectId
    ]);
}
