import React, { useState, useEffect } from 'react';
import { usePresets, type Preset } from '../../../entities/preset';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { SelectionList, type SelectionItem, type SelectionAction, type SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';

interface PresetSelectorProps {
    entityType: string;
    onSelect: (preset: Preset) => void;
    /** 'header' uses ComboBox (round button), 'floating' uses SelectionList direkt (portal) */
    mode?: 'header' | 'floating';
    variant?: 'primary' | 'ghost' | 'sidebar' | 'brand' | 'round';
    align?: 'left' | 'right';
    position?: { x: number, y: number };
    isOpen?: boolean;
    onClose?: () => void;
    title?: string;
    placeholder?: string;
    searchPlaceholder?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
    entityType,
    onSelect,
    mode = 'header',
    variant = 'round',
    align = 'right',
    position,
    isOpen = false,
    onClose,
    title = 'Load Preset',
    placeholder = 'Select...',
    searchPlaceholder = 'Search presets...'
}) => {
    const { presets, fetchPresets, deletePreset, renamePreset } = usePresets(entityType);
    
    // Internal management state
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
    const [deletingPreset, setDeletingPreset] = useState<Preset | null>(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (isOpen || mode === 'header') {
            fetchPresets();
        }
    }, [isOpen, mode, fetchPresets]);

    const selectionItems: SelectionItem[] = presets.map(p => ({
        id: p.id,
        name: p.name,
        icon: 'bookmark',
        description: p.category
    }));

    const handleSelect = (item: SelectionItem) => {
        const preset = presets.find(p => p.id === item.id);
        if (preset) {
            onSelect(preset);
            onClose?.();
        }
    };

    const handleAction = (action: SelectionAction, target: any) => {
        const preset = presets.find(p => p.id === target.id);
        if (!preset) return;

        if (action === 'delete') {
            setDeletingPreset(preset);
        } else if (action === 'rename') {
            setEditingPreset(preset);
            setNewName(preset.name);
        }
        // SelectionList/ComboBox will automatically close on action handler
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

    // Shared Modals
    const managementModals = (
        <>
            <AppCompactModalForm
                isOpen={!!editingPreset}
                onClose={() => setEditingPreset(null)}
                onSubmit={handleRenameSubmit}
                title="Rename Preset"
                icon="drive_file_rename_outline"
                submitLabel="Save"
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Enter a new name for the preset:
                    </p>
                    <AppFormFieldRect>
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newName.trim()) {
                                    e.preventDefault();
                                    handleRenameSubmit();
                                }
                            }}
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
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Are you sure you want to delete preset <strong className="text-[var(--text-main)]">&quot;{deletingPreset?.name}&quot;</strong>? This action cannot be undone.
                    </p>
                </div>
            </AppCompactModalForm>
        </>
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
                    align={align}
                    config={{
                        allowDelete: true,
                        allowRename: true
                    }}
                    onAction={handleAction}
                    searchPlaceholder={searchPlaceholder}
                />
                {managementModals}
            </>
        );
    }

    if (mode === 'header') {
        return (
            <>
                <ComboBox
                    icon="bookmark"
                    title={title}
                    size="small"
                    variant={variant}
                    placeholder={placeholder}
                    hideChevron
                    align={align}
                    items={selectionItems}
                    onSelect={handleSelect}
                    config={{
                        allowDelete: true,
                        allowRename: true
                    }}
                    onAction={handleAction}
                    searchPlaceholder={searchPlaceholder}
                />
                {managementModals}
            </>
        );
    }

    return managementModals;
};
