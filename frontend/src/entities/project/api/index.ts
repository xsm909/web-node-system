import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { Project, ProjectCreate, ProjectUpdate } from '../model/types';

export const useProjects = (owner_id?: string) => {
    return useQuery({
        queryKey: ['projects', owner_id],
        queryFn: async () => {
            const params = owner_id ? { owner_id } : {};
            const response = await apiClient.get<Project[]>('/projects', { params });
            return response.data;
        },
    });
};

export const useProject = (id: string) => {
    return useQuery({
        queryKey: ['project', id],
        queryFn: async () => {
            const response = await apiClient.get<Project>(`/projects/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
};

export const useCreateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: ProjectCreate) => {
            const response = await apiClient.post<Project>('/projects', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: ProjectUpdate }) => {
            const response = await apiClient.put<Project>(`/projects/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
        },
    });
};

export const useDeleteProject = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/projects/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
};
