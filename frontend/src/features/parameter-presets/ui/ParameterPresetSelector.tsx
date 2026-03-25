import React, { useEffect } from 'react';
import { usePresets, type Preset } from '../../../entities/preset';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { ObjectParameter } from '../../../entities/report/model/types';

interface ParameterPresetSelectorProps {
    onLoad: (parameter: ObjectParameter) => void;
}

export const ParameterPresetSelector: React.FC<ParameterPresetSelectorProps> = ({ onLoad }) => {
    const { presets, fetchPresets } = usePresets('parameter');

    useEffect(() => {
        fetchPresets();
    }, [fetchPresets]);

    const handleLoadPreset = (preset: Preset) => {
        const data = preset.preset_data;
        const newParam: ObjectParameter = {
            id: `preset_${Date.now()}`,
            parameter_name: data.parameter_name || '',
            parameter_type: data.parameter_type || 'select',
            source: data.source || '',
            value_field: data.value_field || '',
            label_field: data.label_field || '',
            default_value: ''
        };
        onLoad(newParam);
    };

    return (
        <ComboBox
            icon="bookmark"
            placeholder=""
            title="Load Preset"
            variant="ghost"
            size="small"
            hideChevron
            align="right"
            items={presets.map(p => ({
                id: p.id,
                name: p.name
            }))}
            onSelect={(item) => {
                const preset = presets.find(p => p.id === item.id);
                if (preset) handleLoadPreset(preset);
            }}
        />
    );
};
