import React, { useState } from 'react';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';

interface WorkflowPresetCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    isSaving?: boolean;
}

export const WorkflowPresetCreateModal: React.FC<WorkflowPresetCreateModalProps> = ({
    isOpen,
    onClose,
    onSave,
    isSaving = false
}) => {
    const [name, setName] = useState('');

    const handleSubmit = () => {
        if (name.trim()) {
            onSave(name.trim());
            setName('');
        }
    };

    return (
        <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={handleSubmit}
            title="Create Workflow Preset"
            icon="bookmark_add"
            submitLabel={isSaving ? 'Saving...' : 'Create'}
            isSubmitDisabled={!name.trim() || isSaving}
        >
            <div className="space-y-4 py-2">
                <p className="text-xs text-[var(--text-muted)]">
                    Enter a name for your preset. This will save the selected nodes, groups, and their connections.
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
                        placeholder="Preset name (e.g., Auth Flow, Data Processor)"
                    />
                </AppFormFieldRect>
            </div>
        </AppCompactModalForm>
    );
};
