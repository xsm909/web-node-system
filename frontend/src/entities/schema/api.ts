import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';

export interface Schema {
    id: string;
    key: string;
    content: any; // The JSON schema object
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateSchemaDto {
    key: string;
    content: any;
    is_system: boolean;
}

export interface UpdateSchemaDto {
    key?: string;
    content?: any;
    is_system?: boolean;
}

// Queries
export const useSchemas = () => {
    return useQuery({
        queryKey: ['schemas'],
        queryFn: async () => {
            const response = await apiClient.get<Schema[]>('/schemas');
            return response.data;
        },
    });
};

export const useSchema = (schemaId: string | undefined) => {
    return useQuery({
        queryKey: ['schemas', schemaId],
        queryFn: async () => {
            if (!schemaId) throw new Error("schemaId is required");
            const response = await apiClient.get<Schema>(`/schemas/${schemaId}`);
            return response.data;
        },
        enabled: !!schemaId,
    });
};

// Mutations
export const useCreateSchema = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateSchemaDto) => {
            const response = await apiClient.post<Schema>('/schemas', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schemas'] });
        },
    });
};

export const useUpdateSchema = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateSchemaDto }) => {
            const response = await apiClient.put<Schema>(`/schemas/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['schemas'] });
            queryClient.invalidateQueries({ queryKey: ['schemas', variables.id] });
        },
    });
};

export const useDeleteSchema = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/schemas/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schemas'] });
        },
    });
};

export const useRefreshExternalCache = () => {
    return useMutation({
        mutationFn: async (url: string) => {
            const response = await apiClient.post(`/schemas/cache/refresh?url=${encodeURIComponent(url)}`);
            return response.data;
        }
    });
};
