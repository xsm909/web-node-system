import React, { useState, useMemo, useEffect } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { IconPicker } from '../../../shared/ui/icon';
import { Icon } from '../../../shared/ui/icon';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';
import { useForm } from '@tanstack/react-form';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { getPythonHints, type PythonHint } from '../../../shared/api/python-hints';
import { useThemeStore } from '../../../shared/lib/theme/store';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';


interface NodeTypeFormViewProps {
    onClose: () => void;
    editingNode: NodeType | null;
    initialData?: Partial<NodeType>;
    onSave: (data: Partial<NodeType>) => Promise<NodeType | void> | void;
    allNodes?: NodeType[];
    defaultTab?: FormTab;
    onRefresh?: () => void;
    projectId?: string | null;
}



// ─── Main View ───────────────────────────────────────────────────────────────

type FormTab = 'info' | 'code';

export const NodeTypeFormView: React.FC<NodeTypeFormViewProps> = ({
    onClose,
    editingNode,
    initialData,
    onSave,
    allNodes = [],
    defaultTab,
    onRefresh,
    projectId
}) => {
    const { theme } = useThemeStore();
    const [currentNode, setCurrentNode] = useState<Partial<NodeType>>(editingNode || initialData || {});
    const [activeTab, setActiveTab] = useState<FormTab>(defaultTab || 'info');
    const [cursorPosition, setCursorPosition] = useState<{ anchor: number, head: number } | null>(null);
    const [dynamicHints, setDynamicHints] = useState<PythonHint[]>([]);
    
    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);
    
    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(allNodes), [allNodes]);

    useEffect(() => {
        const fetchHints = async () => {
            const hints = await getPythonHints();
            setDynamicHints(hints);
        };
        fetchHints();
    }, []);

    // Sync state with props if they change
    useEffect(() => {
        if (editingNode || initialData) {
            const data = editingNode || initialData || {};
            setCurrentNode(data);
            form.reset({
                name: data.name || '',
                version: data.version || '1.0',
                description: data.description || '',
                category: data.category || '',
                icon: data.icon || 'function',
                code: data.code || 'def run(inputs, params):\n    return {}',
                is_async: !!data.is_async,
                show_in_toolbar: !!data.show_in_toolbar,
                input_schema: data.input_schema || {},
                output_schema: data.output_schema || {},
                parameters: data.parameters || [],
            });
        }
    }, [editingNode, initialData]);

    // Load saved cursor position on mount
    useEffect(() => {
        if (currentNode?.id) {
            const saved = localStorage.getItem(`cursor_pos_${currentNode.id}`);
            if (saved) {
                try {
                    const pos = JSON.parse(saved);
                    setCursorPosition(pos);
                } catch (e) {
                    console.error('Failed to parse saved cursor position', e);
                }
            }
        }
    }, [currentNode?.id]);
    
    useHotkeys([
        { key: 'F4', description: 'Python Code', handler: () => setActiveTab('code') }
    ], { scopeName: 'Node Type Editor' });

    const form = useForm({
        defaultValues: {
            name: currentNode?.name || '',
            version: currentNode?.version || '1.0',
            description: currentNode?.description || '',
            category: currentNode?.category || '',
            icon: currentNode?.icon || 'function',
            code: currentNode?.code || 'def run(inputs, params):\n    return {}',
            is_async: currentNode?.is_async || false,
            show_in_toolbar: currentNode?.show_in_toolbar || false,
            input_schema: currentNode?.input_schema || {},
            output_schema: currentNode?.output_schema || {},
            parameters: currentNode?.parameters || [],
        },
        onSubmit: async ({ value }) => {
            try {
                // Include ID in submission if we have it
                const payload = { ...value, id: currentNode?.id };
                const result = await onSave(payload as Partial<NodeType>);
                
                // If onSave returns the newly saved node, we update our baseline
                if (result) {
                    const updatedNode = result as NodeType;
                    setCurrentNode(updatedNode);
                    form.reset({
                        name: updatedNode.name || '',
                        version: updatedNode.version || '1.0',
                        description: updatedNode.description || '',
                        category: updatedNode.category || '',
                        icon: updatedNode.icon || 'function',
                        code: updatedNode.code || '',
                        is_async: !!updatedNode.is_async,
                        show_in_toolbar: !!updatedNode.show_in_toolbar,
                        input_schema: updatedNode.input_schema || {},
                        output_schema: updatedNode.output_schema || {},
                        parameters: updatedNode.parameters || [],
                    });
                } else {
                    form.reset(value);
                }
            } catch (err: any) {
                console.error('[NodeTypeFormView] Submit failed:', err);
            }
        },
    });

    const [isDirty, setIsDirty] = useState(false);
    
    console.log('[NodeTypeFormView] currentNode:', currentNode);
    console.log('[NodeTypeFormView] editingNode prop:', editingNode);
    console.log('[NodeTypeFormView] form values:', form.state.values);

    // Subscribe to form's baseStore to get reactive dirty state
    useEffect(() => {
        // Subscribe to form's store to get immediate updates
        const unsubscribe = form.baseStore.subscribe(() => {
            setIsDirty(form.state.isDirty);
        });
        return unsubscribe;
    }, [form]);

    const codeMirrorExtensions = useMemo(() => [
        python(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        autocompletion({
            override: [
                (context) => {
                    const word = context.matchBefore(/[\w\.]*/);
                    if (!word || (word.from === word.to && !context.explicit)) return null;
                    
                    const isMethod = word.text.includes('.');
                    let currentHints = dynamicHints;

                    if (isMethod) {
                        const parts = word.text.split('.');
                        const prefix = parts.slice(0, -1).join('.');
                        currentHints = dynamicHints.filter(h => h.label.startsWith(prefix + '.'));
                        
                        return {
                            from: word.from + prefix.length + 1,
                            options: currentHints.map(h => ({
                                label: h.label.split('.').pop() || h.label,
                                type: h.type,
                                detail: h.detail,
                                boost: h.boost
                            }))
                        };
                    }

                    return {
                        from: word.from,
                        options: [
                            ...dynamicHints.filter(h => !h.label.includes('.')).map(h => {
                                if (h.snippet) {
                                    return snippetCompletion(h.snippet, {
                                        label: h.label,
                                        detail: h.detail,
                                        type: h.type,
                                        boost: h.boost
                                    });
                                }
                                return {
                                    label: h.label,
                                    type: h.type,
                                    detail: h.detail,
                                    boost: h.boost
                                };
                            }),
                            { label: 'inputs', type: 'variable', detail: 'Node input data' },
                            { label: 'params', type: 'variable', detail: 'Node parameters' },
                        ]
                    };
                }
            ]
        })
    ], [dynamicHints]);

    return (
        <AppFormView
            title={currentNode?.name || editingNode?.name || 'Node Structure'}
            parentTitle="Node Library"
            icon="function"
            isDirty={isDirty}
            onSave={() => form.handleSubmit()}
            onCancel={onClose}
            saveLabel={currentNode?.id ? 'Save Changes' : 'Initialize Node'}
            tabs={[
                { id: 'info', label: 'Configuration' },
                { id: 'code', label: 'Python Engine' },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as FormTab)}
            entityId={currentNode?.id}
            entityType="node_types"
            projectId={projectId}
            isLocked={!!currentNode?.is_locked}
            onLockToggle={(locked) => {
                setCurrentNode(prev => prev ? { ...prev, is_locked: locked } : prev);
                if (onRefresh) onRefresh();
            }}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
                className="h-full"
            >
                {activeTab === 'info' && (
                    <div className="space-y-10 max-w-5xl mx-auto py-4">
                        <div className="grid grid-cols-12 gap-8 items-end">
                            <div className="col-span-6">
                                <form.Field
                                    name="name"
                                    children={(field) => (
                                        <AppInput
                                            label="Node Identification"
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            required
                                            placeholder="Display Name"
                                            className="text-lg font-normal"
                                            showCopy={!!editingNode}
                                            disabled={currentNode?.is_locked}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-4">
                                <form.Field
                                    name="category"
                                    children={(field) => (
                                        <AppCategoryInput
                                            label="Category"
                                            value={field.state.value}
                                            onChange={(v) => field.handleChange(v)}
                                            allPaths={allCategoryPaths}
                                            disabled={currentNode?.is_locked}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <form.Field
                                    name="version"
                                    children={(field) => (
                                        <AppInput
                                            label="Version"
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            required
                                            placeholder="1.0"
                                            className="font-mono font-normal text-center text-lg"
                                            disabled={currentNode?.is_locked}
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        <form.Field
                            name="description"
                            children={(field) => (
                                <AppInput
                                    label="Description"
                                    multiline
                                    rows={4}
                                    value={field.state.value}
                                    onChange={(val) => field.handleChange(val)}
                                    placeholder="Brief explanation of what this node does..."
                                    disabled={currentNode?.is_locked}
                                />
                            )}
                        />

                        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-[var(--border-base)]">
                            <div className="space-y-3">
                                <label className="text-xs font-normal text-[var(--text-main)] tracking-widest ml-1">Node Icon</label>
                                <form.Field
                                    name="icon"
                                    children={(field) => (
                                        <IconPicker
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            disabled={currentNode?.is_locked}
                                        />
                                    )}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-normal text-[var(--text-main)] tracking-widest ml-1">Execution Mode</label>
                                <form.Field
                                    name="is_async"
                                    children={(field) => (
                                        <div
                                            className={`flex items-center gap-3 px-5 py-4 rounded-xl border transition-all select-none h-[58px] ${field.state.value ? 'bg-brand/10 border-brand/50 text-brand' : 'bg-[var(--bg-app)] border-[var(--border-base)] text-[var(--text-muted)]'} ${currentNode?.is_locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            onClick={currentNode?.is_locked ? undefined : () => field.handleChange(!field.state.value)}
                                        >
                                            <Icon name={field.state.value ? 'sync' : 'bolt'} size={20} className={field.state.value ? 'animate-spin-slow' : ''} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-normal">{field.state.value ? 'Async Node' : 'Sync Node'}</span>
                                                <span className="text-[9px] uppercase tracking-tighter text-[var(--text-muted)]">{field.state.value ? 'Runs as task' : 'Direct execution'}</span>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-[var(--border-base)]">
                            <div className="space-y-3">
                                <label className="text-xs font-normal text-[var(--text-main)] tracking-widest ml-1">UI Visibility</label>
                                <form.Field
                                    name="show_in_toolbar"
                                    children={(field) => (
                                        <div
                                            className={`flex items-center gap-3 px-5 py-4 rounded-xl border transition-all select-none h-[58px] ${field.state.value ? 'bg-brand/10 border-brand/50 text-brand' : 'bg-[var(--bg-app)] border-[var(--border-base)] text-[var(--text-muted)]'} ${currentNode?.is_locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            onClick={currentNode?.is_locked ? undefined : () => field.handleChange(!field.state.value)}
                                        >
                                            <Icon name={field.state.value ? 'visibility' : 'visibility_off'} size={20} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-normal">{field.state.value ? 'Show in Toolbar' : 'Hidden from Toolbar'}</span>
                                                <span className="text-[9px] uppercase tracking-tighter text-[var(--text-muted)]">{field.state.value ? 'Visible in editor' : 'Internal node only'}</span>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'code' && (
                    <div className="h-full w-full mx-auto flex flex-col group">
                        <div className="flex-1 rounded-xl border border-[var(--border-base)] overflow-hidden focus-within:border-brand transition-all shadow-sm min-h-[500px]">
                            <form.Field
                                name="code"
                                children={(field) => {
                                    const codeValue = field.state.value || '';
                                    // Safety check for selection: ensure anchor/head are within bounds
                                    const len = codeValue.length;
                                    const safeSelection = cursorPosition ? {
                                        anchor: Math.min(cursorPosition.anchor, len),
                                        head: Math.min(cursorPosition.head, len)
                                    } : undefined;

                                    return (
                                        <CodeMirror
                                            value={codeValue}
                                            height="100%"
                                            theme={editorTheme}
                                            autoFocus
                                            extensions={codeMirrorExtensions}
                                            selection={safeSelection}
                                            onUpdate={(update) => {
                                                if (update.selectionSet && currentNode?.id) {
                                                    const sel = update.state.selection.main;
                                                    const pos = { anchor: sel.anchor, head: sel.head };
                                                    
                                                    // Only update state if significantly different to avoid feedback loops
                                                    if (!cursorPosition || cursorPosition.anchor !== pos.anchor || cursorPosition.head !== pos.head) {
                                                        localStorage.setItem(`cursor_pos_${currentNode.id}`, JSON.stringify(pos));
                                                        setCursorPosition(pos);
                                                    }
                                                }
                                            }}
                                            onChange={(value) => field.handleChange(value)}
                                            className="h-full text-sm font-mono"
                                            placeholder="# Define your executive logic here..."
                                            readOnly={currentNode?.is_locked}
                                        />
                                    );
                                }}
                            />
                        </div>
                        <div className="mt-4 text-[10px] text-[var(--text-muted)] flex justify-between px-4 font-normal uppercase tracking-widest opacity-40">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                Python Node Runtime
                            </div>
                            <div className="flex items-center gap-4">
                                <span>3.10+ Standard</span>
                                <span>IntelliSense Active</span>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </AppFormView>
    );
};
