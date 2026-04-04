import React, { useState, useEffect } from 'react';
import { ComboBox } from '../../../../shared/ui/combo-box/ComboBox';
import type { SelectionItem } from '../../../../shared/ui/selection-list/SelectionList';
import { apiClient } from '../../../../shared/api/client';
import { AppInput } from '../../../../shared/ui/app-input';
import { DataclassListEditor } from '../../../../shared/ui/dataclass-list-editor';
import { AppRoundButton } from '../../../../shared/ui/app-round-button/AppRoundButton';
import { AppValuePreview } from '../../../../shared/ui/app-value-preview';

interface ParameterRowProps {
    param: any;
    value: any;
    displayValue?: any;
    onChange: (updates: Record<string, any>) => void;
    isReadOnly: boolean;
    onOpenSqlEditor?: () => void;
    onOpenSpecialEditor?: (name: string) => void;
    nodeTypeId?: string;
    allParams?: any;
}

export const ParameterRow: React.FC<ParameterRowProps> = ({ 
    param, 
    value, 
    displayValue, 
    onChange, 
    isReadOnly, 
    onOpenSqlEditor, 
    onOpenSpecialEditor, 
    nodeTypeId, 
    allParams 
}) => {
    const [options, setOptions] = useState<SelectionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (param.options_source?.component === 'ComboBox') {
            const fetchOptions = async () => {
                setIsLoading(true);
                try {
                    let endpoint = "";
                    let requestParams = {};
                    
                    if (param.options_source.function) {
                        endpoint = `/workflows/node-types/${nodeTypeId}/parameter-options/${param.name}`;
                        requestParams = { source_func: param.options_source.function };
                    } else if (param.options_source.table === "AI_Tasks") {
                        endpoint = "/ai-tasks/";
                    } else if (param.options_source.table === "users") {
                        endpoint = "/workflows/users/";
                    } else if (param.options_source.table) {
                        endpoint = `/${param.options_source.table.toLowerCase().replace(/_/g, '-')}/`;
                    }

                    if (!endpoint) {
                        setIsLoading(false);
                        return;
                    }

                    const response = await apiClient.get(endpoint, { 
                        params: { 
                            ...requestParams,
                            params: JSON.stringify(allParams || {})
                        } 
                    });
                    const data = response.data;

                    let flatOptions: SelectionItem[] = [];
                    
                    if (param.options_source.function) {
                        flatOptions = data.map((item: any) => {
                            const val = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : Object.values(item)[0]);
                            const lab = item.label !== undefined ? item.label : (item.name !== undefined ? item.name : val);
                            return {
                                id: String(val),
                                name: String(lab),
                                icon: 'bolt'
                            };
                        });
                    } else {
                        flatOptions = data
                            .filter((item: any) => {
                                if (param.options_source.filters) {
                                    return Object.entries(param.options_source.filters).every(
                                        ([key, val]) => item[key] === val
                                    );
                                }
                                return true;
                            })
                            .map((item: any) => {
                                // Priority 1: explicitly configured fields
                                // Priority 2: 'value'/'label' common convention
                                // Priority 3: 'id'/'name' common convention
                                // Priority 4: first/second columns
                                
                                const valField = param.options_source.value_field;
                                const labField = param.options_source.label_field;
                                
                                let val = valField ? item[valField] : undefined;
                                if (val === undefined) val = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : Object.values(item)[0]);
                                
                                let lab = labField ? item[labField] : undefined;
                                if (lab === undefined) lab = item.label !== undefined ? item.label : (item.name !== undefined ? item.name : val);

                                return {
                                    id: String(val),
                                    name: String(lab),
                                    icon: 'bolt'
                                };
                            });
                    }
                        
                    setOptions(flatOptions);
                } catch (error) {
                    console.error("Failed to fetch options for", param.name, error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchOptions();
        }
    }, [param, nodeTypeId, JSON.stringify(allParams || {})]);

    const getSelectedLabel = () => {
        if (value === undefined || value === null || value === "") return "";
        const item = options.find(i => i.id === String(value));
        if (item) return item.name;
        if (displayValue) return String(displayValue);
        if (isLoading) return "Loading...";
        return value;
    };

    if (param.type === 'list_dataclass') {
        return (
            <DataclassListEditor
                schema={param.schema}
                value={value}
                onChange={(newVal) => onChange({ [param.name]: newVal })}
                isReadOnly={isReadOnly}
                label={param.label}
            />
        );
    }

    return (
        <div className="space-y-1.5 group">
            <div className="flex items-center justify-between h-[21px] gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <label
                        htmlFor={`param-${param.name}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] group-focus-within:text-brand transition-colors shrink-0"
                    >
                        {param.label}
                    </label>
                    {(param.is_sql_query_constructor || param.is_md_editor || param.is_text_editor || param.is_python_editor) && (
                        <>
                            <div 
                                className={`flex-1 min-w-0 flex items-center h-full ${!isReadOnly ? 'cursor-pointer hover:opacity-70 transition-opacity active:scale-[0.98]' : ''}`}
                                onClick={(e) => {
                                    if (isReadOnly) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (param.is_sql_query_constructor) onOpenSqlEditor?.();
                                    else onOpenSpecialEditor?.(param.name);
                                }}
                            >
                                <AppValuePreview 
                                    value={value}
                                    isLocked={true}
                                    parameterName={param.name}
                                    paramDef={param}
                                    className="w-full pointer-events-none"
                                />
                            </div>
                            <AppRoundButton 
                                icon={param.is_sql_query_constructor ? "QueryBuilder" : "edit"} 
                                variant="outline" 
                                size="xs" 
                                isDisabled={isReadOnly}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (param.is_sql_query_constructor) onOpenSqlEditor?.();
                                    else onOpenSpecialEditor?.(param.name);
                                }}
                                title="Open Editor"
                            />
                        </>
                    )}
                </div>
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

            {param.type !== 'boolean' && !param.is_sql_query_constructor && !param.is_md_editor && !param.is_text_editor && !param.is_python_editor && (
                param.options_source?.component === 'ComboBox' ? (
                    <ComboBox
                        value={String(value ?? '')}
                        label={getSelectedLabel()}
                        icon="bolt"
                        placeholder={isLoading ? "Loading..." : `Select ${param.label.toLowerCase()}...`}
                        data={{}}
                        items={options}
                        onSelect={(item) => {
                            onChange({
                                [param.name]: item.id,
                                [`_DISPLAY_${param.name}`]: item.name
                            });
                        }}
                        className="w-full"
                        disabled={isReadOnly}
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
