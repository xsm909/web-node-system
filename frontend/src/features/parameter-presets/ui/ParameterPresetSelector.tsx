import React, { useEffect, useState } from 'react';
import { usePresets, type Preset } from '../../../entities/preset';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { ObjectParameter } from '../../../entities/report/model/types';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';

interface ParameterPresetSelectorProps {
    onLoad: (parameter: ObjectParameter) => void;
}

export const ParameterPresetSelector: React.FC<ParameterPresetSelectorProps> = ({ onLoad }) => {
    const { presets, fetchPresets, renamePreset, deletePreset } = usePresets('parameter');
    
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
    const [newName, setNewName] = useState('');
    const [deletingPreset, setDeletingPreset] = useState<Preset | null>(null);

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

    const handleAction = (action: string, item: any) => {
        const preset = presets.find(p => p.id === item.id);
        if (!preset) return;

        if (action === 'rename') {
            setEditingPreset(preset);
            setNewName(preset.name);
        } else if (action === 'delete') {
            setDeletingPreset(preset);
        }
    };

    const handleRenameSubmit = async () => {
        if (editingPreset && newName.trim()) {
            await renamePreset(editingPreset.id, newName.trim());
            setEditingPreset(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (deletingPreset) {
            await deletePreset(deletingPreset.id);
            setDeletingPreset(null);
        }
    };

    return (
        <>
            <ComboBox
                icon="bookmark"
                placeholder=""
                title="Add parameter from preset"
                size="small"
                hideChevron
                align="right"
                config={{
                    allowRename: true,
                    allowDelete: true
                }}
                items={presets.map(p => ({
                    id: p.id,
                    name: p.name
                }))}
                onSelect={(item) => {
                    const preset = presets.find(p => p.id === item.id);
                    if (preset) handleLoadPreset(preset);
                }}
                onAction={handleAction as any}
            />

            <AppCompactModalForm
                isOpen={!!editingPreset}
                onClose={() => setEditingPreset(null)}
                onSubmit={handleRenameSubmit}
                title="Rename Preset"
                icon="drive_file_rename_outline"
                submitLabel="Save"
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-[var(--text-muted)]">Enter a new name for the preset:</p>
                    <AppFormFieldRect>
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-transparent outline-none h-full text-xs"
                            placeholder="Preset name"
                        />
                    </AppFormFieldRect>
                </div>
            </AppCompactModalForm>

            <AppCompactModalForm
                isOpen={!!deletingPreset}
                onClose={() => setDeletingPreset(null)}
                onSubmit={handleDeleteConfirm}
                title="Delete Preset"
                icon="delete"
                submitLabel="Delete"
                cancelLabel="Cancel"
            >
                <div className="py-2">
                    <p className="text-xs text-[var(--text-muted)]">
                        Are you sure you want to delete preset <strong className="text-[var(--text-main)]">"{deletingPreset?.name}"</strong>?
                    </p>
                    <p className="text-[10px] text-red-500 mt-2">This action cannot be undone.</p>
                </div>
            </AppCompactModalForm>
        </>
    );
};
