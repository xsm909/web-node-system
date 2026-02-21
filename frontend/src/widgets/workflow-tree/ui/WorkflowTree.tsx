import { useState } from 'react';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { AssignedUser } from '../../../entities/user/model/types';


interface WorkflowTreeProps {
    users: AssignedUser[];
    workflowsByOwner: Record<string, Workflow[]>;
    activeWorkflowId?: string;
    onSelect: (wf: Workflow) => void;
    onDelete: (wf: Workflow) => void;
    onCreate: (name: string, ownerId: string) => Promise<void>;
    isCreating?: boolean;
}

export function WorkflowTree({
    users,
    workflowsByOwner,
    activeWorkflowId,
    onSelect,
    onDelete,
    onCreate,
    isCreating
}: WorkflowTreeProps) {
    const [creatingFor, setCreatingFor] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set(['personal']));
    const [searchQuery, setSearchQuery] = useState('');

    const toggleExpand = (ownerId: string) => {
        setExpandedOwners(prev => {
            const next = new Set(prev);
            if (next.has(ownerId)) {
                next.delete(ownerId);
            } else {
                next.add(ownerId);
            }
            return next;
        });
    };

    const handleCreate = async (ownerId: string) => {
        if (!newName || isCreating) return;
        await onCreate(newName, ownerId);
        setNewName('');
        setCreatingFor(null);
        setExpandedOwners(prev => {
            const next = new Set(prev);
            next.add(ownerId);
            return next;
        });
    };

    const renderOwnerSection = (ownerId: string, label: string, icon: string) => {
        const workflows = workflowsByOwner[ownerId] || [];
        const filteredWorkflows = searchQuery
            ? workflows.filter(wf => wf.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : workflows;

        const isLabelMatch = label.toLowerCase().includes(searchQuery.toLowerCase());
        if (searchQuery && !isLabelMatch && filteredWorkflows.length === 0) return null;

        const isAdding = creatingFor === ownerId;
        const isExpanded = searchQuery ? true : expandedOwners.has(ownerId);

        return (
            <div key={ownerId} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between group/row px-2 py-1.5 rounded-lg hover:bg-[var(--border-muted)] transition-colors cursor-pointer" onClick={() => !searchQuery && toggleExpand(ownerId)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${searchQuery ? 'opacity-0' : 'opacity-40 group-hover/row:opacity-100'}`}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </span>
                        <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5 truncate group-hover/row:text-[var(--text-main)] transition-colors">
                            <span className="text-sm opacity-60 grayscale">{icon}</span> {label}
                        </h3>
                    </div>
                    <button
                        className="opacity-0 group-hover/row:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-brand transition-all font-bold text-lg leading-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            setCreatingFor(isAdding ? null : ownerId);
                        }}
                    >
                        +
                    </button>
                </div>

                {isAdding && (
                    <div className="mt-1 px-6 pb-2">
                        <input
                            autoFocus
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all"
                            placeholder="Workflow name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate(ownerId);
                                if (e.key === 'Escape') setCreatingFor(null);
                            }}
                            onBlur={() => !newName && setCreatingFor(null)}
                        />
                    </div>
                )}

                {isExpanded && (
                    <div className="mt-1 space-y-0.5">
                        {filteredWorkflows.map((wf) => (
                            <div
                                key={wf.id}
                                className={`
                                    group flex items-center justify-between px-3 py-2 ml-6 rounded-lg cursor-pointer transition-all
                                    ${activeWorkflowId === wf.id
                                        ? 'bg-brand/10 text-brand font-semibold'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                                    }
                                `}
                                onClick={() => onSelect(wf)}
                            >
                                <span className="flex items-center gap-2 text-xs truncate">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 opacity-40 group-hover:opacity-100 transition-opacity ${activeWorkflowId === wf.id ? 'opacity-100 text-brand' : ''}`}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg>
                                    {wf.name}
                                </span>
                                <button
                                    type="button"
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-red-500 transition-all active:scale-90"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDelete(wf);
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full max-h-[60vh] w-full overflow-hidden bg-[var(--bg-sidebar)]">
            <div className="relative p-2 border-b border-[var(--border-base)]">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-50">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <input
                    type="text"
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all font-medium"
                    placeholder="Quick find..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors text-lg"
                        onClick={() => setSearchQuery('')}
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div className="space-y-1">
                    {renderOwnerSection('personal', 'My Workflows', '⭐')}
                    <div className="h-4" />
                    <div className="px-2 py-1 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] opacity-40">Client Workspaces</div>
                    {users.map((u) => renderOwnerSection(u.id, u.username, '👤'))}
                </div>
            </div>
        </div>
    );
}


