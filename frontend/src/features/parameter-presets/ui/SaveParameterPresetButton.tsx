import React, { useState } from 'react';
import { usePresets } from '../../../entities/preset';
import { AppFormButton } from '../../../shared/ui/app-form-button/AppFormButton';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import type { ObjectParameter } from '../../../entities/report/model/types';

interface SaveParameterPresetButtonProps {
    parameter: ObjectParameter;
}

export const SaveParameterPresetButton: React.FC<SaveParameterPresetButtonProps> = ({ parameter }) => {
    const { savePreset } = usePresets('parameter');
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [presetName, setPresetName] = useState('');

    const handleSaveClick = () => {
        setPresetName(parameter.parameter_name || '');
        setIsSaveModalOpen(true);
    };

    const handleConfirmSave = async () => {
        if (!presetName.trim()) return;
        try {
            const data = {
                parameter_name: parameter.parameter_name,
                parameter_type: parameter.parameter_type,
                source: parameter.source,
                value_field: parameter.value_field,
                label_field: parameter.label_field,
            };
            await savePreset(presetName, data);
            setIsSaveModalOpen(false);
        } catch (err) {
            console.error('Failed to save parameter preset:', err);
        }
    };

    return (
        <>
            <AppFormButton
                icon="bookmark_add"
                onClick={handleSaveClick}
                title="Save as Preset"
                withFrame={false}
                className="!p-1"
            />

            <AppCompactModalForm
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSubmit={handleConfirmSave}
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
        </>
    );
};
