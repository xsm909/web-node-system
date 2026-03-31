import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import { useProjectStore } from '../../../features/projects/store';
import type { Report, ReportStyle } from '../model/types';

// Reports Queries
export const useReports = (projectId?: string | null) => {
    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);
    
    // Determine effective project to use for the query (Sidebar vs Prop)
    const effectiveProjectId = projectId !== undefined ? projectId : (isProjectMode ? activeProject?.id : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isProjectMode;

    return useQuery({
        queryKey: ['reports', effectiveIsProjectMode, effectiveProjectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            } else if (projectId === undefined && isProjectMode && activeProject) {
                config.headers = { 'X-Force-Project-Id': activeProject.id };
            }
            const response = await apiClient.get<Report[]>('/reports', config);
            return response.data;
        },
    });
};

export const useReport = (id: string | undefined) => {
    return useQuery({
        queryKey: ['report', id],
        queryFn: async () => {
            if (!id) throw new Error("id is required");
            const response = await apiClient.get<Report>(`/reports/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
};

// Report Mutations
export const useCreateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<Report> & { project_id?: string | null }) => {
            const response = await apiClient.post<Report>('/reports', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

export const useUpdateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Report> }) => {
            const response = await apiClient.put<Report>(`/reports/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
            queryClient.invalidateQueries({ queryKey: ['report', variables.id] });
        },
    });
};

export const useDeleteReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/reports/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

export const useDuplicateReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await apiClient.post<Report>(`/reports/${id}/duplicate`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

export const useReorderReports = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids: string[]) => {
            await apiClient.put('/reports/reorder', { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
};

// Styles Queries
export const useStyles = (projectId?: string | null) => {
    const activeProject = useProjectStore(s => s.activeProject);
    const isProjectMode = useProjectStore(s => s.isProjectMode);
    
    // Determine effective project to use for the query (Sidebar vs Prop)
    const effectiveProjectId = projectId !== undefined ? projectId : (isProjectMode ? activeProject?.id : null);
    const effectiveIsProjectMode = projectId !== undefined ? !!projectId : isProjectMode;

    return useQuery({
        queryKey: ['report-styles', effectiveIsProjectMode, effectiveProjectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            } else if (projectId === undefined && isProjectMode && activeProject) {
                config.headers = { 'X-Force-Project-Id': activeProject.id };
            }
            const response = await apiClient.get<ReportStyle[]>('/reports/styles', config);
            return response.data;
        },
    });
};

export const useStyle = (id: string | undefined) => {
    return useQuery({
        queryKey: ['report-style', id],
        queryFn: async () => {
            if (!id) throw new Error("id is required");
            const response = await apiClient.get<ReportStyle>(`/reports/styles/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
};


// Style Mutations
export const useCreateStyle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<ReportStyle>) => {
            const response = await apiClient.post<ReportStyle>('/reports/styles', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['report-styles'] });
        },
    });
};

export const useUpdateStyle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ReportStyle> }) => {
            const response = await apiClient.put<ReportStyle>(`/reports/styles/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['report-styles'] });
        },
    });
};

export const useDeleteStyle = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/reports/styles/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['report-styles'] });
        },
    });
};
