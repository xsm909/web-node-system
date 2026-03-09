import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';

export interface Record {
    id: string;
    schema_id: string;
    data: any;
    created_at: string;
    updated_at: string;
}

export interface MetaAssignment {
    id: string;
    record_id: string;
    entity_type: string;
    entity_id: string;
    assigned_by: string;
    owner_id?: string;
    created_at: string;
}

export interface CreateRecordDto {
    schema_id: string;
    data: any;
}

export interface UpdateRecordDto {
    data: any;
}

export interface AssignMetadataDto {
    record_id: string;
    entity_type: string;
    entity_id: string;
    owner_id?: string;
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

export const useEntityMetadata = (entityType: string, entityId: string | undefined) => {
    return useQuery({
        queryKey: ['meta_assignments', entityType, entityId],
        queryFn: async () => {
            if (!entityId || !entityType) throw new Error("Entity params required");
            const response = await apiClient.get<MetaAssignment[]>(`/records/entity/${entityType}/${entityId}`);
            return response.data;
        },
        enabled: !!entityId && !!entityType,
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records'] });
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

export const useAssignMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: AssignMetadataDto) => {
            const response = await apiClient.post<MetaAssignment>('/records/assign', data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['meta_assignments', variables.entity_type, variables.entity_id] });
        },
    });
};
export const useUnassignMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
            await apiClient.delete(`/records/assign/${assignmentId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meta_assignments'] });
            queryClient.invalidateQueries({ queryKey: ['records'] });
        },
    });
};
