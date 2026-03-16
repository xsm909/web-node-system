import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import { AppTable } from '../../../shared/ui/app-table/AppTable';
import { Icon } from '../../../shared/ui/icon';
import type { ColumnDef } from '@tanstack/react-table';

interface Prompt {
    id: string;
    category: string;
    content: any;
    created_at: string;
    datatype: string;
    meta?: any;
}

interface PromptViewerProps {
    referenceId?: string;
}

const MinimalistPromptView: React.FC<{ content: any, meta?: any }> = ({ content, meta }) => {
    if (!content) return null;

    // Handle nested response_text which is common in agent history
    let effectiveContent = content;
    if (content.response_text && typeof content.response_text === 'string') {
        try {
            effectiveContent = JSON.parse(content.response_text);
        } catch (e) {
            console.warn('Failed to parse nested response_text:', e);
        }
    }

    const description = effectiveContent.description;
    const prompts = Array.isArray(effectiveContent.prompts) ? effectiveContent.prompts : [];

    return (
        <div className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar p-8 select-text text-[14px] leading-relaxed font-medium text-[var(--text-main)]">
            <div className="max-w-4xl space-y-6">
                {description && (
                    <div className="flex gap-2">
                        <span className="opacity-40 whitespace-nowrap">description:</span>
                        <span>{description}</span>
                    </div>
                )}
                
                {prompts.length > 0 && (
                    <div className="space-y-3">
                        <div className="opacity-40">prompts:</div>
                        <div className="space-y-2 pl-4">
                            {prompts.map((p: string, i: number) => (
                                <div key={i} className="flex gap-3">
                                    <span className="opacity-30 min-w-[20px]">{i + 1}.</span>
                                    <span>{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!description && prompts.length === 0 && (
                    <div className="space-y-2">
                        <div className="opacity-40 text-[11px] font-bold uppercase tracking-wider">Raw content:</div>
                        <pre className="p-4 bg-[var(--border-muted)]/10 rounded-xl font-mono text-[12px] opacity-70 border border-[var(--border-base)] overflow-x-auto">
                            {JSON.stringify(content, null, 2)}
                        </pre>
                    </div>
                )}

                {meta && (
                    <div className="pt-8 border-t border-[var(--border-base)]/50">
                        <div className="flex items-center gap-2 mb-4 opacity-40">
                            <Icon name="info" size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Technical Metadata</span>
                        </div>
                        <pre className="p-4 bg-[var(--border-muted)]/10 rounded-xl font-mono text-[11px] opacity-70 border border-[var(--border-base)] overflow-x-auto">
                            {JSON.stringify(meta, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export const PromptViewer: React.FC<PromptViewerProps> = ({ referenceId }) => {
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [isPromptsLoading, setIsPromptsLoading] = useState(false);
    
    useEffect(() => {
        if (!referenceId) return;

        setIsPromptsLoading(true);
        apiClient.get(`/prompts/?reference_id=${referenceId}`)
            .then(res => {
                const sorted = res.data.sort((a: Prompt, b: Prompt) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setPrompts(sorted);
                if (sorted.length > 0 && !selectedPrompt) {
                    setSelectedPrompt(sorted[0]);
                }
            })
            .catch(err => console.error('Failed to fetch prompts:', err))
            .finally(() => setIsPromptsLoading(false));
    }, [referenceId]);

    const columns = useMemo<ColumnDef<Prompt>[]>(() => [
        {
            accessorKey: 'content',
            header: 'Description',
            cell: ({ row }) => {
                const content = row.original.content;
                let description = content?.description;
                
                // Fallback for nested response_text
                if (!description && content?.response_text && typeof content.response_text === 'string') {
                    try {
                        const parsed = JSON.parse(content.response_text);
                        description = parsed.description;
                    } catch (e) {
                        // ignore
                    }
                }

                const finalDescription = description || row.original.datatype || 'No description';
                const date = new Date(row.original.created_at).toLocaleString();
                return (
                    <div className="flex flex-col py-1">
                        <span className="font-bold text-[13px] text-[var(--text-main)] truncate max-w-[200px]">
                            {finalDescription}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                            {date}
                        </span>
                    </div>
                );
            }
        }
    ], []);

    const tableConfig = useMemo(() => ({
        categoryExtractor: (p: Prompt) => p.category || 'Uncategorized',
        persistCategoryKey: 'prompt_viewer_categories',
        emptyMessage: 'No prompts found for this client.',
        getRowConfig: (p: Prompt) => ({
            icon: 'description',
            iconClassName: selectedPrompt?.id === p.id ? 'text-brand' : 'text-[var(--text-muted)] opacity-40',
        }),
        rowClassName: (p: Prompt) => selectedPrompt?.id === p.id 
            ? 'bg-brand/5 border-l-2 border-brand ring-1 ring-inset ring-brand/10' 
            : 'hover:bg-[var(--border-muted)]/30'
    }), [selectedPrompt]);

    return (
        <div className="flex-1 h-full min-h-0 flex w-full overflow-hidden transition-all">
            {/* Left Panel: List */}
            <div className="w-1/3 border-r border-[var(--border-base)] flex flex-col min-h-0 bg-surface-900/40">
                <div className="p-4 border-b border-[var(--border-base)] bg-surface-800/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20">
                            <Icon name="list" size={14} className="text-brand" />
                        </div>
                        <h3 className="text-sm font-bold tracking-tight uppercase opacity-80">Prompts List</h3>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <AppTable 
                        data={prompts}
                        columns={columns}
                        config={tableConfig}
                        isLoading={isPromptsLoading}
                        onRowClick={(p) => setSelectedPrompt(p)}
                    />
                </div>
            </div>

            {/* Right Panel: Content */}
            <div className="flex-1 h-full flex flex-col min-h-0 bg-surface-900/60 relative overflow-hidden">
                {selectedPrompt ? (
                    <>
                        <div className="p-4 border-b border-[var(--border-base)] bg-surface-900/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-surface-700 border border-[var(--border-base)]">
                                    <Icon name="code" size={16} className="text-[var(--text-muted)]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-main)]">
                                        {selectedPrompt.content?.description || 'Prompt Details'}
                                    </h3>
                                    <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-widest opacity-60">
                                        {selectedPrompt.category} • {selectedPrompt.datatype}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            <MinimalistPromptView content={selectedPrompt.content} meta={selectedPrompt.meta} />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-[var(--border-base)] flex items-center justify-center mb-6 opacity-20">
                            <Icon name="description" size={32} />
                        </div>
                        <h3 className="text-lg font-bold mb-2 opacity-60">No Prompt Selected</h3>
                        <p className="text-sm max-w-[240px] opacity-40 leading-relaxed font-medium">
                            Select a prompt from the list on the left to view its detailed JSON content.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
