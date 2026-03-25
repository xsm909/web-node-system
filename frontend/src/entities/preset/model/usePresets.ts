import { useState, useCallback, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import { usePresetsContext } from './PresetsContext';

export interface Preset {
    id: string;
    entity_type: string;
    name: string;
    category?: string;
    preset_data: any;
}

export const usePresets = (entityType: string) => {
    const { 
        presetsMap, 
        setPresetsForType, 
        updatePresetInMap, 
        removePresetFromMap, 
        addPresetToMap 
    } = usePresetsContext();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const presets = useMemo(() => presetsMap[entityType] || [], [presetsMap, entityType]);

    const fetchPresets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<Preset[]>(`/presets/`, {
                params: { entity_type: entityType }
            });
            setPresetsForType(entityType, response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch presets');
        } finally {
            setIsLoading(false);
        }
    }, [entityType, setPresetsForType]);

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
            addPresetToMap(entityType, response.data);
            return response.data;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to save preset';
            setError(msg);
            throw new Error(msg);
        } finally {
            setIsLoading(false);
        }
    }, [entityType, addPresetToMap]);

    const deletePreset = useCallback(async (presetId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await apiClient.delete(`/presets/${presetId}`);
            removePresetFromMap(entityType, presetId);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete preset');
        } finally {
            setIsLoading(false);
        }
    }, [entityType, removePresetFromMap]);

    const renamePreset = useCallback(async (presetId: string, newName: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.patch(`/presets/${presetId}`, { name: newName });
            updatePresetInMap(entityType, response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to rename preset');
        } finally {
            setIsLoading(false);
        }
    }, [entityType, updatePresetInMap]);

    return {
        presets,
        isLoading,
        error,
        fetchPresets,
        savePreset,
        deletePreset,
        renamePreset
    };
};
