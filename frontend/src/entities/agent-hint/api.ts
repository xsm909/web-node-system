import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { useProjectStore } from '../../features/projects/store';

export interface AgentHint {
    id: string;
    key: string;
    category?: string | null;
    hint: string; // Markdown content
    meta?: any;
    created_by: string;
    created_at: string;
    updated_at: string;
    is_locked: boolean;
    system_hints: boolean;
    project_id?: string | null;
}

export interface CreateAgentHintDto {
    key: string;
    category?: string | null;
    hint: string;
    system_hints?: boolean;
    project_id?: string | null;
    meta?: any;
}

export interface UpdateAgentHintDto {
    category?: string | null;
    hint?: string;
    system_hints?: boolean;
    meta?: any;
}

// Queries
export const useAgentHints = (projectId?: string | null) => {
    const { baseProject, isBaseProjectMode } = useProjectStore();
    
    // Determine effective project to use for the query
    // Explicit projectId prop takes precedence (Pinned Tabs).
    // If undefined, use stable sidebar selection (baseProject).
    const effectiveProjectId = projectId !== undefined ? projectId : (isBaseProjectMode ? baseProject?.id : null);

    return useQuery({
        queryKey: ['agent-hints', effectiveProjectId],
        queryFn: async () => {
             const config: any = {};
            if (projectId === null) {
                // Force global mode by bypassing interceptor
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                // Explicit project passed via prop (Pinned Tabs)
                config.headers = { 'X-Force-Project-Id': projectId };
            } else if (projectId === undefined && isBaseProjectMode && baseProject) {
                // Sidebar mode: explicitly set the base project to avoid any shadowed context leaks
                config.headers = { 'X-Force-Project-Id': baseProject.id };
            }

            const response = await apiClient.get<AgentHint[]>('/agent-hints', config);
            return response.data;
        },
    });
};

export const useAgentHint = (id: string | undefined) => {
    return useQuery({
        queryKey: ['agent-hints', id],
        queryFn: async () => {
            if (!id) throw new Error("id is required");
            const response = await apiClient.get<AgentHint>(`/agent-hints/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
};

// Mutations
export const useCreateAgentHint = (projectId?: string | null) => {
    const queryClient = useQueryClient();
    const { activeProject } = useProjectStore();
    return useMutation({
        mutationFn: async (data: CreateAgentHintDto) => {
            // Priority: data.project_id > hook's projectId > global activeProject?.id
            let project_id = data.project_id;
            if (project_id === undefined) {
                project_id = projectId !== undefined ? projectId : activeProject?.id;
            }
            const response = await apiClient.post<AgentHint>('/agent-hints', { ...data, project_id });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-hints'] });
        },
    });
};

export const useUpdateAgentHint = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateAgentHintDto }) => {
            const response = await apiClient.patch<AgentHint>(`/agent-hints/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['agent-hints'] });
            queryClient.invalidateQueries({ queryKey: ['agent-hints', variables.id] });
        },
    });
};

export const useDeleteAgentHint = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/agent-hints/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent-hints'] });
        },
    });
};
