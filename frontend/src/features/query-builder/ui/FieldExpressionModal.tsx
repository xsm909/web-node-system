import React, { useEffect, useRef } from 'react';
import { useForm } from '@tanstack/react-form';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import type { SelectedField, DbFunction } from '../model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { useDatabaseMetadata } from '../lib/useDatabaseMetadata';
import type { SelectionGroup } from '../../../shared/ui/selection-list';
import { Icon } from '../../../shared/ui/icon';

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

    const { getFunctions } = useDatabaseMetadata();
    const [functions, setFunctions] = React.useState<DbFunction[]>([]);

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
        const fetchFunctions = async () => {
            const data = await getFunctions();
            setFunctions(data);
        };
        if (isOpen) {
            fetchFunctions();
        }
    }, [isOpen]);

    const handleFunctionSelect = (funcId: string) => {
        const func = functions.find(f => `${f.category}.${f.name}` === funcId);
        if (!func) return;

        const currentExpr = form.getFieldValue('expression') || '';
        let newExpr = '';

        const argsList = func.args ? func.args.split(',').map(a => a.trim()).filter(Boolean) : [];

        if (argsList.length > 1) {
            // Complex function with multiple arguments
            const placeholders = argsList.slice(1).map(arg => `<${arg}>`).join(', ');
            newExpr = `${func.name}(${currentExpr || 'data'}, ${placeholders})`;
        } else {
            // Simple function (0 or 1 argument)
            newExpr = `${func.name.toUpperCase()}(${currentExpr})`;
        }
        
        form.setFieldValue('expression', newExpr);
    };

    const functionGroups: Record<string, SelectionGroup> = functions.reduce((acc, func) => {
        if (!acc[func.category]) {
            acc[func.category] = {
                id: func.category,
                name: func.category,
                items: [],
                children: {}
            };
        }
        acc[func.category].items.push({
            id: `${func.category}.${func.name}`,
            name: func.name,
            description: func.args,
            icon: 'functions',
        });
        return acc;
    }, {} as Record<string, SelectionGroup>);

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
            width="max-w-4xl"
        >
            <div className="space-y-6">
                <div className="flex items-end gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                            Function
                        </label>
                        <ComboBox
                            icon="functions"
                            placeholder="Fx"
                            data={functionGroups}
                            onSelect={(item) => handleFunctionSelect(item.id)}
                            triggerClassName="h-[34px] min-w-[60px] !rounded-lg border border-[var(--border-base)] bg-[var(--bg-alt)]"
                            hideChevron
                        />
                    </div>

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
                                    className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand transition-all font-mono h-[34px]"
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
                                    className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand transition-all font-mono h-[34px]"
                                />
                            </div>
                        )}
                    />
                </div>

                {/* JSON Magic Section */}
                <div className="border-t border-[var(--border-base)] pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Icon name="auto_awesome" size={14} className="text-amber-500" />
                        <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">JSON / JSONB Magic</h4>
                        {field?.columnType && (
                            <span className="text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">
                                DB Type: {field.columnType}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        <JsonActionBtn 
                            label="Unpack Array" 
                            desc="jsonb_array_elements_text"
                            onClick={() => {
                                const expr = form.getFieldValue('expression');
                                form.setFieldValue('expression', `jsonb_array_elements_text(${expr}::jsonb)`);
                            }} 
                        />
                        <JsonActionBtn 
                            label="Double Escaped" 
                            desc="(#>>'{}')::jsonb"
                            onClick={() => {
                                const expr = form.getFieldValue('expression');
                                form.setFieldValue('expression', `(${expr}#>>'{}')::jsonb`);
                            }} 
                        />
                        <JsonActionBtn 
                            label="Cast to JSONB" 
                            desc="::jsonb"
                            onClick={() => {
                                const expr = form.getFieldValue('expression');
                                form.setFieldValue('expression', `${expr}::jsonb`);
                            }} 
                        />
                         <JsonActionBtn 
                            label="Ext. Text" 
                            desc="->>'key'"
                            onClick={() => {
                                const expr = form.getFieldValue('expression');
                                form.setFieldValue('expression', `${expr}->>'key'`);
                            }} 
                        />
                         <JsonActionBtn 
                            label="Ext. Object" 
                            desc="->'key'"
                            onClick={() => {
                                const expr = form.getFieldValue('expression');
                                form.setFieldValue('expression', `${expr}->'key'`);
                            }} 
                        />
                    </div>
                </div>
            </div>
        </AppCompactModalForm>
    );
};

const JsonActionBtn = ({ label, desc, onClick }: { label: string, desc: string, onClick: () => void }) => (
    <button
        type="button"
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
        className="group/btn flex flex-col items-start px-3 py-1.5 rounded-lg border border-[var(--border-base)] bg-[var(--bg-app)] hover:border-brand/40 hover:bg-brand/[0.02] transition-all"
    >
        <span className="text-[10px] font-bold text-[var(--text-main)] group-hover/btn:text-brand transition-colors whitespace-nowrap">{label}</span>
        <span className="text-[8px] font-mono text-[var(--text-muted)] opacity-50 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">{desc}</span>
    </button>
);
