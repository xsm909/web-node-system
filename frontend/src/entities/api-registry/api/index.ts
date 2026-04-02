import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { ApiRegistry } from '../model/types';

export const useApiRegistries = (projectId?: string | null) => {
    return useQuery({
        queryKey: ['api-registries', projectId],
        queryFn: async () => {
            const params: any = {};
            if (projectId) {
                params.project_id = projectId;
            }
            console.log(`[API Registry] GET /admin/api-registry params:`, params);
            const response = await apiClient.get<ApiRegistry[]>('/admin/api-registry', { params });
            return response.data;
        },
    });
};

export const useApiRegistry = (id: string | undefined | null) => {
    return useQuery({
        queryKey: ['api-registry', id],
        queryFn: async () => {
            if (!id) throw new Error("id is required");
            console.log(`[API Registry] GET /admin/api-registry/${id}`);
            const response = await apiClient.get<ApiRegistry>(`/admin/api-registry/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
};

export const useCreateApiRegistry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<ApiRegistry>) => {
            console.log(`[API Registry] POST /admin/api-registry payload:`, data);
            const response = await apiClient.post<ApiRegistry>('/admin/api-registry', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['api-registries'] });
        },
    });
};

export const useUpdateApiRegistry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<ApiRegistry> }) => {
            console.log(`[API Registry] PUT /admin/api-registry/${id} payload:`, data);
            const response = await apiClient.put<ApiRegistry>(`/admin/api-registry/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['api-registries'] });
        },
    });
};

export const useDeleteApiRegistry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/admin/api-registry/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['api-registries'] });
        },
    });
};
