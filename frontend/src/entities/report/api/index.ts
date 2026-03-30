import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../model/types';

// Reports Queries
export const useReports = (projectId?: string | null) => {
    return useQuery({
        queryKey: ['reports', projectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
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
    return useQuery({
        queryKey: ['report-styles', projectId],
        queryFn: async () => {
            const config: any = {};
            if (projectId === null) {
                config.headers = { 'X-Project-Skip': 'true' };
            } else if (projectId) {
                config.headers = { 'X-Force-Project-Id': projectId };
            }
            const response = await apiClient.get<ReportStyle[]>('/reports/styles', config);
            return response.data;
        },
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
