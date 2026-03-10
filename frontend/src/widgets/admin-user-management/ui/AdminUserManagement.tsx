import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { UserEditor, type UserEditorRef } from './UserEditor';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon';

const columnHelper = createColumnHelper<User>();

interface AdminUserManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onToggleSidebar, isSidebarOpen }) => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [activeTab, setActiveTab] = useState<'common' | 'metadata'>('common');
    const editorRef = useRef<UserEditorRef>(null);

    const { data: users = [], isLoading, refetch } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await apiClient.get<User[]>('/admin/users');
            return response.data;
        },
    });

    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: 'ID',
            cell: info => (
                <span className="font-mono text-[var(--text-muted)] opacity-40 group-hover:opacity-60 transition-opacity">
                    {info.getValue().slice(0, 8)}...
                </span>
            ),
        }),
        columnHelper.accessor('username', {
            header: 'Username',
            cell: info => <span className="font-bold text-[var(--text-main)]">{info.getValue()}</span>,
        }),
        columnHelper.accessor('role', {
            header: 'Role',
            cell: info => {
                const role = info.getValue();
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${role === 'admin'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'
                        : role === 'manager'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                        }`}>
                        {role}
                    </span>
                );
            },
        }),
        columnHelper.display({
            id: 'assignedManager',
            header: 'Assigned Manager',
            cell: info => {
                const user = info.row.original;
                return user.role === 'client' ? (
                    user.assigned_managers?.[0]?.username || (
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-30 italic">Unassigned</span>
                    )
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-10">—</span>
                );
            },
        }),
    ], []);

    const table = useReactTable({
        data: users,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (user: User) => {
        setSelectedUser(user);
        setView('edit');
        setActiveTab('common');
    };

    const handleBack = () => {
        setView('list');
        setSelectedUser(null);
        setActiveTab('common');
        refetch();
    };

    const isSaving = editorRef.current?.isSaving;

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex items-center gap-3">
                        {view !== 'list' && (
                            <button
                                onClick={handleBack}
                                className="p-2 -ml-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-colors"
                            >
                                <Icon name="back" size={24} />
                            </button>
                        )}
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 px-2 lg:px-0">
                            {view === 'list' ? 'User Management' : (
                                <span><span className="opacity-40 font-normal">User / </span>{selectedUser?.username}</span>
                            )}
                        </h1>
                    </div>
                }
                rightContent={
                    view === 'edit' && (
                        <div className="flex items-center gap-4">
                            <div className="flex bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-base)] shadow-sm">
                                <button
                                    onClick={() => setActiveTab('common')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'common' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                >
                                    Common
                                </button>
                                <button
                                    onClick={() => setActiveTab('metadata')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'metadata' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                >
                                    Client Metadata
                                </button>
                            </div>
                            <button
                                onClick={() => editorRef.current?.handleSave()}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-8 py-2.5 rounded-2xl bg-brand text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-xl shadow-brand/20 active:scale-95 whitespace-nowrap"
                            >
                                <Icon name={isSaving ? "sync" : "save"} size={16} className={isSaving ? "animate-spin" : ""} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    )
                }
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-7xl mx-auto h-full">
                    {isLoading && users.length === 0 ? (
                        <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl">
                            <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
                        </div>
                    ) : view === 'list' ? (
                        <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in duration-500">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        {table.getHeaderGroups().map(headerGroup => (
                                            <tr key={headerGroup.id} className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                                {headerGroup.headers.map(header => (
                                                    <th key={header.id} className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-base)]">
                                        {table.getRowModel().rows.map(row => (
                                            <tr
                                                key={row.id}
                                                className="hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer"
                                                onClick={() => handleRowClick(row.original)}
                                            >
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-6 py-4 text-sm">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {users.length === 0 && (
                                <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium">
                                    No users detected in the system.
                                </div>
                            )}
                        </div>
                    ) : (
                        selectedUser && (
                            <UserEditor
                                ref={editorRef}
                                user={selectedUser}
                                onSaveSuccess={handleBack}
                                activeTab={activeTab}
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
};


