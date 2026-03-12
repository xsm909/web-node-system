import React, { useState, useMemo } from 'react';
import { useAgentHints, useCreateAgentHint, useUpdateAgentHint, useDeleteAgentHint } from '../../../entities/agent-hint/api';
import type { AgentHint } from '../../../entities/agent-hint/api';
import { MarkdownEditor } from '../../../features/markdown-editor/MarkdownEditor';
import { Icon } from '../../../shared/ui/icon';
import { buildCategoryTree } from '../../../shared/lib/categoryUtils';
import type { CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import { getCookie, setCookie } from '../../../shared/lib/cookieUtils';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { marked } from 'marked';

export const AgentHintManagement: React.FC = () => {
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

    // Persistence for expanded categories
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie('hint_expanded_categories');
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie('hint_expanded_categories', JSON.stringify(Array.from(next)));
            return next;
        });
    };

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

    const hintTree = useMemo(() => {
        if (searchQuery.trim()) return null;
        return buildCategoryTree(hints);
    }, [hints, searchQuery]);

    if (isLoading) return <div className="p-8 text-gray-400">Loading agent hints...</div>;

    if (isEditing) {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)] border border-gray-700 rounded-2xl overflow-hidden bg-surface-800 shadow-xl shadow-black/20 animate-in zoom-in-95 duration-200">
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-6 flex-1 pr-12">
                    <h2 className="text-xl font-bold tracking-tight whitespace-nowrap">Agent Hints</h2>
                    <div className="relative flex-1 max-w-lg">
                        <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by key, category or content..."
                            className="w-full bg-surface-800 border border-gray-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition-all shadow-inner"
                        />
                    </div>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-transform active:scale-95"
                >
                    <Icon name="add" size={18} />
                    New Hint
                </button>
            </div>

            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 bg-surface-900/50">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Key</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {searchQuery.trim() ? (
                            filteredHints.map(hint => (
                                <HintRow key={hint.id} hint={hint} onEdit={handleEdit} onDelete={setIdToDelete} />
                            ))
                        ) : (
                            hintTree && (
                                <CategoryRows
                                    name="Uncategorized"
                                    node={hintTree}
                                    path=""
                                    level={-1}
                                    expandedCategories={expandedCategories}
                                    onToggle={toggleCategory}
                                    onEdit={handleEdit}
                                    onDelete={setIdToDelete}
                                />
                            )
                        )}
                        {filteredHints.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-gray-500 italic">
                                    No hints matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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

interface HintRowProps {
    hint: AgentHint;
    onEdit: (hint: AgentHint) => void;
    onDelete: (id: string) => void;
    level?: number;
}

const HintRow: React.FC<HintRowProps> = ({ hint, onEdit, onDelete, level = 0 }) => (
    <tr
        onClick={() => onEdit(hint)}
        className="group hover:bg-brand/5 transition-colors cursor-pointer"
    >
        <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
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
        </td>
        <td className="px-6 py-4">
            <span className="text-xs text-gray-500">
                {new Date(hint.updated_at).toLocaleString()}
            </span>
        </td>
        <td className="px-6 py-4 text-right">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(hint.id);
                }}
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 opacity-0 group-hover:opacity-100"
                title="Delete"
            >
                <Icon name="delete" size={16} />
            </button>
        </td>
    </tr>
);

interface CategoryRowsProps {
    name: string;
    node: CategoryTreeNode<AgentHint>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onEdit: (hint: AgentHint) => void;
    onDelete: (id: string) => void;
}

const CategoryRows: React.FC<CategoryRowsProps> = ({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onEdit,
    onDelete
}) => {
    const isRoot = name === "Uncategorized";
    const isExpanded = name === "Uncategorized" || expandedCategories.has(path);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <CategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childKey}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
                {node.nodes.length > 0 && (
                    <tr className="bg-surface-900/10 border-l-2 border-gray-700/30">
                        <td colSpan={3} className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                {node.nodes.map(hint => (
                    <HintRow
                        key={hint.id}
                        hint={hint}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        level={0}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-surface-900/30 hover:bg-surface-700/50 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td colSpan={3} className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'down' : 'play'}
                            size={14}
                            className="text-gray-500 opacity-60"
                        />
                        <Icon name="dev_hint" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{node.name}</span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <CategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childKey}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                    {node.nodes.map(hint => (
                        <HintRow
                            key={hint.id}
                            hint={hint}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            level={level + 1}
                        />
                    ))}
                </>
            )}
        </>
    );
};
