import { useState } from 'react';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { AssignedUser } from '../../../entities/user/model/types';
import taskIcon from '../../../assets/task.svg';
import deleteIcon from '../../../assets/delete.svg';
import styles from './WorkflowTree.module.css';

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
    const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
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
        // Ensure section is expanded when creating a new workflow
        setExpandedOwners(prev => {
            const next = new Set(prev);
            next.add(ownerId);
            return next;
        });
    };

    const renderOwnerSection = (ownerId: string, label: string, icon: string) => {
        const workflows = workflowsByOwner[ownerId] || [];

        // Filtering logic
        const filteredWorkflows = searchQuery
            ? workflows.filter(wf => wf.name.toLowerCase().includes(searchQuery.toLowerCase()))
            : workflows;

        const isLabelMatch = label.toLowerCase().includes(searchQuery.toLowerCase());

        // Skip if searching and no match in either label OR workflows
        if (searchQuery && !isLabelMatch && filteredWorkflows.length === 0) {
            return null;
        }

        const isAdding = creatingFor === ownerId;
        // If searching and there's a match, force expanded
        const isExpanded = searchQuery ? true : expandedOwners.has(ownerId);

        return (
            <div key={ownerId} className={styles.section}>
                <div className={styles.userRow}>
                    <div className={styles.titleWrapper} onClick={() => !searchQuery && toggleExpand(ownerId)}>
                        <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''} ${searchQuery ? styles.searchActive : ''}`}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </span>
                        <h3 className={styles.userTitle}>
                            {icon} {label}
                        </h3>
                    </div>
                    <button
                        className={styles.addBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            setCreatingFor(isAdding ? null : ownerId);
                        }}
                        title="Add Workflow"
                    >
                        +
                    </button>
                </div>

                {isAdding && (
                    <div className={styles.inputContainer}>
                        <input
                            autoFocus
                            className={styles.createInput}
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

                {isExpanded && filteredWorkflows.map((wf) => (
                    <div
                        key={wf.id}
                        className={`${styles.workflowItem} ${activeWorkflowId === wf.id ? styles.activeWorkflow : ''}`}
                        onClick={() => onSelect(wf)}
                    >
                        <span className={styles.name}>
                            <img src={taskIcon} alt="" className={styles.wfIcon} />
                            {wf.name}
                        </span>
                        <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete(wf);
                            }}
                            aria-label="Delete"
                        >
                            <img src={deleteIcon} alt="Delete" />
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.tree}>
            <div className={styles.searchContainer}>
                <div className={styles.searchIcon}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search workflows or clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>×</button>
                )}
            </div>

            <div className={styles.treeContent}>
                {renderOwnerSection('personal', 'Personal', '⭐')}
                <div className={styles.divider} />
                {users.map((u) => renderOwnerSection(u.id, u.username, '👤'))}
            </div>
        </div>
    );
}
