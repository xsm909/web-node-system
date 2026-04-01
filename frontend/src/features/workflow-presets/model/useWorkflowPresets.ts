import { useCallback } from 'react';
import { usePresets } from '../../../entities/preset';

export const useWorkflowPresets = () => {
    const { presets, savePreset, deletePreset, fetchPresets, renamePreset } = usePresets('workflow');

    const saveWorkflowPreset = useCallback(async (name: string, data: any) => {
        return await savePreset(name, data);
    }, [savePreset]);

    return {
        presets,
        fetchPresets,
        saveWorkflowPreset,
        deletePreset,
        renamePreset
    };
};
