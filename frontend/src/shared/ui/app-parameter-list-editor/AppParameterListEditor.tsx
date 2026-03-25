import React, { useState, useEffect } from 'react';
import { Icon } from '../icon';
import type { ObjectParameter } from '../../../entities/report/model/types';
import { AppParameterSelectByTamplate } from '../app-parameter-select-by-tamplate';
import { AppFormFieldRect } from '../app-input';
import { UI_CONSTANTS } from '../constants';
import { usePresets, type Preset } from '../../../features/query-builder/lib/usePresets';
import { ComboBox } from '../combo-box/ComboBox';
import { AppFormButton } from '../app-form-button/AppFormButton';
import { AppCompactModalForm } from '../app-compact-modal-form/AppCompactModalForm';

interface AppParameterListEditorProps {
    parameters: ObjectParameter[];
    onChange: (parameters: ObjectParameter[]) => void;
    options?: Record<string, { value: string, label: string }[]>;
}

export const AppParameterListEditor: React.FC<AppParameterListEditorProps> = ({
    parameters,
    onChange,
    options = {}
}) => {
    const { presets, fetchPresets, savePreset } = usePresets('parameter');
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [paramToSave, setParamToSave] = useState<ObjectParameter | null>(null);

    useEffect(() => {
        fetchPresets();
    }, [fetchPresets]);

    const handleAdd = () => {
        const newParam: ObjectParameter = {
            id: `temp_${Date.now()}`,
            parameter_name: '',
            parameter_type: 'text',
            default_value: '',
            source: '',
            value_field: '',
            label_field: ''
        };
        onChange([...parameters, newParam]);
    };

    const handleRemove = (index: number) => {
        const newParams = [...parameters];
        newParams.splice(index, 1);
        onChange(newParams);
    };

    const updateParam = (index: number, updates: Partial<ObjectParameter>) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], ...updates };
        onChange(newParams);
    };

    const handleSavePresetClick = (param: ObjectParameter) => {
        setParamToSave(param);
        setPresetName(param.parameter_name || '');
        setIsSaveModalOpen(true);
    };

    const onConfirmSavePreset = async () => {
        if (!presetName.trim() || !paramToSave) return;
        try {
            // Save only relevant configuration fields for select type
            const data = {
                parameter_name: paramToSave.parameter_name,
                parameter_type: paramToSave.parameter_type,
                source: paramToSave.source,
                value_field: paramToSave.value_field,
                label_field: paramToSave.label_field,
                default_value: paramToSave.default_value
            };
            await savePreset(presetName, data);
            setIsSaveModalOpen(false);
            setParamToSave(null);
            setPresetName('');
        } catch (err) {
            console.error('Failed to save parameter preset:', err);
        }
    };

    const handleLoadPreset = (preset: Preset) => {
        const data = preset.preset_data;
        const newParam: ObjectParameter = {
            id: `preset_${Date.now()}`,
            parameter_name: data.parameter_name || '',
            parameter_type: data.parameter_type || 'select',
            source: data.source || '',
            value_field: data.value_field || '',
            label_field: data.label_field || '',
            default_value: data.default_value || ''
        };
        onChange([...parameters, newParam]);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Parameters</h3>
                <div className="flex items-center gap-2">
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
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs font-normal hover:bg-[var(--bg-hover)] transition-all h-[32px]"
                    >
                        <Icon name="add" size={14} />
                        Add Parameter
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {parameters.map((param, index) => (
                    <div key={param.id} className="p-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] space-y-4 relative group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">
                                <span>Parameter</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {param.parameter_type === 'select' && (
                                    <AppFormButton
                                        icon="bookmark_add"
                                        onClick={() => handleSavePresetClick(param)}
                                        title="Save as Preset"
                                        withFrame={false}
                                        className="!p-1"
                                    />
                                )}
                                <AppFormButton
                                    icon="delete"
                                    onClick={() => handleRemove(index)}
                                    title="Delete Parameter"
                                    withFrame={false}
                                    className="!p-1 hover:text-red-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Parameter Name</label>
                                <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <input
                                        type="text"
                                        value={param.parameter_name}
                                        onChange={(e) => updateParam(index, { parameter_name: e.target.value })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                        placeholder="e.g. user_id"
                                    />
                                </AppFormFieldRect>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                                <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <select
                                        value={param.parameter_type}
                                        onChange={(e) => updateParam(index, { parameter_type: e.target.value as any })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="date_range">Date Range</option>
                                        <option value="select">Select (Dropdown)</option>
                                    </select>
                                </AppFormFieldRect>
                            </div>
                        </div>

                        {param.parameter_type === 'select' && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5 flex flex-col">
                                    <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Source (@table or SQL)</label>
                                    <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                        <input
                                            type="text"
                                            value={param.source}
                                            onChange={(e) => updateParam(index, { source: e.target.value })}
                                            className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                            placeholder="@users->id,name"
                                        />
                                    </AppFormFieldRect>
                                </div>
                                <div className="space-y-1.5 flex flex-col">
                                    <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Value Field</label>
                                    <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                        <input
                                            type="text"
                                            value={param.value_field}
                                            onChange={(e) => updateParam(index, { value_field: e.target.value })}
                                            className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                            placeholder="id"
                                        />
                                    </AppFormFieldRect>
                                </div>
                                <div className="space-y-1.5 flex flex-col">
                                    <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Label Field</label>
                                    <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                        <input
                                            type="text"
                                            value={param.label_field}
                                            onChange={(e) => updateParam(index, { label_field: e.target.value })}
                                            className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                            placeholder="name"
                                        />
                                    </AppFormFieldRect>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Default Value</label>
                            <AppParameterSelectByTamplate
                                parameter={param}
                                value={param.default_value}
                                onChange={(val) => updateParam(index, { default_value: val })}
                                options={options[param.parameter_name] || []}
                            />
                        </div>
                    </div>
                ))}

                {parameters.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-[var(--border-base)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-muted)]">
                        <Icon name="tune" size={32} className="mb-3 opacity-20" />
                        <p className="text-sm font-normal">No parameters defined for this workflow.</p>
                        <button
                            onClick={handleAdd}
                            className="mt-4 text-xs font-normal text-brand hover:underline"
                        >
                            Add your first parameter
                        </button>
                    </div>
                )}
            </div>

            <AppCompactModalForm
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSubmit={onConfirmSavePreset}
                title="Save Parameter Preset"
                icon="bookmark_add"
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Preset Name</label>
                        <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                            <input
                                autoFocus
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                placeholder="Enter preset name..."
                            />
                        </AppFormFieldRect>
                    </div>
                </div>
            </AppCompactModalForm>
        </div>
    );
};
