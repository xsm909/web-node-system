import React, { useEffect } from 'react';
import { useWorkflowPresets } from '../model/useWorkflowPresets';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { SelectionList, type SelectionItem, type SelectionAction, type SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import type { Preset } from '../../../entities/preset';

interface WorkflowPresetPickerProps {
    onSelect: (preset: Preset) => void;
    onClose?: () => void;
    mode?: 'header' | 'floating';
    position?: { x: number, y: number };
    isOpen?: boolean;
}

export const WorkflowPresetPicker: React.FC<WorkflowPresetPickerProps> = ({
    onSelect,
    onClose,
    mode = 'header',
    position,
    isOpen = false
}) => {
    const { presets, fetchPresets, deletePreset, renamePreset } = useWorkflowPresets();
    const [presetToDelete, setPresetToDelete] = React.useState<SelectionItem | null>(null);

    useEffect(() => {
        if (isOpen || mode === 'header') {
            fetchPresets();
        }
    }, [isOpen, mode, fetchPresets]);

    const selectionItems: SelectionItem[] = presets.map(p => ({
        id: p.id,
        name: p.name,
        icon: 'workflow',
        description: p.category
    }));

    const handleSelect = (item: SelectionItem) => {
        const preset = presets.find(p => p.id === item.id);
        if (preset) {
            onSelect(preset);
        }
    };

    const handleAction = (action: SelectionAction, target: any) => {
        if (action === 'delete') {
            setPresetToDelete(target);
        } else if (action === 'rename') {
            const newName = prompt('Enter new name:', target.name);
            if (newName && newName.trim()) {
                renamePreset(target.id, newName.trim());
            }
        }
    };

    const confirmDelete = () => {
        if (presetToDelete) {
            deletePreset(presetToDelete.id);
            setPresetToDelete(null);
        }
    };

    const modal = (
        <AppCompactModalForm
            isOpen={!!presetToDelete}
            onClose={() => setPresetToDelete(null)}
            title="Delete Preset"
            icon="delete"
            submitLabel="Delete"
            cancelLabel="Cancel"
            onSubmit={confirmDelete}
        >
            <div className="py-2">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Are you sure you want to delete the preset <strong>&quot;{presetToDelete?.name}&quot;</strong>? This action cannot be undone.
                </p>
            </div>
        </AppCompactModalForm>
    );

    if (mode === 'floating' && isOpen && position) {
        return (
            <>
                <SelectionList
                    data={{} as Record<string, SelectionGroup>}
                    items={selectionItems}
                    onSelect={handleSelect}
                    onClose={onClose}
                    position={position}
                    config={{
                        allowDelete: true,
                        allowRename: true
                    }}
                    onAction={handleAction}
                    searchPlaceholder="Search presets..."
                />
                {modal}
            </>
        );
    }

    if (mode === 'header') {
        return (
            <>
                <ComboBox
                    icon="bookmark"
                    title="Load Preset"
                    size="small"
                    variant="round"
                    hideChevron
                    align="right"
                    items={selectionItems}
                    onSelect={handleSelect}
                    config={{
                        allowDelete: true,
                        allowRename: true
                    }}
                    onAction={handleAction}
                    searchPlaceholder="Search presets..."
                />
                {modal}
            </>
        );
    }

    return modal;
};
