import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { getPythonHints, type PythonHint } from '../../../shared/api/python-hints';


interface NodeTypeFormViewProps {
    onClose: () => void;
    editingNode: NodeType | null;
    initialData?: Partial<NodeType>;
    onSave: (data: Partial<NodeType>) => Promise<NodeType | void> | void;
    allNodes?: NodeType[];
    defaultTab?: FormTab;
}

// ─── Category Combo-box ───────────────────────────────────────────────────────

interface CategoryComboBoxProps {
    value: string;
    onChange: (v: string) => void;
    allNodes: NodeType[];
}

const CategoryComboBox: React.FC<CategoryComboBoxProps> = ({ value, onChange, allNodes }) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const allPaths = useMemo(() => getUniqueCategoryPaths(allNodes), [allNodes]);

    const filtered = useMemo(() => {
        const q = inputValue.toLowerCase();
        return q ? allPaths.filter(p => p.toLowerCase().includes(q)) : allPaths;
    }, [allPaths, inputValue]);

    const handleSelect = (path: string) => {
        setInputValue(path);
        onChange(path);
        setOpen(false);
    };

    const handleInputChange = (v: string) => {
        setInputValue(v);
        onChange(v);
        setOpen(true);
    };

    return (
        <div ref={ref} className="relative">
            <AppInput
                label=""
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setOpen(true)}
                placeholder="e.g. AI|Chat|Gemini"
                className="font-bold"
            />
            <button
                type="button"
                tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity text-[var(--text-main)] mt-0.5"
                onClick={() => setOpen(o => !o)}
            >
                <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
            </button>


            {open && filtered.length > 0 && (
                <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                    {filtered.map(path => {
                        const parts = path.split('|');
                        const depth = parts.length - 1;
                        const isLeaf = !allPaths.some(p => p.startsWith(path + '|'));
                        return (
                            <button
                                key={path}
                                type="button"
                                className={`w-full text-left px-5 py-2.5 text-sm transition-colors hover:bg-brand/10 hover:text-brand flex items-center gap-2 ${value === path ? 'bg-brand/10 text-brand' : 'text-[var(--text-muted)]'}`}
                                style={{ paddingLeft: `${20 + depth * 16}px` }}
                                onClick={() => handleSelect(path)}
                            >
                                <span className={`text-[10px] mr-1 opacity-40 ${isLeaf ? '' : 'text-brand'}`}>
                                    {isLeaf ? '●' : '▶'}
                                </span>
                                <span className="font-bold">{parts[parts.length - 1]}</span>
                                {depth > 0 && (
                                    <span className="text-[10px] opacity-40 ml-auto font-mono">
                                        {parts.slice(0, -1).join(' › ')}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Main View ───────────────────────────────────────────────────────────────

type FormTab = 'info' | 'code';

export const NodeTypeFormView: React.FC<NodeTypeFormViewProps> = ({
    onClose,
    editingNode,
    initialData,
    onSave,
    allNodes = [],
    defaultTab,
}) => {
    const [currentNode, setCurrentNode] = useState<Partial<NodeType>>(editingNode || initialData || {});
    const [activeTab, setActiveTab] = useState<FormTab>(defaultTab || 'info');
    const [cursorPosition, setCursorPosition] = useState<{ anchor: number, head: number } | null>(null);
    const [dynamicHints, setDynamicHints] = useState<PythonHint[]>([]);

    useEffect(() => {
        const fetchHints = async () => {
            const hints = await getPythonHints();
            setDynamicHints(hints);
        };
        fetchHints();
    }, []);

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
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F4') {
                e.preventDefault();
                setActiveTab('code');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const form = useForm({
        defaultValues: {
            name: currentNode?.name || '',
            version: currentNode?.version || '1.0',
            description: currentNode?.description || '',
            category: currentNode?.category || '',
            icon: currentNode?.icon || 'task',
            code: currentNode?.code || 'def run(inputs, params):\n    return {}',
            is_async: currentNode?.is_async || false,
            input_schema: currentNode?.input_schema || {},
            output_schema: currentNode?.output_schema || {},
            parameters: currentNode?.parameters || [],
        },
        onSubmit: async ({ value }) => {
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
                    icon: updatedNode.icon || 'task',
                    code: updatedNode.code || '',
                    is_async: !!updatedNode.is_async,
                    input_schema: updatedNode.input_schema || {},
                    output_schema: updatedNode.output_schema || {},
                    parameters: updatedNode.parameters || [],
                });
            } else {
                form.reset(value);
            }
        },
    });

    const [isDirty, setIsDirty] = useState(false);
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
            title={currentNode?.name || 'New Node Structure'}
            parentTitle="Node Library"
            icon="device_hub"
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
                    <div className="space-y-10 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-4 gap-8">
                            <div className="col-span-3">
                                <form.Field
                                    name="name"
                                    children={(field) => (
                                        <AppInput
                                            label="Node Identification"
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            required
                                            placeholder="Display Name"
                                            className="text-lg font-bold"
                                        />
                                    )}
                                />
                            </div>
                            <div>
                                <form.Field
                                    name="version"
                                    children={(field) => (
                                        <AppInput
                                            label="Ver."
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            required
                                            placeholder="1.0"
                                            className="font-mono font-black text-center text-lg"
                                        />
                                    )}
                                />
                            </div>
                        </div>


                        <div className="grid grid-cols-3 gap-8">
                            <div className="col-span-1 space-y-3">
                                <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">
                                    Category Path
                                    <span className="normal-case font-medium ml-2 opacity-50">pipe-separated</span>
                                </label>
                                <form.Field
                                    name="category"
                                    children={(field) => (
                                        <CategoryComboBox
                                            value={field.state.value}
                                            onChange={(v) => field.handleChange(v)}
                                            allNodes={allNodes}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-1 space-y-3">
                                <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Node Icon</label>
                                <form.Field
                                    name="icon"
                                    children={(field) => (
                                        <IconPicker
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                        />
                                    )}
                                />
                            </div>
                            <div className="col-span-1 space-y-3">
                                <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Execution Mode</label>
                                <form.Field
                                    name="is_async"
                                    children={(field) => (
                                        <div
                                            className={`flex items-center gap-3 px-5 py-4 rounded-xl border transition-all cursor-pointer select-none ${field.state.value ? 'bg-brand/10 border-brand/50 text-brand' : 'bg-[var(--bg-app)] border-[var(--border-base)] text-[var(--text-muted)]'}`}
                                            onClick={() => field.handleChange(!field.state.value)}
                                        >
                                            <Icon name={field.state.value ? 'sync' : 'bolt'} size={20} className={field.state.value ? 'animate-spin-slow' : ''} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{field.state.value ? 'Async Node' : 'Sync Node'}</span>
                                                <span className="text-[9px] uppercase tracking-tighter opacity-60">{field.state.value ? 'Runs as task' : 'Direct execution'}</span>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        <form.Field
                            name="description"
                            children={(field) => (
                                <AppInput
                                    label="Functional Description"
                                    multiline
                                    rows={6}
                                    value={field.state.value}
                                    onChange={(val) => field.handleChange(val)}
                                    placeholder="Provide a comprehensive explanation of the node's purpose and expected inputs/outputs..."
                                />
                            )}
                        />

                    </div>
                )}

                {activeTab === 'code' && (
                    <div className="h-full w-full mx-auto flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex-1 rounded-xl bg-[#0a0a0f] border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner min-h-[500px]">
                            <form.Field
                                name="code"
                                children={(field) => (
                                    <CodeMirror
                                        value={field.state.value}
                                        height="100%"
                                        theme="dark"
                                        autoFocus
                                        extensions={codeMirrorExtensions}
                                        selection={cursorPosition || undefined}
                                        onUpdate={(update) => {
                                            if (update.selectionSet && currentNode?.id) {
                                                const sel = update.state.selection.main;
                                                const pos = { anchor: sel.anchor, head: sel.head };
                                                
                                                // Only save if it's different from what we already have in state
                                                // (to avoid unnecessary localStorage writes)
                                                if (JSON.stringify(pos) !== JSON.stringify(cursorPosition)) {
                                                    localStorage.setItem(`cursor_pos_${currentNode.id}`, JSON.stringify(pos));
                                                    setCursorPosition(pos);
                                                }
                                            }
                                        }}
                                        onChange={(value) => field.handleChange(value)}
                                        className="h-full text-sm font-mono"
                                        placeholder="# Define your executive logic here..."
                                    />
                                )}
                            />
                        </div>
                        <div className="mt-4 text-[10px] text-[var(--text-muted)] flex justify-between px-4 font-black uppercase tracking-widest opacity-40">
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
