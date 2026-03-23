import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { useProjectStore } from '../../features/projects/store';
import type { Schema } from '../schema/api';

export interface Metadata {
    id: string;
    schema_id: string;
    parent_id: string | null;
    entity_id: string | null;
    entity_type: string | null;
    data: any;
    order: number;
    created_at: string;
    updated_at: string;
    is_locked: boolean;
    schema?: Schema;
    children?: Metadata[];
}

export interface CreateMetadataDto {
    schema_id: string;
    parent_id?: string | null;
    entity_id?: string | null;
    entity_type?: string | null;
    data: any;
    order?: number;
}

export interface UpdateMetadataDto {
    data?: any;
    entity_id?: string | null;
    entity_type?: string | null;
}

// Queries
export const useMetadataList = () => {
    const { activeProject, isProjectMode } = useProjectStore();
    return useQuery({
        queryKey: ['metadata', isProjectMode, activeProject?.id],
        queryFn: async () => {
            const response = await apiClient.get<Metadata[]>('/metadata');
            return response.data;
        },
    });
};

// --- Entity Metadata ---
export const useEntityMetadata = (entityType: string, entityId: string) => {
  return useQuery({
    queryKey: ['metadata', 'entity', entityType, entityId],
    queryFn: async () => {
      const response = await apiClient.get<Metadata[]>(`/metadata/entity/${entityType}/${entityId}`);
      return response.data;
    },
    enabled: !!entityType && !!entityId,
  });
};

// Mutations
export const useCreateMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateMetadataDto) => {
            const response = await apiClient.post<Metadata>('/metadata', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metadata'] });
        },
    });
};

export const useUpdateMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateMetadataDto }) => {
            const response = await apiClient.put<Metadata>(`/metadata/${id}`, data);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['metadata'] });
            if (data.entity_type && data.entity_id) {
                queryClient.invalidateQueries({ queryKey: ['metadata', 'entity', data.entity_type, data.entity_id] });
            }
        },
    });
};

export const useDeleteMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/metadata/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metadata'] });
        },
    });
};

export const useReorderMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (orders: { id: string; order: number }[]) => {
            await apiClient.patch('/metadata/reorder', orders);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metadata'] });
        },
    });
};

// --- Compatibility Hooks (Deprecated) ---
// These are kept to allow the build to pass while components are refactored
// But they now point to the new metadata endpoints
export const useRecords = useMetadataList;
export const useCreateRecord = useCreateMetadata;
export const useUpdateRecord = useUpdateMetadata;
export const useDeleteRecord = useDeleteMetadata;
export const useReorderRecords = useReorderMetadata;

export const useAssignMetadata = () => {
    const create = useCreateMetadata();
    return {
        ...create,
        mutateAsync: async (dto: CreateMetadataDto) => create.mutateAsync(dto)
    };
};

export const useUnassignMetadata = () => {
    const del = useDeleteMetadata();
    return {
        ...del,
        mutateAsync: async (id: string) => del.mutateAsync(id)
    };
};
