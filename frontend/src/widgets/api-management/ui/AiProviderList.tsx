import { useMemo } from 'react';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { createColumnHelper } from '@tanstack/react-table';
import type { AiProvider } from '../../../entities/ai-provider/model/types';
import { Icon } from '../../../shared/ui/icon';

const columnHelper = createColumnHelper<AiProvider>();

interface AiProviderListProps {
    providers: AiProvider[];
    searchQuery: string;
    onEdit: (provider: AiProvider) => void;
    onDelete: (provider: AiProvider) => void;
}

export function AiProviderList({ providers, searchQuery, onEdit, onDelete }: AiProviderListProps) {
    const filteredProviders = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return providers;
        return providers.filter(p => 
            p.key.toLowerCase().includes(q) || 
            (p.description || '').toLowerCase().includes(q)
        );
    }, [providers, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            id: 'key',
            header: 'Provider Key',
            cell: info => {
                const p = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="provider"
                        label={p.key}
                        subtitle={p.description}
                        isMono={true}
                    />
                );
            },
        }),
        columnHelper.accessor('api_key', {
            header: 'API Key Configured',
            cell: info => {
                const val = info.getValue();
                return val ? (
                    <span className="text-[var(--text-main)]"><Icon name="check" size={14} className="inline mr-1 text-green-500" />Yes</span>
                ) : (
                    <span className="text-[var(--text-muted)]"><Icon name="close" size={14} className="inline mr-1 text-red-500/50" />No</span>
                );
            },
        }),
        columnHelper.accessor('models', {
            header: 'Models',
            cell: info => {
                const modelsRaw = info.getValue();
                const count = (modelsRaw && typeof modelsRaw === 'object' && Array.isArray(modelsRaw.models)) 
                    ? modelsRaw.models.length 
                    : 0;
                return (
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-bold text-brand">
                            {count} {count === 1 ? 'Model' : 'Models'}
                        </span>
                    </div>
                );
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const p = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Edit Provider"
                        >
                            <Icon name="edit" size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Provider"
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
            data={filteredProviders}
            columns={columns}
            isSearching={searchQuery.trim().length > 0}
            onRowClick={onEdit}
            config={{
                emptyMessage: 'No AI Providers configured yet.',
                indentColumnId: 'key'
            }}
        />
    );
}
