import { useState, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { getCookie, setCookie, eraseCookie } from '../../../shared/lib/cookieUtils';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { AppHeader } from '../../app-header';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<NodeType>();

interface AdminNodeLibraryProps {
    nodes: NodeType[];
    onEditNode: (node: NodeType) => void;
    onDuplicateNode: (node: NodeType) => void;
    onDelete: () => void;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const AdminNodeLibrary = ({ 
    nodes,
    onEditNode, 
    onDuplicateNode, 
    onDelete,
    onToggleSidebar,
    isSidebarOpen
}: AdminNodeLibraryProps) => {
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);
    const [searchQuery, setSearchQueryState] = useState(getCookie('admin_node_search') || '');

    const setSearchQuery = (query: string) => {
        if (query) {
            setCookie('admin_node_search', query);
        } else {
            eraseCookie('admin_node_search');
        }
        setSearchQueryState(query);
    };

    const filteredNodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return nodes;

        return nodes.filter(n => {
            const inName = n.name.toLowerCase().includes(q);
            const inCategory = n.category?.toLowerCase().includes(q);
            const inDesc = n.description?.toLowerCase().includes(q);
            return inName || inCategory || inDesc;
        });
    }, [nodes, searchQuery]);

    const handleConfirmDelete = async () => {
        if (nodeToDelete) {
            try {
                await apiClient.delete(`/admin/node-types/${nodeToDelete.id}`);
                setNodeToDelete(null);
                onDelete();
            } catch {
                alert('Failed to delete node type');
            }
        }
    };

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Node Type',
            cell: info => {
                const node = info.row.original;
                return (
                    <AppTableStandardCell
                        icon={node.icon || 'function'}
                        iconDir="node_icons"
                        label={node.name}
                        subtitle={node.description}
                        isLocked={node.is_locked}
                    />
                );
            }
        }),
        columnHelper.accessor('version', {
            header: 'Version',
            cell: info => (
                <span className="text-[10px] font-mono opacity-40 group-hover:opacity-100 transition-opacity">
                    v{info.getValue() || '1.0.0'}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const node = info.row.original;
                return (
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDuplicateNode(node); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Duplicate Node"
                        >
                            <Icon name="content_copy" size={16} />
                        </button>
                        {!node.is_locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setNodeToDelete(node); }}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Node"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}
                    </div>
                );
            }
        }),
    ], [onEditNode, onDuplicateNode, onDelete]);

    const handleRowClick = (node: NodeType) => {
        onEditNode(node);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                        Node Library
                    </h1>
                }
                rightContent={
                    <button
                        onClick={() => onEditNode({} as NodeType)}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        title="Add Node Type"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by name, category or description..."
            />

            <AppTable
                data={filteredNodes}
                columns={columns}
                onRowClick={handleRowClick}
                isSearching={searchQuery.trim().length > 0}
                config={{
                    categoryExtractor: n => n.category,
                    persistCategoryKey: 'admin_node_expanded_categories',
                    emptyMessage: 'No node types found.',
                    indentColumnId: 'name'
                }}
            />

            <ConfirmModal
                isOpen={!!nodeToDelete}
                title="Delete Node Type"
                description={`Are you sure you want to delete node type "${nodeToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={() => setNodeToDelete(null)}
            />
        </div>
    );
};
