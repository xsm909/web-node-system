import { useState, useCallback } from 'react';
import { apiClient } from '../../../shared/api/client';

export interface Preset {
    id: string;
    entity_type: string;
    name: string;
    category?: string;
    preset_data: any;
}

export const usePresets = (entityType: string) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPresets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<Preset[]>(`/presets/`, {
                params: { entity_type: entityType }
            });
            setPresets(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch presets');
        } finally {
            setIsLoading(false);
        }
    }, [entityType]);

    const savePreset = useCallback(async (name: string, data: any, category?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.post<Preset>(`/presets/`, {
                entity_type: entityType,
                name,
                category,
                preset_data: data
            });
            await fetchPresets();
            return response.data;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to save preset';
            setError(msg);
            throw new Error(msg);
        } finally {
            setIsLoading(false);
        }
    }, [entityType, fetchPresets]);

    const deletePreset = useCallback(async (presetId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await apiClient.delete(`/presets/${presetId}`);
            setPresets(prev => prev.filter(p => p.id !== presetId));
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete preset');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        presets,
        isLoading,
        error,
        fetchPresets,
        savePreset,
        deletePreset
    };
};
