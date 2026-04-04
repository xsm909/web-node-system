import React, { useState, useEffect, useRef } from 'react';
import { ComboBox } from '../../../../shared/ui/combo-box/ComboBox';
import { Icon } from '../../../../shared/ui/icon';
import { AppContextMenu } from '../../../../shared/ui/app-context-menu';
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
    workflowParameters?: any[];
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
    allParams,
    workflowParameters = []
}) => {
    const [options, setOptions] = useState<SelectionItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);
    const [linkAnchorRect, setLinkAnchorRect] = useState<DOMRect | null>(null);
    const linkButtonRef = useRef<HTMLButtonElement>(null);

    const isLinked = typeof value === 'string' && value.startsWith('@');

    const matchingWorkflowParams = (workflowParameters || [])
        .filter(p => {
            const nodeType = (param.type || "").toLowerCase();
            const workflowType = (p.parameter_type || "").toLowerCase();
            
            if (nodeType === workflowType) return true;
            
            // Text node can accept almost any basic workflow parameter or sql constructor
            if (nodeType === 'text' || nodeType === 'string') {
                return ['text', 'string', 'select', 'sql_query_constructor'].includes(workflowType);
            }
            
            return false;
        })
        .map(p => ({
            id: `@${p.parameter_name}`,
            name: p.parameter_name,
            icon: 'workflow'
        }));

    const canBeLinked = !param.is_sql_query_constructor; // SQL Constructor is excluded

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

    const handleLink = (targetParamName: string) => {
        onChange({ 
            [param.name]: targetParamName,
            [`_LOCAL_${param.name}`]: value, // Backup current local value
            [`_DISPLAY_${param.name}`]: undefined 
        });
    };

    const handleUnlink = () => {
        const localBackup = allParams?.[`_LOCAL_${param.name}`];
        onChange({ 
            [param.name]: localBackup !== undefined ? localBackup : "",
            [`_LOCAL_${param.name}`]: undefined, // Cleanup backup
            [`_DISPLAY_${param.name}`]: undefined
        });
    };

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
        <div className="space-y-0.5 group">
            <div className="flex items-center justify-between h-[21px] gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <label
                        htmlFor={`param-${param.name}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] group-focus-within:text-brand transition-colors shrink-0"
                    >
                        {param.label}
                    </label>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
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
            </div>

            <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                    {(param.is_sql_query_constructor || param.is_md_editor || param.is_text_editor || param.is_python_editor) ? (
                        <div 
                            className={`flex items-center h-full ${!isReadOnly && !isLinked ? 'cursor-pointer hover:opacity-70 transition-opacity active:scale-[0.98]' : ''}`}
                            onClick={(e) => {
                                if (isReadOnly || isLinked) return;
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
                                className="w-full"
                            />
                        </div>
                    ) : (param.type !== 'boolean' && (
                        isLinked ? (
                            <AppValuePreview 
                                value={value}
                                isLocked={true}
                                parameterName={param.name}
                                paramDef={param}
                                className="w-full"
                            />
                        ) : (
                            param.options_source?.component === 'ComboBox' ? (
                                <ComboBox
                                    value={String(value ?? '')}
                                    label={getSelectedLabel()}
                                    items={options}
                                    onSelect={(item) => onChange({ [param.name]: item.id, [`_DISPLAY_${param.name}`]: item.name })}
                                    disabled={isReadOnly}
                                    placeholder={param.placeholder || "Select..."}
                                    className="w-full"
                                />
                            ) : (
                                <AppInput
                                    value={String(value ?? "")}
                                    onChange={(val) => onChange({ [param.name]: val })}
                                    disabled={isReadOnly}
                                    placeholder={param.placeholder}
                                    className="w-full"
                                />
                            )
                        )
                    ))}
                </div>

                {/* Actions Section: Link/Unlink and Specialized Editors */}
                <div className="flex items-center gap-1.5 shrink-0 h-[32px]">
                    {!isLinked && !isReadOnly && (param.is_sql_query_constructor || param.is_md_editor || param.is_text_editor || param.is_python_editor) && (
                        <AppRoundButton 
                            icon={param.is_sql_query_constructor ? "QueryBuilder" : "edit"} 
                            variant="outline" 
                            size="xs" 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (param.is_sql_query_constructor) onOpenSqlEditor?.();
                                else onOpenSpecialEditor?.(param.name);
                            }}
                            title="Open Editor"
                        />
                    )}

                    {canBeLinked && !isReadOnly && (
                        <>
                            <AppRoundButton
                                ref={linkButtonRef}
                                icon={isLinked ? "link_st_off" : "link_st"}
                                variant="outline"
                                size="xs"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (isLinked) {
                                        handleUnlink();
                                    } else {
                                        setLinkAnchorRect(linkButtonRef.current?.getBoundingClientRect() || null);
                                        setIsLinkDropdownOpen(true);
                                    }
                                }}
                                title={isLinked ? "Unlink from Workflow" : "Link to Workflow"}
                                iconClassName={isLinked ? "text-blue-500" : "text-[var(--text-muted)]"}
                            />
                            
                            <AppContextMenu
                                isOpen={isLinkDropdownOpen}
                                onClose={() => setIsLinkDropdownOpen(false)}
                                anchorRect={linkAnchorRect}
                            >
                                <div className="p-2 space-y-1">
                                    <div className="px-3 py-1.5 mb-1 border-b border-[var(--border-base)]/50">
                                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Link to Param</div>
                                    </div>
                                    {matchingWorkflowParams.length === 0 ? (
                                        <div className="px-4 py-3 text-[10px] text-[var(--text-muted)] italic">
                                            No matching parameters found
                                        </div>
                                    ) : (
                                        matchingWorkflowParams.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    handleLink(p.id);
                                                    setIsLinkDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-normal text-[var(--text-main)] hover:bg-brand/10 rounded-xl transition-all outline-none group"
                                            >
                                                <div className="w-7 h-7 rounded-lg bg-brand/5 flex items-center justify-center text-brand transition-colors group-hover:bg-brand/20">
                                                    <Icon name="workflow" size={14} />
                                                </div>
                                                <span className="flex-1 text-left">{p.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </AppContextMenu>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
