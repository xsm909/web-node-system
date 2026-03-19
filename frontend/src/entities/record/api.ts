import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import type { Schema } from '../schema/api';

export interface Record {
    id: string;
    schema_id: string;
    parent_id: string | null;
    entity_id: string | null;
    entity_type: string | null;
    data: any;
    order: number;
    created_at: string;
    updated_at: string;
    lock: boolean;
    schema?: Schema;
    children?: Record[];
}

export interface CreateRecordDto {
    schema_id: string;
    parent_id?: string | null;
    entity_id?: string | null;
    entity_type?: string | null;
    data: any;
    lock?: boolean;
    order?: number;
}

export interface UpdateRecordDto {
    data?: any;
    lock?: boolean;
    entity_id?: string | null;
    entity_type?: string | null;
}

// Queries
export const useRecords = () => {
    return useQuery({
        queryKey: ['records'],
        queryFn: async () => {
            const response = await apiClient.get<Record[]>('/records');
            return response.data;
        },
    });
};

// --- Entity Metadata ---
export const useEntityMetadata = (entityType: string, entityId: string) => {
  return useQuery({
    queryKey: ['records', 'entity', entityType, entityId],
    queryFn: async () => {
      const response = await apiClient.get<Record[]>(`/records/entity/${entityType}/${entityId}`);
      return response.data;
    },
    enabled: !!entityType && !!entityId,
  });
};

// Mutations
export const useCreateRecord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateRecordDto) => {
            const response = await apiClient.post<Record>('/records', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
        },
    });
};

export const useUpdateRecord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateRecordDto }) => {
            const response = await apiClient.put<Record>(`/records/${id}`, data);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
            if (data.entity_type && data.entity_id) {
                queryClient.invalidateQueries({ queryKey: ['records', 'entity', data.entity_type, data.entity_id] });
            }
        },
    });
};

export const useDeleteRecord = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/records/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
        },
    });
};

export const useReorderRecords = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (orders: { id: string; order: number }[]) => {
            await apiClient.patch('/records/reorder', orders);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
        },
    });
};

// --- Compatibility Hooks (Deprecated) ---
// These are kept to allow the build to pass while components are refactored
export const useAssignMetadata = () => {
    const create = useCreateRecord();
    return {
        ...create,
        mutateAsync: async (dto: CreateRecordDto) => create.mutateAsync(dto)
    };
};

export const useUnassignMetadata = () => {
    const del = useDeleteRecord();
    return {
        ...del,
        mutateAsync: async (id: string) => del.mutateAsync(id)
    };
};
