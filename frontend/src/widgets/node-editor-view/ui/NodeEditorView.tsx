/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionItem } from '../../../shared/ui/selection-list/SelectionList';
import { apiClient } from '../../../shared/api/client';
import { AppHeader } from '../../app-header';
import { useForm } from '@tanstack/react-form';
import { AppInput } from '../../../shared/ui/app-input';
import { QueryBuilderModal } from '../../../features/query-builder/ui/QueryBuilderModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { SYSTEM_PARAMETERS } from '../../../entities/report/model/constants';

interface NodeEditorViewProps {
    node: Node | null;
    nodeTypes: NodeType[];
    onChange: (nodeId: string, params: any) => void;
    onBack: () => void;
    isReadOnly?: boolean;
    inline?: boolean;
    workflowParameters?: any[];
    isLocked?: boolean;
}

const ParameterRow: React.FC<{
    param: any;
    value: any;
    displayValue?: any;
    onChange: (updates: Record<string, any>) => void;
    isReadOnly: boolean;
    onOpenSqlEditor?: () => void;
}> = ({ param, value, displayValue, onChange, isReadOnly, onOpenSqlEditor }) => {
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
                    } else if (param.options_source.table === "users") {
                        endpoint = "/workflows/users/";
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
        if (value === undefined || value === null || value === "") return "";
        const item = options.find(i => i.id === String(value));
        if (item) return item.name;
        if (displayValue) return String(displayValue);
        if (isLoading) return "Loading...";
        return value;
    };

    return (
        <div className="space-y-1.5 group">
            <div className="flex items-center justify-between">
                <label
                    htmlFor={`param-${param.name}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] group-focus-within:text-brand transition-colors"
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
                        value={String(value ?? '')}
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
                        disabled={isReadOnly}
                    />
                ) : param.is_sql_query_constructor ? (
                    <AppInput
                        type="text"
                        multiline={false}
                        value={value ?? ''}
                        onChange={(val) => onChange({ [param.name]: val })}
                        placeholder={`Enter SQL query...`}
                        disabled={isReadOnly}
                        actions={[
                            {
                                icon: 'wizard',
                                onClick: () => onOpenSqlEditor?.(),
                                title: 'Open Query Constructor',
                                color: 'success',
                            }
                        ]}
                    />
                ) : (
                    <AppInput
                        label=""
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={value ?? ''}
                        onChange={(val) => {
                            const parsedVal = param.type === 'number' ? (val === '' ? '' : Number(val)) : val;
                            onChange({ [param.name]: parsedVal });
                        }}
                        placeholder={`Enter ${param.label.toLowerCase()}...`}
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
    workflowParameters = [],
    isLocked: _isLocked = false,
}) => {
    const [showConfirmBack, setShowConfirmBack] = useState(false);
    const [sqlEditorParam, setSqlEditorParam] = useState<string | null>(null);
    // Capture initial parameters when node is first opened to detect changes
    const [initialParams] = useState(() => JSON.stringify(node?.data.params || {}));

    const nodeTypeData = nodeTypes.find(t => 
        (node?.data.nodeTypeId && t.id === node.data.nodeTypeId) || 
        t.name === node?.data.label
    );
    const allParameters = nodeTypeData?.parameters || [];
    // Strict locking: isLocked (workflow lock) or explicit isReadOnly prevents parameter editing
    const effectiveReadOnly = isReadOnly || _isLocked;

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


    // Downward synchronization: update form if node data changes externally
    useEffect(() => {
        if (node?.data.params) {
            // Only reset if data actually differs to avoid feedback loops
            if (JSON.stringify(node.data.params) !== JSON.stringify(form.state.values)) {
                form.reset(node.data.params);
            }
        }
    }, [node?.data.params, form]);

    if (!node || parameters.length === 0) return null;

    const handleBack = () => {
        const currentParams = JSON.stringify(form.state.values);
        const reallyDirty = currentParams !== initialParams;
        
        console.log('[NodeEditorView] handleBack reallyDirty:', reallyDirty, 'isReadOnly:', effectiveReadOnly);
        
        if (reallyDirty && !effectiveReadOnly) {
            setShowConfirmBack(true);
        } else {
            onBack();
        }
    };

    useHotkeys([
        {
            key: 'Escape',
            description: 'Back to Workflow',
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null) {
                    handleBack();
                }
            }
        },
        {
            key: 'cmd+s',
            description: 'Save Parameters',
            preventDefault: true,
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null) {
                    form.handleSubmit();
                }
            }
        },
        {
            key: 'ctrl+s',
            description: 'Save Parameters',
            preventDefault: true,
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null) {
                    form.handleSubmit();
                }
            }
        }
    ], {
        scopeName: `NodeEditor-${node?.id}`,
        enabled: !inline,
        exclusive: true,
        exclusiveExceptions: ['F1', 'F5'] // maybe allow standard ones? Actually user said: "Also with workflow, if I go into node editing mode. What was available for workflow is no longer available until I return."
    });
    return (
        <div className={`flex-1 flex flex-col min-w-0 relative h-full overflow-hidden ${inline ? 'bg-transparent shadow-none' : 'bg-[var(--bg-app)]'}`}>
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


            <div className={inline ? 'p-0' : 'flex-1 overflow-y-auto custom-scrollbar p-8'}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className={`${inline ? 'space-y-4' : 'max-w-4xl mx-auto space-y-8'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                    <div className={`${inline ? 'bg-transparent border-0 p-0 shadow-none' : 'bg-surface-800 border border-[var(--border-base)] rounded-2xl p-6 shadow-xl'}`}>
                        {!inline && <div className="px-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-6 border-b border-[var(--border-base)] pb-3">Configuration & Settings</div>}

                        <div className={`grid grid-cols-1 ${inline ? '' : 'md:grid-cols-2'} gap-4 relative z-10`}>
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
                                                    const updatedFormData = { ...(node.data.params || {}), ...updates };
                                                    console.log('[NodeEditorView] onChange triggered for node:', node.id, 'updates:', updates, 'final params:', updatedFormData);
                                                    onChange(node.id, updatedFormData);
                                                }
                                            }}
                                            isReadOnly={effectiveReadOnly}
                                            onOpenSqlEditor={() => setSqlEditorParam(param.name)}
                                        />
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                </form>
            </div>

            <AppCompactModalForm
                isOpen={showConfirmBack}
                title="Unsaved Changes"
                onClose={() => setShowConfirmBack(false)}
                onSubmit={() => {
                    setShowConfirmBack(false);
                    form.handleSubmit(); // Save and back (handled by form.onSubmit)
                }}
                onDiscard={() => {
                    setShowConfirmBack(false);
                    onBack();
                }}
                submitLabel="Save and Back"
                cancelLabel="Stay and Edit"
                discardLabel="Discard Changes"
                icon="warning"
                width="max-w-md"
            >
                <div className="py-2">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        You have modified parameters for this node. Do you want to save them before leaving?
                    </p>
                </div>
            </AppCompactModalForm>

            <QueryBuilderModal
                isOpen={sqlEditorParam !== null}
                initialSql={sqlEditorParam ? form.state.values[sqlEditorParam] : ''}
                onClose={() => setSqlEditorParam(null)}
                onError={(err) => console.error("SQL Builder Error:", err)}
                onDone={(newSql) => {
                    if (sqlEditorParam) {
                        const trimmedSql = newSql.trim();
                        form.setFieldValue(sqlEditorParam as any, trimmedSql);
                        if (node) {
                            const updatedFormData = { ...(node.data.params || {}), [sqlEditorParam]: trimmedSql };
                            onChange(node.id, updatedFormData);
                        }
                    }
                    setSqlEditorParam(null);
                }}
                parameters={[...(workflowParameters || []), ...SYSTEM_PARAMETERS]}
            />
        </div>
    );
};

