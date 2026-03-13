import { useState, useMemo } from 'react';
import { useAgentHints, useCreateAgentHint, useUpdateAgentHint, useDeleteAgentHint } from '../../../entities/agent-hint/api';
import type { AgentHint } from '../../../entities/agent-hint/api';
import { MarkdownEditor } from '../../../features/markdown-editor/MarkdownEditor';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { AppHeader } from '../../../widgets/app-header';
import { createColumnHelper } from '@tanstack/react-table';
import { marked } from 'marked';

const columnHelper = createColumnHelper<AgentHint>();

interface AgentHintManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const AgentHintManagement = ({ onToggleSidebar, isSidebarOpen }: AgentHintManagementProps) => {

    const { data: hints = [], isLoading } = useAgentHints();
    const createMutation = useCreateAgentHint();
    const updateMutation = useUpdateAgentHint();
    const deleteMutation = useDeleteAgentHint();

    const [selectedHint, setSelectedHint] = useState<AgentHint | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPreview, setIsPreview] = useState(false);

    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    // Form State
    const [key, setKey] = useState('');
    const [category, setCategory] = useState('');
    const [hintContent, setHintContent] = useState('');

    const handleEdit = (hint: AgentHint) => {
        setSelectedHint(hint);
        setKey(hint.key);
        setCategory(hint.category || '');
        setHintContent(hint.hint);
        setIsEditing(true);
        setIsPreview(false);
    };

    const handleCreateNew = () => {
        setSelectedHint(null);
        setKey('');
        setCategory('');
        setHintContent('');
        setIsEditing(true);
        setIsPreview(false);
    };

    const handleSave = () => {
        const data = {
            key,
            hint: hintContent,
            category: category.trim() || null,
        };

        if (selectedHint) {
            updateMutation.mutate({ id: selectedHint.id, data }, {
                onSuccess: () => setIsEditing(false)
            });
        } else {
            createMutation.mutate(data, {
                onSuccess: () => setIsEditing(false)
            });
        }
    };

    const filteredHints = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return hints;

        return hints.filter(h => {
            const inKey = h.key.toLowerCase().includes(q);
            const inCategory = h.category?.toLowerCase().includes(q);
            const inHint = h.hint.toLowerCase().includes(q);
            return inKey || inCategory || inHint;
        });
    }, [hints, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            header: 'Key',
            cell: info => {
                const hint = info.row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                            <Icon name="description" size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                                {hint.key}
                            </span>
                        </div>
                    </div>
                );
            }
        }),
        columnHelper.accessor('updated_at', {
            header: 'Updated',
            cell: info => (
                <span className="text-xs text-gray-500">
                    {new Date(info.getValue()).toLocaleString()}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const hint = info.row.original;
                return (
                    <div className="flex justify-end">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIdToDelete(hint.id);
                            }}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 opacity-0 group-hover:opacity-100"
                            title="Delete"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                );
            }
        })
    ], []);

    if (isLoading) return <div className="p-8 text-gray-400">Loading agent hints...</div>;

    if (isEditing) {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)] border border-gray-700 rounded-2xl overflow-hidden bg-surface-800 shadow-xl shadow-black/20 animate-in zoom-in-95 duration-200 m-8">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-surface-900">
                    <div className="flex gap-4 items-center flex-1 pr-8">
                        <input
                            type="text"
                            placeholder="Hint Key (e.g., sql-optimization)"
                            value={key}
                            onChange={e => setKey(e.target.value)}
                            disabled={!!selectedHint}
                            className={`w-1/4 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand ${selectedHint ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <input
                            type="text"
                            placeholder="Category (e.g., SQL|Optimization)"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-1/4 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending || createMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-brand hover:brightness-110 transition-colors text-white text-sm font-bold flex items-center gap-2"
                        >
                            <Icon name="save" size={16} />
                            Save Hint
                        </button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col bg-[var(--bg-app)] min-h-0">
                    <div className="flex-1 overflow-hidden relative">
                        {isPreview ? (
                            <div className="absolute inset-0 p-8 overflow-auto bg-[var(--bg-app)]">
                                <div
                                    className="markdown-content text-[var(--text-main)]"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(hintContent) }}
                                />
                                {!hintContent && <span className="italic text-[var(--text-muted)]">No content to preview</span>}
                            </div>
                        ) : (
                            <div className="absolute inset-0">
                                <MarkdownEditor
                                    initialValue={hintContent}
                                    onChange={setHintContent}
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-center p-3 border-t border-gray-700 bg-surface-900 gap-4">
                        <div className="flex bg-surface-950 p-1 rounded-xl border border-gray-700">
                            <button
                                onClick={() => setIsPreview(false)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${!isPreview ? 'bg-brand text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Icon name="edit" size={14} />
                                Edit
                            </button>
                            <button
                                onClick={() => setIsPreview(true)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${isPreview ? 'bg-brand text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Icon name="visibility" size={14} />
                                Preview
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                        Agent Hints
                    </h1>
                }
                rightContent={
                    <button
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-brand text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 whitespace-nowrap"
                        onClick={handleCreateNew}
                    >
                        <Icon name="add" size={16} className="-ml-1" />
                        New Hint
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by key, category or content..."
            />

            <div className="flex-1 p-8 overflow-y-auto w-full max-w-7xl mx-auto">
                <AppTable
                    data={filteredHints}
                    columns={columns}
                    isSearching={searchQuery.trim().length > 0}
                    onRowClick={handleEdit}
                    config={{
                        categoryExtractor: h => h.category,
                        persistCategoryKey: 'hint_expanded_categories',
                        emptyMessage: 'No hints matching your criteria.'
                    }}
                />

                <ConfirmModal
                    isOpen={!!idToDelete}
                    title="Delete Agent Hint"
                    description="Are you sure you want to delete this agent hint? This action cannot be undone."
                    confirmLabel="Delete"
                    isLoading={deleteMutation.isPending}
                    onConfirm={() => {
                        if (idToDelete) {
                            deleteMutation.mutate(idToDelete, {
                                onSuccess: () => setIdToDelete(null)
                            });
                        }
                    }}
                    onCancel={() => setIdToDelete(null)}
                />
            </div>
        </div>
    );
};

