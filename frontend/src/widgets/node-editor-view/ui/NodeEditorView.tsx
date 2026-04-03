/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';
import { AppHeader } from '../../app-header';
import { useForm } from '@tanstack/react-form';
import { QueryBuilderModal } from '../../../features/query-builder/ui/QueryBuilderModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '../../../shared/lib/hotkeys/HotkeysContext';
import { SYSTEM_PARAMETERS } from '../../../entities/report/model/constants';
import { ParameterRow } from './components/ParameterRow';
import { SpecializedEditorsModal } from './components/SpecializedEditorsModal';
import { useThemeStore } from '../../../shared/lib/theme/store';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';

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
    const { theme } = useThemeStore();
    const editorTheme = theme === "dark" ? vscodeDark : vscodeLight;
    const [showConfirmBack, setShowConfirmBack] = useState(false);
    const [sqlEditorParam, setSqlEditorParam] = useState<string | null>(null);
    const [specialEditorParam, setSpecialEditorParam] = useState<string | null>(null);
    const [specialEditorValue, setSpecialEditorValue] = useState<string>('');
    
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
        
        if (reallyDirty && !effectiveReadOnly) {
            setShowConfirmBack(true);
        } else {
            onBack();
        }
    };

    const handleOpenSpecialEditor = (name: string) => {
        setSpecialEditorParam(name);
        setSpecialEditorValue(form.state.values[name] || '');
    };

    const handleSaveSpecialEditor = () => {
        if (specialEditorParam) {
            form.setFieldValue(specialEditorParam as any, specialEditorValue);
            if (node) {
                const updatedFormData = { ...(node.data.params || {}), [specialEditorParam]: specialEditorValue };
                onChange(node.id, updatedFormData);
            }
        }
        setSpecialEditorParam(null);
    };

    const activeParam = parameters.find((p: any) => p.name === specialEditorParam);

    useHotkeys([
        {
            key: 'Escape',
            description: 'Back to Workflow',
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null && specialEditorParam === null) {
                    handleBack();
                } else if (specialEditorParam !== null) {
                    setSpecialEditorParam(null);
                }
            }
        },
        {
            key: 'cmd+s',
            description: 'Save Parameters',
            preventDefault: true,
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null && specialEditorParam === null) {
                    form.handleSubmit();
                } else if (specialEditorParam !== null) {
                    handleSaveSpecialEditor();
                }
            }
        },
        {
            key: 'ctrl+s',
            description: 'Save Parameters',
            preventDefault: true,
            handler: () => {
                if (!showConfirmBack && sqlEditorParam === null && specialEditorParam === null) {
                    form.handleSubmit();
                } else if (specialEditorParam !== null) {
                    handleSaveSpecialEditor();
                }
            }
        }
    ], {
        scopeName: `NodeEditor-${node?.id}`,
        enabled: !inline,
        exclusive: true,
        exclusiveExceptions: ['F1', 'F5'],
        level: HOTKEY_LEVEL.FRAGMENT
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
                                <div key={param.name} className={param.type === 'list_dataclass' ? 'col-span-full' : ''}>
                                    <form.Field
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
                                                        onChange(node.id, updatedFormData);
                                                    }
                                                }}
                                                isReadOnly={effectiveReadOnly}
                                                onOpenSqlEditor={() => setSqlEditorParam(param.name)}
                                                onOpenSpecialEditor={handleOpenSpecialEditor}
                                                nodeTypeId={nodeTypeData?.id}
                                                allParams={form.state.values}
                                            />
                                        )}
                                    />
                                </div>
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

            <SpecializedEditorsModal
                param={activeParam}
                value={specialEditorValue}
                onChange={setSpecialEditorValue}
                onClose={() => setSpecialEditorParam(null)}
                onSave={handleSaveSpecialEditor}
                isReadOnly={effectiveReadOnly}
                editorTheme={editorTheme}
            />
        </div>
    );
};
