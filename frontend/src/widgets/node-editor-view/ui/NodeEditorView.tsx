/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionItem } from '../../../shared/ui/selection-list/SelectionList';
import { apiClient } from '../../../shared/api/client';
import { AppHeader } from '../../app-header';
import { useForm } from '@tanstack/react-form';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

interface NodeEditorViewProps {
    node: Node | null;
    nodeTypes: NodeType[];
    onChange: (nodeId: string, params: any) => void;
    onBack: () => void;
    isReadOnly?: boolean;
    inline?: boolean;
}

const ParameterRow: React.FC<{
    param: any;
    value: any;
    displayValue?: any;
    onChange: (updates: Record<string, any>) => void;
    isReadOnly: boolean;
}> = ({ param, value, displayValue, onChange, isReadOnly }) => {
    const [options, setOptions] = useState<SelectionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (param.options_source?.component === 'ComboBox') {
            const fetchOptions = async () => {
                setIsLoading(true);
                try {
                    let endpoint = "";
                    if (param.options_source.table === "AI_Tasks") {
                        endpoint = "/ai-tasks/";
                    } else {
                        // Fallback for other tables if needed
                        endpoint = `/${param.options_source.table.toLowerCase().replace(/_/g, '-')}/`;
                    }

                    const response = await apiClient.get(endpoint);
                    const data = response.data;

                    const flatOptions: SelectionItem[] = data
                        .filter((item: any) => {
                            if (param.options_source.filters) {
                                return Object.entries(param.options_source.filters).every(
                                    ([key, val]) => item[key] === val
                                );
                            }
                            return true;
                        })
                        .map((item: any) => ({
                            id: String(item[param.options_source.value_field]),
                            name: String(item[param.options_source.label_field]),
                            icon: 'bolt'
                        }));
                        
                    setOptions(flatOptions);
                } catch (error) {
                    console.error("Failed to fetch options for", param.name, error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchOptions();
        }
    }, [param]);

    const getSelectedLabel = () => {
        if (!value) return "";
        const item = options.find(i => i.id === String(value));
        if (item) return item.name;
        if (displayValue) return String(displayValue);
        if (isLoading) return "Loading...";
        return value;
    };

    return (
        <div className="space-y-2 group">
            <div className="flex items-center justify-between">
                <label
                    htmlFor={`param-${param.name}`}
                    className="text-xs font-medium text-[var(--text-main)] opacity-70 group-focus-within:text-brand transition-colors"
                >
                    {param.label}
                </label>
                {param.type === 'boolean' && (
                    <div
                        className={`relative inline-flex h-5 w-9 shrink-0 ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer'} items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${value ? 'bg-brand' : 'bg-[var(--border-base)]'}`}
                        onClick={() => !isReadOnly && onChange({ [param.name]: !(value ?? false) })}
                    >
                        <input
                            id={`param-${param.name}`}
                            type="checkbox"
                            checked={value ?? false}
                            onChange={(e) => !isReadOnly && onChange({ [param.name]: e.target.checked })}
                            className="sr-only"
                            disabled={isReadOnly}
                        />
                        <div
                            className={`
                                pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow ring-0 transition-transform
                                ${value ? 'translate-x-4.5' : 'translate-x-1'}
                            `}
                        />
                    </div>
                )}
            </div>

            {param.type !== 'boolean' && (
                param.options_source?.component === 'ComboBox' ? (
                    <ComboBox
                        value={String(value || '')}
                        label={getSelectedLabel()}
                        icon="bolt"
                        placeholder={isLoading ? "Loading..." : `Select ${param.label.toLowerCase()}...`}
                        data={{}}
                        items={options}
                        onSelect={(item) => {
                            // Immediately call onChange with BOTH the real ID value and the display label
                            onChange({
                                [param.name]: item.id,
                                [`_DISPLAY_${param.name}`]: item.name
                            });
                        }}
                        className="w-full"
                    />
                ) : (
                    <input
                        id={`param-${param.name}`}
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={value ?? ''}
                        onChange={(e) => {
                            const val = param.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
                            onChange({ [param.name]: val });
                        }}
                        placeholder={`Enter ${param.label.toLowerCase()}...`}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] opacity-80 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        disabled={isReadOnly}
                    />
                )
            )}
        </div>
    );
};

export const NodeEditorView: React.FC<NodeEditorViewProps> = ({
    node,
    nodeTypes,
    onChange,
    onBack,
    isReadOnly = false,
    inline = false,
}) => {
    const [showConfirmBack, setShowConfirmBack] = useState(false);

    const nodeTypeData = nodeTypes.find(t => t.name === node?.data.label);
    const allParameters = nodeTypeData?.parameters || [];

    // Technical param logic 
    const isTechnicalParam = (p: any) => /^[A-Z0-9_]+$/.test(p.name) && !p.options_source;
    const parameters = allParameters.filter((p: any) => !isTechnicalParam(p));

    const form = useForm({
        defaultValues: node?.data.params || {},
        onSubmit: async ({ value }) => {
            if (node) {
                onChange(node.id, value);
                onBack();
            }
        },
    });

    const [isDirty, setIsDirty] = useState(false);
    useEffect(() => {
        setIsDirty(form.state.isDirty);
    }, [form.state.isDirty]);

    if (!node || parameters.length === 0) return null;

    const handleBack = () => {
        if (isDirty && !isReadOnly) {
            setShowConfirmBack(true);
        } else {
            onBack();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)] relative h-full overflow-hidden">
            {!inline && (
                <AppHeader
                    onBack={handleBack}
                    isSidebarOpen={false}
                    onToggleSidebar={() => { }}
                    leftContent={
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 rounded-[1rem] flex items-center justify-center bg-brand/20 text-brand border border-brand/30 shadow-inner">
                                <span className="material-icons text-[20px]">{nodeTypeData?.icon || 'tune'}</span>
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-sm font-bold text-[var(--text-main)] truncate">{node.data.label}</h3>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Edit Parameters</p>
                            </div>
                        </div>
                    }
                    rightContent={null}
                />
            )}


            <div className={`flex-1 overflow-y-auto custom-scrollbar ${inline ? 'p-6' : 'p-8'}`}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className={`${inline ? 'space-y-6' : 'max-w-4xl mx-auto space-y-8'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                    <div className={`${inline ? 'bg-transparent border-0 p-0 shadow-none' : 'bg-surface-800 border border-[var(--border-base)] rounded-2xl p-6 shadow-xl'}`}>
                        {!inline && <div className="px-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-6 border-b border-[var(--border-base)] pb-3">Configuration & Settings</div>}

                        <div className={`grid grid-cols-1 ${inline ? '' : 'md:grid-cols-2'} gap-6 relative z-10`}>
                            {parameters.map((param: any) => (
                                <form.Field
                                    key={param.name}
                                    name={param.name}
                                    children={(field) => (
                                        <ParameterRow
                                            param={param}
                                            value={field.state.value}
                                            displayValue={form.state.values[`_DISPLAY_${param.name}`]}
                                            onChange={(updates) => {
                                                Object.entries(updates).forEach(([key, val]) => {
                                                    if (key === param.name) {
                                                        field.handleChange(val);
                                                    } else {
                                                        form.setFieldValue(key as any, val as any);
                                                    }
                                                });
                                                // Trigger upstream update immediately for real-time application
                                                if (node) {
                                                    const updatedFormData = { ...form.state.values, ...updates };
                                                    onChange(node.id, updatedFormData);
                                                }
                                            }}
                                            isReadOnly={isReadOnly}
                                        />
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                </form>
            </div>

            <ConfirmModal
                isOpen={showConfirmBack}
                title="Unsaved Changes"
                description="You have modified parameters for this node. Do you want to discard your changes?"
                confirmLabel="Discard Changes"
                cancelLabel="Stay and Edit"
                onConfirm={() => {
                    setShowConfirmBack(false);
                    onBack();
                }}
                onCancel={() => setShowConfirmBack(false)}
            />
        </div>
    );
};



