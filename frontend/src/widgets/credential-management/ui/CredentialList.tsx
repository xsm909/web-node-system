import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { Icon } from '../../../shared/ui/icon';
import { usePinnedNavigation } from '../../../features/pinned-tabs/lib/usePinnedCheck';
import type { Credential } from '../../../entities/credential/model/types';

const columnHelper = createColumnHelper<Credential>();

interface CredentialListProps {
    credentials: Credential[];
    searchQuery: string;
    onEdit: (cred: Credential) => void;
    onDelete: (cred: Credential) => void;
}

export const CredentialList = ({ credentials, searchQuery, onEdit, onDelete }: CredentialListProps) => {
    const { openOrFocus } = usePinnedNavigation();

    const filteredCredentials = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return credentials;
        return credentials.filter(c => 
            c.key.toLowerCase().includes(q) || 
            (c.type || '').toLowerCase().includes(q) || 
            (c.description || '').toLowerCase().includes(q)
        );
    }, [credentials, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            id: 'key',
            header: 'Identification Key',
            cell: info => {
                const cred = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="verified"
                        label={cred.key}
                        subtitle={cred.description}
                        isLocked={cred.is_locked}
                        isMono={true}
                    />
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="px-2 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {info.getValue()}
                </span>
            ),
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const cred = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(cred); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Edit Credential"
                        >
                            <Icon name="edit" size={16} />
                        </button>
                        {(!cred.is_locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(cred); }}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Credential"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )) || (
                            <div className="p-1.5">
                                <Icon name="lock" size={16} className="text-amber-500/50" />
                            </div>
                        )}
                    </div>
                );
            },
        }),
    ], [onEdit, onDelete]);

    return (
        <AppTable
            data={filteredCredentials}
            columns={columns}
            isSearching={searchQuery.trim().length > 0}
            onRowClick={(cred) => openOrFocus('credentials', cred.id, () => onEdit(cred))}
            config={{
                categoryExtractor: c => c.type,
                persistCategoryKey: 'credential_expanded_categories',
                emptyMessage: 'No secure credentials detected.',
                indentColumnId: 'key'
            }}
        />
    );
};
