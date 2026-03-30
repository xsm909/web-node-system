import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../model/types';

export const useCredentials = (projectId?: string | null) => {
    return useQuery({
        queryKey: ['credentials', projectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            }
            const response = await apiClient.get<Credential[]>('/credentials', config);
            return response.data;
        },
    });
};

export const useCreateCredential = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<Credential>) => {
            const response = await apiClient.post<Credential>('/credentials', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
    });
};

export const useUpdateCredential = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Credential> }) => {
            const response = await apiClient.patch<Credential>(`/credentials/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
    });
};

export const useDeleteCredential = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/credentials/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
    });
};
