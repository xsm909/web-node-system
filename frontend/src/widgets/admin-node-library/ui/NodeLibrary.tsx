import { useState, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { Icon } from '../../../shared/ui/icon';
import { getCookie, setCookie, eraseCookie } from '../../../shared/lib/cookieUtils';
import { AppTable } from '../../../shared/ui/app-table';
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
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);
    const [searchQuery, setSearchQueryState] = useState(getCookie('admin_node_search') || '');

    // ... search logic ...

    const setSearchQuery = (query: string) => {
        if (query) {
            setCookie('admin_node_search', query);
        } else {
            eraseCookie('admin_node_search');
        }
        setSearchQueryState(query);
    };

    // Data is now passed from parent

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
                setSelectedNodeId(null);
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
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                            <Icon name={node.icon || 'extension'} size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                                    {node.name}
                                </span>
                                {node.is_locked && (
                                    <Icon name="lock" size={12} className="text-amber-500/60" />
                                )}
                            </div>
                        </div>
                    </div>
                );
            }
        }),
        columnHelper.accessor('version', {
            header: 'Version',
            cell: info => (
                <span className="text-xs font-mono text-brand/70">v{info.getValue()}</span>
            )
        }),
        columnHelper.accessor('description', {
            header: 'Description',
            cell: info => (
                <span className="text-sm text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity line-clamp-1 max-w-md">
                    {info.getValue() || <span className="italic opacity-30">No description</span>}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right px-4">Actions</div>,
            cell: info => {
                const node = info.row.original;
                return (
                    <div className="flex gap-1 justify-end px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateNode(node);
                            }}
                            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400"
                            title="Duplicate"
                        >
                            <Icon name="content_copy" size={16} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setNodeToDelete(node);
                            }}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                            title="Delete"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                );
            }
        })
    ], [onDuplicateNode]);

    // loading state can be handled based on whether nodes are empty
    // but usually they load once on AdminPage mount

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
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        onClick={() => onEditNode(undefined as any)}
                        title="Add Node"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search nodes..."
            />
            
            <AppTable
                data={filteredNodes}
                columns={columns}
                config={{
                    categoryExtractor: n => n.category,
                    persistCategoryKey: 'node_expanded_categories',
                    emptyMessage: 'No nodes matching your criteria.',
                    rowClassName: (node) => selectedNodeId === node.id ? 'bg-brand/5' : ''
                }}
                onRowClick={(node) => {
                    setSelectedNodeId(node.id);
                    onEditNode(node);
                }}
                isSearching={searchQuery.trim().length > 0}
            />

            <ConfirmModal
                isOpen={!!nodeToDelete}
                title="Delete Node"
                description={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={() => setNodeToDelete(null)}
            />
        </div>
    );
};


