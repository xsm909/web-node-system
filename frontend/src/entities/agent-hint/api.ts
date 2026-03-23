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
export const useAgentHints = () => {
    const { activeProject, isProjectMode } = useProjectStore();
    return useQuery({
        queryKey: ['agent-hints', isProjectMode, activeProject?.id],
        queryFn: async () => {
            const response = await apiClient.get<AgentHint[]>('/agent-hints');
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
export const useCreateAgentHint = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateAgentHintDto) => {
            const response = await apiClient.post<AgentHint>('/agent-hints', data);
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
