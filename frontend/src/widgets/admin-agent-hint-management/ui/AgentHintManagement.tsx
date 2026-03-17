import { useState, useMemo } from 'react';
import { useAgentHints, useCreateAgentHint, useUpdateAgentHint, useDeleteAgentHint } from '../../../entities/agent-hint/api';
import type { AgentHint } from '../../../entities/agent-hint/api';
import { MarkdownEditor } from '../../../features/markdown-editor/MarkdownEditor';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { AppHeader } from '../../../widgets/app-header';
import { AppFormView } from '../../../shared/ui/app-form-view';
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
    const [initialFormState, setInitialFormState] = useState({ key: '', category: '', hintContent: '' });

    const handleEdit = (hint: AgentHint) => {
        setSelectedHint(hint);
        const data = {
            key: hint.key,
            category: hint.category || '',
            hintContent: hint.hint
        };
        setKey(data.key);
        setCategory(data.category);
        setHintContent(data.hintContent);
        setInitialFormState(data);
        setIsEditing(true);
        setIsPreview(false);
    };

    const handleCreateNew = () => {
        setSelectedHint(null);
        const data = {
            key: '',
            category: '',
            hintContent: ''
        };
        setKey(data.key);
        setCategory(data.category);
        setHintContent(data.hintContent);
        setInitialFormState(data);
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
                onSuccess: (savedHint) => {
                    setInitialFormState({
                        key: savedHint.key,
                        category: savedHint.category || '',
                        hintContent: savedHint.hint
                    });
                }
            });
        } else {
            createMutation.mutate(data, {
                onSuccess: (savedHint) => {
                    setSelectedHint(savedHint);
                    setInitialFormState({
                        key: savedHint.key,
                        category: savedHint.category || '',
                        hintContent: savedHint.hint
                    });
                }
            });
        }
    };

    const isDirty = key !== initialFormState.key ||
                    category !== initialFormState.category ||
                    hintContent !== initialFormState.hintContent;

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
                            <span className="text-sm text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
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
            <AppFormView
                title={selectedHint ? selectedHint.key : (key ? `${key} (New)` : 'New Agent Hint')}
                parentTitle="Agent Hints"
                icon="description"
                isDirty={isDirty}
                isSaving={updateMutation.isPending || createMutation.isPending}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                saveLabel={selectedHint ? "Save Hint" : "Create Hint"}
                tabs={[
                    { id: 'edit', label: 'Editor' },
                    { id: 'preview', label: 'Preview' }
                ]}
                activeTab={isPreview ? 'preview' : 'edit'}
                onTabChange={(id) => setIsPreview(id === 'preview')}
            >
                <div className="flex flex-col gap-6 max-w-5xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500 p-2">
                    <div className="grid grid-cols-2 gap-8 mb-2">
                        <div className="space-y-3">
                            <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Hint Key</label>
                            <input
                                type="text"
                                placeholder="Hint Key (e.g., sql-optimization)"
                                value={key}
                                onChange={e => setKey(e.target.value)}
                                disabled={!!selectedHint}
                                className={`w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold text-lg ${selectedHint ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-black text-[var(--text-main)] opacity-60 uppercase tracking-widest ml-1">Category</label>
                            <input
                                type="text"
                                placeholder="e.g., SQL|Optimization"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full px-5 py-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold text-lg"
                            />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[400px] relative rounded-xl border border-[var(--border-base)] overflow-hidden bg-[var(--bg-app)] shadow-inner ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all">
                        {isPreview ? (
                            <div className="absolute inset-0 p-8 overflow-auto bg-[var(--bg-app)] custom-scrollbar">
                                <div
                                    className="markdown-content text-[var(--text-main)]"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(hintContent) as string }}
                                />
                                {!hintContent && <span className="italic text-[var(--text-muted)] opacity-50">No content to preview</span>}
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
                </div>
            </AppFormView>
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
                        onClick={handleCreateNew}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        title="New Hint"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by key, category or content..."
            />

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
    );
};

