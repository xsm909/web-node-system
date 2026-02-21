import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-3xl h-[90vh] flex flex-col bg-surface-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5 animate-in zoom-in-95 duration-200">
                <header className="px-8 pt-8 pb-0 border-b border-white/5 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white/90">
                            {editingNode ? 'Edit Node Type' : 'Add New Node Type'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex gap-1">
                        <button
                            type="button"
                            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === 'info'
                                    ? 'text-brand border-brand'
                                    : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/5'
                                }`}
                            onClick={() => setActiveTab('info')}
                        >
                            Node Info
                        </button>
                        <button
                            type="button"
                            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === 'code'
                                    ? 'text-brand border-brand'
                                    : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/5'
                                }`}
                            onClick={() => setActiveTab('code')}
                        >
                            Node Logic
                        </button>
                    </div>
                </header>

                <form onSubmit={onSave} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {activeTab === 'info' ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-4 gap-6">
                                    <div className="col-span-3 space-y-2">
                                        <label className="text-sm font-medium text-white/60 ml-1">Node Title</label>
                                        <input
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="e.g. Data Filter"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/60 ml-1">Version</label>
                                        <input
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all font-mono text-center"
                                            value={formData.version || ''}
                                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                            required
                                            placeholder="1.0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60 ml-1">Category</label>
                                    <input
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                                        value={formData.category || ''}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="e.g. Utility, Data, Logic"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60 ml-1">Description</label>
                                    <textarea
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all min-h-[140px] resize-none"
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Explain what this node does and what it expects as inputs..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex-1 rounded-xl bg-[#0d0d17] border border-white/10 overflow-hidden ring-1 ring-white/5 focus-within:ring-brand/50 focus-within:border-brand transition-all">
                                    <CodeMirror
                                        value={formData.code || ''}
                                        height="100%"
                                        theme="dark"
                                        extensions={codeMirrorExtensions}
                                        onChange={(value) => setFormData({ ...formData, code: value })}
                                        className="h-full text-sm font-mono"
                                        placeholder="# Write your node logic here..."
                                    />
                                </div>
                                <div className="mt-2 text-[11px] text-white/20 flex justify-between px-2">
                                    <span>Python 3.10+ supported</span>
                                    <span>Cmd+Space for autocompletion</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-8 py-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            className="px-6 py-2.5 rounded-xl text-white/50 hover:text-white transition-colors"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold shadow-lg shadow-brand/20 active:scale-[0.98] transition-all"
                        >
                            {editingNode ? 'Update Node' : 'Create Node'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

