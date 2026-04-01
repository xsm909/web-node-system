import React, { useState, useEffect, useMemo } from 'react';
import { usePresets, type Preset } from '../../../entities/preset';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { SelectionList, type SelectionItem, type SelectionAction, type SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';

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
    const { presets, fetchPresets, deletePreset, updatePreset } = usePresets(entityType);
    
    // Internal management state
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
    const [deletingPreset, setDeletingPreset] = useState<Preset | null>(null);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        if (isOpen || mode === 'header') {
            fetchPresets();
        }
    }, [isOpen, mode, fetchPresets]);

    // Recursive helper to build nested groups
    const getGroupedData = (presets: Preset[]) => {
        const rootItems: SelectionItem[] = [];
        const groups: Record<string, SelectionGroup> = {};

        const allCategories = getUniqueCategoryPaths(presets);

        presets.forEach(p => {
            const item: SelectionItem = {
                id: p.id,
                name: p.name,
                icon: 'bookmark',
                description: p.category
            };

            if (!p.category) {
                rootItems.push(item);
            } else {
                const parts = p.category.split('|').map(s => s.trim()).filter(Boolean);
                let currentGroups = groups;
                let currentPath = '';

                parts.forEach((part, index) => {
                    const partLower = part.toLowerCase();
                    currentPath = currentPath ? `${currentPath}|${partLower}` : partLower;
                    
                    // Resolve the canonical display name from allCategories for this specific level
                    // allCategories contains "AI" if "AI|Chat" exists. 
                    // We find the segment in allCategories that matches currentPath.
                    const canonicalPath = allCategories.find(c => c.toLowerCase() === currentPath) || part;
                    const canonicalName = canonicalPath.split('|').pop() || part;

                    if (!currentGroups[partLower]) {
                        currentGroups[partLower] = {
                            id: `group-${currentPath}`,
                            name: canonicalName,
                            items: [],
                            children: {},
                            icon: 'folder_code'
                        };
                    }

                    if (index === parts.length - 1) {
                        currentGroups[partLower].items.push(item);
                    } else {
                        currentGroups = currentGroups[partLower].children;
                    }
                });
            }
        });

        return { rootItems, groups, allCategories };
    };


    const { rootItems, groups, allCategories } = useMemo(() => getGroupedData(presets), [presets]);

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
            setNewCategory(preset.category || '');
        }
    };

    const handleUpdateSubmit = async () => {
        if (editingPreset && newName.trim()) {
            await updatePreset(editingPreset.id, { 
                name: newName.trim(), 
                category: newCategory.trim() || undefined 
            });
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
                onSubmit={handleUpdateSubmit}
                title="Edit Preset"
                icon="drive_file_rename_outline"
                submitLabel="Save"
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        Update preset name and category:
                    </p>
                    <div className="space-y-3">
                        <AppFormFieldRect>
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newName.trim()) {
                                        e.preventDefault();
                                        handleUpdateSubmit();
                                    }
                                }}
                                className="w-full bg-transparent outline-none h-full text-xs"
                                placeholder="Preset name"
                            />
                        </AppFormFieldRect>
                        <AppCategoryInput
                            value={newCategory}
                            onChange={setNewCategory}
                            allPaths={allCategories}
                            placeholder="Category (Optional)"
                        />
                    </div>
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
                    data={groups}
                    items={rootItems}
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
                    data={groups}
                    items={rootItems}
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
