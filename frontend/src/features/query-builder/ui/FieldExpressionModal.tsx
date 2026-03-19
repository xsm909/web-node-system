import React, { useState, useEffect } from 'react';
import { ManagementModal } from '../../../shared/ui/management-modal/ManagementModal';
import { AppInput } from '../../../shared/ui/app-input';
import type { SelectedField } from '../model/types';

interface FieldExpressionModalProps {
    isOpen: boolean;
    onClose: () => void;
    field: SelectedField | null;
    onSave: (id: string, updates: Partial<SelectedField>) => void;
}

export const FieldExpressionModal: React.FC<FieldExpressionModalProps> = ({
    isOpen,
    onClose,
    field,
    onSave,
}) => {
    const [expression, setExpression] = useState('');
    const [alias, setAlias] = useState('');

    useEffect(() => {
        if (field) {
            setExpression(field.expression || (field.columnName === '*' ? '*' : `${field.tableAlias}.${field.columnName}`));
            setAlias(field.alias || '');
        }
    }, [field, isOpen]);

    const handleSave = () => {
        if (field) {
            onSave(field.id, { expression, alias });
            onClose();
        }
    };

    return (
        <ManagementModal
            isOpen={isOpen}
            onClose={onClose}
            icon="functions"
            title="Field Expression"
            description="Configure SQL expression and alias for this field"
            onSave={handleSave}
            saveButtonText="Apply Changes"
        >
            <div className="space-y-6">
                <div className="space-y-2">
                    <AppInput
                        label="Expression (SQL)"
                        value={expression}
                        onChange={setExpression}
                        placeholder="e.g. UPPER(users.name)"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] italic pl-1">
                        Use table aliases to reference columns.
                    </p>
                </div>

                <div className="space-y-2">
                    <AppInput
                        label="Field Alias"
                        value={alias}
                        onChange={setAlias}
                        placeholder="e.g. user_name_upper"
                    />
                </div>
            </div>
        </ManagementModal>
    );
};
