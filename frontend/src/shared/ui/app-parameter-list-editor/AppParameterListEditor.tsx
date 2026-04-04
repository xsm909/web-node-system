import React, { useState } from 'react';
import { Icon } from '../icon';
import type { ObjectParameter } from '../../../entities/report/model/types';
import { AppParameterSelectByTamplate } from '../app-parameter-select-by-tamplate';
import { AppFormFieldRect } from '../app-input';
import { UI_CONSTANTS } from '../constants';
import { AppFormButton } from '../app-form-button/AppFormButton';
import { QueryBuilderModal } from '../../../features/query-builder/ui/QueryBuilderModal';
import { SYSTEM_PARAMETERS } from '../../../entities/report/model/constants';

interface AppParameterListEditorProps {
    parameters: ObjectParameter[];
    onChange: (parameters: ObjectParameter[]) => void;
    options?: Record<string, { value: string, label: string }[]>;
    renderHeaderActions?: () => React.ReactNode;
    renderParameterActions?: (param: ObjectParameter) => React.ReactNode;
    isLocked?: boolean;
}

export const AppParameterListEditor: React.FC<AppParameterListEditorProps> = ({
    parameters,
    onChange,
    options = {},
    renderHeaderActions,
    renderParameterActions,
    isLocked = false
}) => {
    const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleAdd = () => {
        const newParam: ObjectParameter = {
            id: `temp_${Date.now()}`,
            parameter_name: '',
            parameter_type: 'text',
            default_value: '',
            source: '',
            value_field: '',
            label_field: ''
        };
        onChange([...parameters, newParam]);
    };

    const handleRemove = (index: number) => {
        const newParams = [...parameters];
        newParams.splice(index, 1);
        onChange(newParams);
    };

    const updateParam = (index: number, updates: Partial<ObjectParameter>) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], ...updates };
        onChange(newParams);
    };

    const handleOpenQueryBuilder = (index: number) => {
        setEditingIndex(index);
        setIsQueryBuilderOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Parameters</h3>
                <div className="flex items-center gap-2">
                    {renderHeaderActions?.()}
                    {!isLocked && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs font-normal hover:bg-[var(--bg-hover)] transition-all h-[32px]"
                        >
                            <Icon name="add" size={14} />
                            Add Parameter
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {parameters.map((param, index) => (
                    <div key={param.id} className="p-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] space-y-4 relative group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">
                                <span>Parameter</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {renderParameterActions?.(param)}
                                {!isLocked && (
                                    <AppFormButton
                                        icon="delete"
                                        onClick={() => handleRemove(index)}
                                        title="Delete Parameter"
                                        withFrame={false}
                                        className="!p-1 hover:text-red-500"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Parameter Name</label>
                                <AppFormFieldRect disabled={isLocked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <input
                                        type="text"
                                        value={param.parameter_name}
                                        onChange={(e) => updateParam(index, { parameter_name: e.target.value })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal disabled:opacity-50"
                                        placeholder="e.g. user_id"
                                        disabled={isLocked}
                                    />
                                </AppFormFieldRect>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                                <AppFormFieldRect disabled={isLocked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <select
                                        value={param.parameter_type}
                                        onChange={(e) => updateParam(index, { parameter_type: e.target.value as any })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer disabled:opacity-50"
                                        disabled={isLocked}
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="date_range">Date Range</option>
                                        <option value="select">Select (Dropdown)</option>
                                    </select>
                                </AppFormFieldRect>
                            </div>
                        </div>

                        {param.parameter_type === 'select' && (
                            <div className="space-y-1.5 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">SQL Source (Must return 'value' and 'label')</label>
                                    {!isLocked && (
                                        <button
                                            onClick={() => handleOpenQueryBuilder(index)}
                                            className="text-[10px] font-normal text-brand hover:underline flex items-center gap-1"
                                        >
                                            <Icon name="QueryBuilder" size={12} />
                                            Open Query Builder
                                        </button>
                                    )}
                                </div>
                                <AppFormFieldRect disabled={isLocked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <input
                                        type="text"
                                        value={param.source}
                                        onChange={(e) => updateParam(index, { source: e.target.value })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal disabled:opacity-50"
                                        placeholder="SELECT id as value, name as label FROM users..."
                                        disabled={isLocked}
                                    />
                                </AppFormFieldRect>
                            </div>
                        )}

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Default Value</label>
                            <AppParameterSelectByTamplate
                                parameter={param}
                                value={param.default_value}
                                onChange={(val) => updateParam(index, { default_value: val })}
                                options={options[param.parameter_name] || []}
                                disabled={isLocked}
                            />
                        </div>
                    </div>
                ))}

                {parameters.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-[var(--border-base)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-muted)]">
                        <Icon name="tune" size={32} className="mb-3 opacity-20" />
                        <p className="text-sm font-normal">No parameters defined.</p>
                        {!isLocked && (
                            <button
                                onClick={handleAdd}
                                className="mt-4 text-xs font-normal text-brand hover:underline"
                            >
                                Add your first parameter
                              </button>
                        )}
                    </div>
                )}
            </div>

            <QueryBuilderModal
                isOpen={isQueryBuilderOpen}
                onClose={() => setIsQueryBuilderOpen(false)}
                onDone={(sql) => {
                    if (editingIndex !== null) {
                        updateParam(editingIndex, { source: sql });
                    }
                    setIsQueryBuilderOpen(false);
                }}
                initialSql={editingIndex !== null ? parameters[editingIndex].source : ''}
                parameters={SYSTEM_PARAMETERS}
            />
        </div>
    );
};
