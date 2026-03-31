import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import { useProjectStore } from '../../../features/projects/store';
import type { Credential } from '../model/types';

export const useCredentials = (projectId?: string | null) => {
    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);
    
    // Determine effective project to use for the query (Sidebar vs Prop)
    const effectiveProjectId = projectId !== undefined ? projectId : (isProjectMode ? activeProject?.id : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isProjectMode;

    return useQuery({
        queryKey: ['credentials', effectiveIsProjectMode, effectiveProjectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            } else if (projectId === undefined && isProjectMode && activeProject) {
                config.headers = { 'X-Force-Project-Id': activeProject.id };
            }
            const response = await apiClient.get<Credential[]>('/admin/credentials', config);
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
