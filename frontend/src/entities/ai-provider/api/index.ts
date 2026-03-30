import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { AiProvider } from '../model/types';

export const useAiProviders = (projectId?: string | null) => {
    return useQuery({
        queryKey: ['ai-providers', projectId],
        queryFn: async () => {
             // Pass project context mostly to avoid error drops, even if not explicitly stored in AiProvider yet
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            }
            const response = await apiClient.get<AiProvider[]>('/admin/ai-providers', config);
            return response.data;
        },
    });
};

export const useCreateAiProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<AiProvider>) => {
            const response = await apiClient.post<AiProvider>('/admin/ai-providers', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
        },
    });
};

export const useUpdateAiProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<AiProvider> }) => {
            const response = await apiClient.patch<AiProvider>(`/admin/ai-providers/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
        },
    });
};

export const useDeleteAiProvider = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/admin/ai-providers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
        },
    });
};
