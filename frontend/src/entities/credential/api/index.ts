import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../model/types';

export const useCredentials = () => {
    return useQuery({
        queryKey: ['credentials'],
        queryFn: async () => {
            const response = await apiClient.get<Credential[]>('/admin/credentials');
            return response.data;
        },
    });
};

export const useCredential = (id: string | undefined | null) => {
    return useQuery({
        queryKey: ['credential', id],
        queryFn: async () => {
            if (!id || id === 'new') return null;
            const response = await apiClient.get<Credential>(`/admin/credentials/${id}`);
            return response.data;
        },
        enabled: !!id && id !== 'new',
    });
};


export const useCreateCredential = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<Credential>) => {
            const response = await apiClient.post<Credential>('/admin/credentials', data);
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
            const response = await apiClient.put<Credential>(`/admin/credentials/${id}`, data);
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
            await apiClient.delete(`/admin/credentials/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
    });
};
