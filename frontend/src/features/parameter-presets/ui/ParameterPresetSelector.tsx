import React from 'react';
import { PresetSelector } from '../../preset-management';
import type { ObjectParameter } from '../../../entities/report/model/types';

interface ParameterPresetSelectorProps {
    onLoad: (parameter: ObjectParameter) => void;
}

export const ParameterPresetSelector: React.FC<ParameterPresetSelectorProps> = ({ onLoad }) => {
    const handleLoadPreset = (preset: any) => {
        const data = preset.preset_data;
        const newParam: ObjectParameter = {
            id: `preset_${Date.now()}`,
            parameter_name: data.parameter_name || '',
            parameter_type: data.parameter_type || 'select',
            source: data.source || '',
            value_field: data.value_field || '',
            label_field: data.label_field || '',
            default_value: data.default_value ?? ''
        };
        onLoad(newParam);
    };

    return (
        <PresetSelector
            entityType="parameter"
            onSelect={handleLoadPreset}
            title="Add parameter from preset"
        />
    );
};
