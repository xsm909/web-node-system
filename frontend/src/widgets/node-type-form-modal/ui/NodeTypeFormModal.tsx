import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { Icon } from '../../../shared/ui/icon';

interface NodeTypeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingNode: NodeType | null;
    formData: Partial<NodeType>;
    setFormData: (data: Partial<NodeType>) => void;
    onSave: (e: React.FormEvent) => void;
}

export const NodeTypeFormModal: React.FC<NodeTypeFormModalProps> = ({
    isOpen,
    onClose,
    editingNode,
    formData,
    setFormData,
    onSave,
}) => {
    const [activeTab, setActiveTab] = useState<'info' | 'code'>('info');

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-3xl h-[85vh] flex flex-col bg-surface-800 border border-[var(--border-base)] rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out">
                <header className="px-10 pt-10 pb-0 border-b border-[var(--border-base)] flex flex-col gap-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="16 18 22 12 16 6"></polyline>
                                    <polyline points="8 6 2 12 8 18"></polyline>
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-[var(--text-main)] tracking-tight">
                                    {editingNode ? 'Edit Node Structure' : 'Architect New Node'}
                                </h2>
                                <p className="text-xs text-[var(--text-muted)] opacity-60 font-bold uppercase tracking-wider">Configure logic and metadata</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all active:scale-90"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 rounded-t-xl ${activeTab === 'info'
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setActiveTab('info')}
                        >
                            Configuration
                        </button>
                        <button
                            type="button"
                            className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 rounded-t-xl ${activeTab === 'code'
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setActiveTab('code')}
                        >
                            Python Engine
                        </button>
                    </div>
                </header>

                <form onSubmit={onSave} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        {activeTab === 'info' ? (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-4 gap-8">
                                    <div className="col-span-3 space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Node Identification</label>
                                        <input
                                            className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold text-lg"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Display Name"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1 text-center block">Ver.</label>
                                        <input
                                            className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-mono font-black text-center text-lg"
                                            value={formData.version || ''}
                                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                            required
                                            placeholder="1.0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Architectural Category</label>
                                        <input
                                            className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold"
                                            value={formData.category || ''}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="e.g. UTILITY, AI, DATA"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Node Icon</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] flex items-center justify-center text-[var(--text-main)] shadow-inner">
                                                <Icon name={formData.icon || 'task'} dir="node_icons" size={24} />
                                            </div>
                                            <select
                                                className="flex-1 px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold appearance-none"
                                                value={formData.icon || 'task'}
                                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                            >
                                                {Object.keys(import.meta.glob('../../../assets/node_icons/*.svg')).map((path) => {
                                                    const name = path.split('/').pop()?.replace('.svg', '') || '';
                                                    return (
                                                        <option key={name} value={name}>
                                                            {name.charAt(0).toUpperCase() + name.slice(1)}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Functional Description</label>
                                    <textarea
                                        className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all min-h-[160px] resize-none font-medium leading-relaxed"
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Provide a comprehensive explanation of the node's purpose and expected inputs/outputs..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex-1 rounded-3xl bg-[#0a0a0f] border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner">
                                    <CodeMirror
                                        value={formData.code || ''}
                                        height="100%"
                                        theme="dark"
                                        extensions={codeMirrorExtensions}
                                        onChange={(value) => setFormData({ ...formData, code: value })}
                                        className="h-full text-sm font-mono"
                                        placeholder="# Define your executive logic here..."
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

                    <div className="px-10 py-8 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex items-center justify-end gap-4">
                        <button
                            type="button"
                            className="px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all active:scale-95 border border-transparent hover:border-[var(--border-base)]"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-10 py-3.5 rounded-2xl bg-brand hover:brightness-110 text-white font-black uppercase tracking-widest shadow-xl shadow-brand/20 active:scale-95 transition-all text-sm"
                        >
                            {editingNode ? 'Propagate Changes' : 'Initialize Node'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


