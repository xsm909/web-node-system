import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Preset } from './usePresets';

interface PresetsContextType {
    presetsMap: Record<string, Preset[]>;
    setPresetsForType: (type: string, presets: Preset[]) => void;
    updatePresetInMap: (type: string, preset: Preset) => void;
    removePresetFromMap: (type: string, presetId: string) => void;
    addPresetToMap: (type: string, preset: Preset) => void;
}

const PresetsContext = createContext<PresetsContextType | undefined>(undefined);

export const PresetsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [presetsMap, setPresetsMap] = useState<Record<string, Preset[]>>({});

    const setPresetsForType = useCallback((type: string, presets: Preset[]) => {
        setPresetsMap(prev => ({ ...prev, [type]: presets }));
    }, []);

    const updatePresetInMap = useCallback((type: string, preset: Preset) => {
        setPresetsMap(prev => ({
            ...prev,
            [type]: (prev[type] || []).map(p => p.id === preset.id ? preset : p)
        }));
    }, []);

    const removePresetFromMap = useCallback((type: string, presetId: string) => {
        setPresetsMap(prev => ({
            ...prev,
            [type]: (prev[type] || []).filter(p => p.id !== presetId)
        }));
    }, []);

    const addPresetToMap = useCallback((type: string, preset: Preset) => {
        setPresetsMap(prev => ({
            ...prev,
            [type]: [preset, ...(prev[type] || [])]
        }));
    }, []);

    return (
        <PresetsContext.Provider value={{
            presetsMap,
            setPresetsForType,
            updatePresetInMap,
            removePresetFromMap,
            addPresetToMap
        }}>
            {children}
        </PresetsContext.Provider>
    );
};

export const usePresetsContext = () => {
    const context = useContext(PresetsContext);
    if (!context) {
        throw new Error('usePresetsContext must be used within a PresetsProvider');
    }
    return context;
};
