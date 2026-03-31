import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { useProjectStore } from '../../features/projects/store';

export interface Schema {
    id: string;
    key: string;
    content: any; // The JSON schema object
    category?: string | null;
    meta?: any;
    is_system: boolean;
    is_locked: boolean;
    created_at: string;
    updated_at: string;
    project_id?: string | null;
}

export interface CreateSchemaDto {
    key: string;
    content: any;
    category?: string | null;
    meta?: any;
    is_system: boolean;
    project_id?: string | null;
}

export interface UpdateSchemaDto {
    key?: string;
    content?: any;
    category?: string | null;
    meta?: any;
    is_system?: boolean;
}

// Queries
export const useSchemas = (projectId?: string | null) => {
    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);
    
    // Determine effective project to use for the query (Sidebar vs Prop)
    const effectiveProjectId = projectId !== undefined ? projectId : (isProjectMode ? activeProject?.id : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isProjectMode;

    return useQuery({
        queryKey: ['schemas', effectiveIsProjectMode, effectiveProjectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                // Force global mode by bypassing interceptor
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                // Explicit project passed via prop (Pinned Tabs)
                config.headers = { 'X-Force-Project-Id': projectId };
            } else if (projectId === undefined && isProjectMode && activeProject) {
                // Sidebar mode: explicitly set the active project to avoid any context leaks
                config.headers = { 'X-Force-Project-Id': activeProject.id };
            }

            const response = await apiClient.get<Schema[]>('/schemas', config);
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
export const useCreateSchema = (projectId?: string | null) => {
    const queryClient = useQueryClient();
    const { activeProject } = useProjectStore();
    return useMutation({
        mutationFn: async (data: CreateSchemaDto) => {
            // Priority: data.project_id > hook's projectId > global activeProject?.id
            let project_id = data.project_id;
            if (project_id === undefined) {
                project_id = projectId !== undefined ? projectId : activeProject?.id;
            }
            const response = await apiClient.post<Schema>('/schemas', { ...data, project_id });
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
