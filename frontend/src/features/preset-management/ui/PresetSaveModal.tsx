import React, { useState, useEffect } from 'react';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';

interface PresetSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    isSaving?: boolean;
    title?: string;
    description?: string;
    initialName?: string;
}

export const PresetSaveModal: React.FC<PresetSaveModalProps> = ({
    isOpen,
    onClose,
    onSave,
    isSaving = false,
    title = 'Save Preset',
    description = 'Enter a name for your preset to reuse this configuration later.',
    initialName = ''
}) => {
    const [name, setName] = useState(initialName);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
        }
    }, [isOpen, initialName]);

    const handleSubmit = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    return (
        <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={handleSubmit}
            title={title}
            icon="bookmark_add"
            submitLabel={isSaving ? 'Saving...' : 'Save'}
            isSubmitDisabled={!name.trim() || isSaving}
        >
            <div className="space-y-4 py-2">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {description}
                </p>
                <AppFormFieldRect>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && name.trim()) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        className="w-full bg-transparent outline-none h-full text-xs"
                        placeholder="Preset name (e.g. Default Config, My Template)"
                    />
                </AppFormFieldRect>
            </div>
        </AppCompactModalForm>
    );
};
