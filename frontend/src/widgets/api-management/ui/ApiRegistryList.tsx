import { useMemo } from 'react';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { createColumnHelper } from '@tanstack/react-table';
import type { ApiRegistry } from '../../../entities/api-registry/model/types';
import { Icon } from '../../../shared/ui/icon';
import { usePinnedNavigation } from '../../../features/pinned-tabs/lib/usePinnedCheck';

const columnHelper = createColumnHelper<ApiRegistry>();

interface ApiRegistryListProps {
    apis: ApiRegistry[];
    searchQuery: string;
    onEdit: (api: ApiRegistry) => void;
    onDelete: (api: ApiRegistry) => void;
}

export function ApiRegistryList({ apis, searchQuery, onEdit, onDelete }: ApiRegistryListProps) {
    const { openOrFocus } = usePinnedNavigation();
    
    const filteredApis = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return apis;
        return apis.filter(a => 
            a.name.toLowerCase().includes(q) || 
            (a.description || '').toLowerCase().includes(q) ||
            a.base_url.toLowerCase().includes(q)
        );
    }, [apis, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            id: 'name',
            header: 'API Name',
            cell: info => {
                const a = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="api"
                        label={a.name}
                        subtitle={a.base_url}
                        isMono={true}
                    />
                );
            },
        }),
        columnHelper.accessor('credential_key', {
            header: 'Credentials',
            cell: info => {
                const val = info.getValue();
                return val ? (
                    <span className="text-[var(--text-main)] flex items-center gap-1">
                        <Icon name="verified" size={14} className="text-brand" />
                        {val}
                    </span>
                ) : (
                    <span className="text-[var(--text-muted)] flex items-center gap-1">
                        <Icon name="close" size={14} className="text-red-500/50" />
                        None
                    </span>
                );
            },
        }),
        columnHelper.accessor('functions', {
            header: 'Functions',
            cell: info => {
                const count = info.getValue()?.length || 0;
                return (
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-bold text-brand">
                            {count} {count === 1 ? 'Function' : 'Functions'}
                        </span>
                    </div>
                );
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const a = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(a); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Edit API"
                        >
                            <Icon name="edit" size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(a); }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete API"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                );
            },
        }),
    ], [onEdit, onDelete]);

    return (
        <AppTable
            data={filteredApis}
            columns={columns}
            isSearching={searchQuery.trim().length > 0}
            onRowClick={(a) => openOrFocus('api_registry', a.id, () => onEdit(a))}
            config={{
                emptyMessage: 'No External APIs configured yet.',
                indentColumnId: 'name'
            }}
        />
    );
}
