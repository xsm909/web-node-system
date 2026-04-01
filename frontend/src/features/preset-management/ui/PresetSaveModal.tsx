import React, { useState, useEffect, useMemo } from 'react';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormFieldRect } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { usePresets } from '../../../entities/preset';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';

interface PresetSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, category?: string) => void;
    entityType: string;
    isSaving?: boolean;
    title?: string;
    description?: string;
    initialName?: string;
}

export const PresetSaveModal: React.FC<PresetSaveModalProps> = ({
    isOpen,
    onClose,
    onSave,
    entityType,
    isSaving = false,
    title = 'Save Preset',
    description = 'Enter a name for your preset to reuse this configuration later.',
    initialName = ''
}) => {
    const { presets, fetchPresets } = usePresets(entityType);
    const [name, setName] = useState(initialName);
    const [category, setCategory] = useState('');

    const allCategories = useMemo(() => getUniqueCategoryPaths(presets), [presets]);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setCategory('');
            fetchPresets();
        }
    }, [isOpen, initialName, fetchPresets]);

    const handleSubmit = () => {
        if (name.trim()) {
            onSave(name.trim(), category.trim() || undefined);
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
                
                <div className="space-y-3">
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
                            className="w-full bg-transparent outline-none h-full text-xs placeholder:text-[var(--text-muted)]/50"
                            placeholder="Preset name (e.g. Default Config, My Template)"
                        />
                    </AppFormFieldRect>

                    <AppCategoryInput
                        value={category}
                        onChange={setCategory}
                        allPaths={allCategories}
                        placeholder="Path|To|Category (Optional)"
                    />
                </div>
            </div>
        </AppCompactModalForm>
    );
};
