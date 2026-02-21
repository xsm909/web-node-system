import React, { useState, useRef, useEffect } from 'react';
import { WorkflowTree } from '../../workflow-tree';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { AssignedUser } from '../../../entities/user/model/types';

interface WorkflowHeaderProps {
    title: string;
    activeWorkflowId?: string;
    users: AssignedUser[];
    workflowsByOwner: Record<string, Workflow[]>;
    isRunning: boolean;
    isSidebarOpen: boolean;
    onSelect: (wf: Workflow) => void;
    onDelete: (wf: Workflow) => void;
    onCreate: (name: string, ownerId: string) => Promise<void>;
    onSave: () => void;
    onRun: () => void;
    onToggleSidebar: () => void;
    canAction: boolean;
    isCreating?: boolean;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
    title,
    activeWorkflowId,
    users,
    workflowsByOwner,
    isRunning,
    isSidebarOpen,
    onSelect,
    onDelete,
    onCreate,
    onSave,
    onRun,
    onToggleSidebar,
    canAction,
    isCreating,
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const handleSelect = (wf: Workflow) => {
        onSelect(wf);
        setIsDropdownOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-surface-900/80 backdrop-blur-md border-b border-white/5 h-16">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <button
                    className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 lg:hidden transition-colors"
                    onClick={onToggleSidebar}
                    aria-label="Toggle menu"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isSidebarOpen ? (
                            <path d="M18 6L6 18M6 6l12 12" />
                        ) : (
                            <path d="M3 12h18M3 6h18M3 18h18" />
                        )}
                    </svg>
                </button>

                <div className="relative flex-1 max-w-xl" ref={dropdownRef}>
                    <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all max-w-full ${isDropdownOpen ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5 hover:text-white'
                            }`}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <h1 className="text-sm font-semibold truncate tracking-tight">{title}</h1>
                        <svg
                            viewBox="0 0 24 24"
                            width="14" height="14"
                            fill="none" stroke="currentColor" strokeWidth="3"
                            strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-3 w-80 bg-surface-800 border border-white/10 rounded-2xl shadow-2xl p-2 ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-200">
                            <WorkflowTree
                                users={users}
                                workflowsByOwner={workflowsByOwner}
                                activeWorkflowId={activeWorkflowId}
                                onSelect={handleSelect}
                                onDelete={onDelete}
                                onCreate={onCreate}
                                isCreating={isCreating}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                    onClick={onSave}
                    disabled={!canAction}
                    title="Save Workflow"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-active:scale-95 transition-transform">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                </button>
                <button
                    className={`
                        h-9 px-5 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed
                        ${isRunning
                            ? 'bg-brand/10 text-brand ring-1 ring-inset ring-brand/30 cursor-default'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                        }
                    `}
                    onClick={onRun}
                    disabled={!canAction || isRunning}
                >
                    {isRunning ? (
                        <>
                            <svg className="animate-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            <span>Running...</span>
                        </>
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <span>Run</span>
                        </>
                    )}
                </button>
            </div>
        </header>
    );
};

