import React, { useEffect, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
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
    const inputRef = useRef<HTMLInputElement>(null);

    const form = useForm({
        defaultValues: {
            expression: '',
            alias: '',
        },
        onSubmit: async ({ value }) => {
            if (field) {
                onSave(field.id, value);
                onClose();
            }
        },
    });

    useEffect(() => {
        if (field && isOpen) {
            form.setFieldValue('expression', field.expression || (field.columnName === '*' ? '*' : `${field.tableAlias}.${field.columnName}`));
            form.setFieldValue('alias', field.alias || '');
            
            // Small timeout to ensure the modal is rendered before focusing
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [field, isOpen, form]);

    return (
        <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            title="Field Expression"
            icon="functions"
            onSubmit={() => form.handleSubmit()}
        >
            <div className="flex items-center gap-4">
                <form.Field
                    name="expression"
                    children={(fieldApi) => (
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                Expression
                            </label>
                            <input
                                ref={inputRef}
                                value={fieldApi.state.value}
                                onChange={(e) => fieldApi.handleChange(e.target.value)}
                                placeholder="SQL Expression"
                                className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand transition-all font-mono"
                            />
                        </div>
                    )}
                />
                <form.Field
                    name="alias"
                    children={(fieldApi) => (
                        <div className="w-40 space-y-1">
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                                Alias
                            </label>
                            <input
                                value={fieldApi.state.value}
                                onChange={(e) => fieldApi.handleChange(e.target.value)}
                                placeholder="Alias"
                                className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand transition-all font-mono"
                            />
                        </div>
                    )}
                />
            </div>
        </AppCompactModalForm>
    );
};
