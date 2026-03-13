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
import { AppHeader } from '../../app-header';
import { useForm } from '@tanstack/react-form';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

interface NodeTypeFormViewProps {
    onClose: () => void;
    editingNode: NodeType | null;
    initialData?: Partial<NodeType>;
    onSave: (data: Partial<NodeType>) => void;
    allNodes?: NodeType[];
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
            <div className="relative">
                <input
                    className="w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold"
                    value={inputValue}
                    onChange={e => handleInputChange(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder="e.g. AI|Chat|Gemini"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity text-[var(--text-main)]"
                    onClick={() => setOpen(o => !o)}
                >
                    <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
                </button>
            </div>

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
}) => {
    const [activeTab, setActiveTab] = useState<FormTab>('info');
    const [showConfirmBack, setShowConfirmBack] = useState(false);

    const form = useForm({
        defaultValues: {
            name: (editingNode?.name || initialData?.name) || '',
            version: (editingNode?.version || initialData?.version) || '1.0',
            description: (editingNode?.description || initialData?.description) || '',
            category: (editingNode?.category || initialData?.category) || '',
            icon: (editingNode?.icon || initialData?.icon) || 'task',
            code: (editingNode?.code || initialData?.code) || 'def run(inputs, params):\n    return {}',
            is_async: (editingNode?.is_async || initialData?.is_async) || false,
            input_schema: (editingNode?.input_schema || initialData?.input_schema) || {},
            output_schema: (editingNode?.output_schema || initialData?.output_schema) || {},
            parameters: (editingNode?.parameters || initialData?.parameters) || [],
        },
        onSubmit: async ({ value }) => {
            onSave(value as Partial<NodeType>);
        },
    });

    const [isDirty, setIsDirty] = useState(false);
    useEffect(() => {
        setIsDirty(form.state.isDirty);
    }, [form.state.isDirty]);

    const handleBack = () => {
        if (isDirty) {
            setShowConfirmBack(true);
        } else {
            onClose();
        }
    };

    const codeMirrorExtensions = useMemo(() => [
        python(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        autocompletion({
            override: [
                (context) => {
                    const word = context.matchBefore(/\w*/);
                    if (word && word.from === word.to && !context.explicit) return null;
                    return {
                        from: word ? word.from : context.pos,
                        options: [
                            snippetCompletion('def run(inputs, params):\n\t${1:print("Hello")}\n\treturn ${2:{}}', {
                                label: 'run',
                                detail: 'Standard node function',
                                type: 'function'
                            }),
                            { label: 'inputs', type: 'variable', detail: 'Node input data' },
                            { label: 'params', type: 'variable', detail: 'Node parameters' },
                            { label: 'print', type: 'function' },
                            { label: 'return', type: 'keyword' },
                        ]
                    };
                }
            ]
        })
    ], []);

    return (
        <div className="w-full h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden">
            <AppHeader
                onToggleSidebar={() => { }}
                isSidebarOpen={false}
                onBack={handleBack}
                leftContent={
                    <div className="flex items-center gap-3 ml-2 lg:ml-0">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                            <Icon name="device_hub" size={18} />
                        </div>
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                            {editingNode ? 'Edit Node Structure' : 'Architect New Node'}
                        </h1>
                    </div>
                }
            />

            <div className="flex-1 overflow-hidden flex flex-col">
                <header className="px-10 pt-6 pb-0 border-b border-[var(--border-base)]">
                    <div className="flex gap-2">
                        {([
                            { id: 'info', label: 'Configuration' },
                            { id: 'code', label: 'Python Engine' }
                        ] as { id: FormTab, label: string }[]).map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`px-8 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl ${activeTab === tab.id
                                    ? 'text-brand border-brand bg-brand/5'
                                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                    }`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </header>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        {activeTab === 'info' && (
                            <div className="space-y-10 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-4 gap-8">
                                    <div className="col-span-3 space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Node Identification</label>
                                        <form.Field
                                            name="name"
                                            children={(field) => (
                                                <input
                                                    className="w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold text-lg"
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    required
                                                    placeholder="Display Name"
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1 text-center block">Ver.</label>
                                        <form.Field
                                            name="version"
                                            children={(field) => (
                                                <input
                                                    className="w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-mono font-black text-center text-lg"
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    required
                                                    placeholder="1.0"
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

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Functional Description</label>
                                    <form.Field
                                        name="description"
                                        children={(field) => (
                                            <textarea
                                                className="w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all min-h-[160px] resize-none font-medium leading-relaxed"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) => field.handleChange(e.target.value)}
                                                placeholder="Provide a comprehensive explanation of the node's purpose and expected inputs/outputs..."
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'code' && (
                            <div className="h-full max-w-screen-xl mx-auto flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex-1 rounded-xl bg-[#0a0a0f] border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner min-h-[500px]">
                                    <form.Field
                                        name="code"
                                        children={(field) => (
                                            <CodeMirror
                                                value={field.state.value}
                                                height="100%"
                                                theme="dark"
                                                extensions={codeMirrorExtensions}
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
                    </div>


                    <div className="px-10 py-6 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex flex-row items-center gap-4">
                        <div className="flex-1"></div>
                        <button
                            type="button"
                            className="px-6 py-2.5 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all"
                            onClick={handleBack}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 rounded-xl bg-brand hover:brightness-110 text-white font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all text-sm flex items-center gap-2"
                        >
                            <Icon name="save" size={16} />
                            {editingNode ? 'Save Changes' : 'Initialize Node'}
                        </button>
                    </div>
                </form>

                <ConfirmModal
                    isOpen={showConfirmBack}
                    title="Unsaved Changes"
                    description="You have unsaved changes in this node structure. Are you sure you want to leave? All progress will be lost."
                    confirmLabel="Discard Changes"
                    cancelLabel="Stay and Edit"
                    onConfirm={() => {
                        setShowConfirmBack(false);
                        onClose();
                    }}
                    onCancel={() => setShowConfirmBack(false)}
                />
            </div>
        </div>
    );
};
