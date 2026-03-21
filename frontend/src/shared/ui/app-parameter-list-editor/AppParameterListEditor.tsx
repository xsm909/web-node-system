import React from 'react';
import { Icon } from '../icon';
import type { ObjectParameter } from '../../../entities/report/model/types';
import { AppParameterSelectByTamplate } from '../app-parameter-select-by-tamplate';

interface AppParameterListEditorProps {
    parameters: ObjectParameter[];
    onChange: (parameters: ObjectParameter[]) => void;
    options?: Record<string, { value: string, label: string }[]>;
}

export const AppParameterListEditor: React.FC<AppParameterListEditorProps> = ({
    parameters,
    onChange,
    options = {}
}) => {
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Parameters</h3>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs font-bold hover:bg-[var(--bg-hover)] transition-all"
                >
                    <Icon name="add" size={14} />
                    Add Parameter
                </button>
            </div>

            <div className="space-y-4">
                {parameters.map((param, index) => (
                    <div key={param.id} className="p-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] space-y-4 relative group">
                        <button
                            onClick={() => handleRemove(index)}
                            className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Icon name="delete" size={16} />
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Parameter Name</label>
                                <input
                                    type="text"
                                    value={param.parameter_name}
                                    onChange={(e) => updateParam(index, { parameter_name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand outline-none"
                                    placeholder="e.g. user_id"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                                <select
                                    value={param.parameter_type}
                                    onChange={(e) => updateParam(index, { parameter_type: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand outline-none"
                                >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="date_range">Date Range</option>
                                    <option value="select">Select (Dropdown)</option>
                                </select>
                            </div>
                        </div>

                        {param.parameter_type === 'select' && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Source (@table or SQL)</label>
                                    <input
                                        type="text"
                                        value={param.source}
                                        onChange={(e) => updateParam(index, { source: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand outline-none"
                                        placeholder="@users->id,name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Value Field</label>
                                    <input
                                        type="text"
                                        value={param.value_field}
                                        onChange={(e) => updateParam(index, { value_field: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand outline-none"
                                        placeholder="id"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Label Field</label>
                                    <input
                                        type="text"
                                        value={param.label_field}
                                        onChange={(e) => updateParam(index, { label_field: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand outline-none"
                                        placeholder="name"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Default Value</label>
                            <AppParameterSelectByTamplate
                                parameter={param}
                                value={param.default_value}
                                onChange={(val) => updateParam(index, { default_value: val })}
                                options={options[param.parameter_name] || []}
                            />
                        </div>
                    </div>
                ))}

                {parameters.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-[var(--border-base)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-muted)]">
                        <Icon name="tune" size={32} className="mb-3 opacity-20" />
                        <p className="text-sm">No parameters defined for this workflow.</p>
                        <button
                            onClick={handleAdd}
                            className="mt-4 text-xs font-bold text-brand hover:underline"
                        >
                            Add your first parameter
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
