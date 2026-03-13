import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { UserEditor, type UserEditorRef } from './UserEditor';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon';
import { AppTable } from '../../../shared/ui/app-table';

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

    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return users;
        return users.filter(u => 
            u.username.toLowerCase().includes(q) || 
            u.role.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

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
                    view === 'list' ? (
                        <button
                            onClick={() => {
                                setSelectedUser(null);
                                setView('edit');
                                setActiveTab('common');
                            }}
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                            title="Add User"
                        >
                            <Icon name="add" size={20} />
                        </button>
                    ) : (
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
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by username, role or ID..."
            />

            {view === 'list' ? (
                <AppTable
                    data={filteredUsers}
                    columns={columns}
                    isLoading={isLoading && users.length === 0}
                    onRowClick={handleRowClick}
                    isSearching={searchQuery.trim().length > 0}
                    config={{
                        emptyMessage: 'No users found.'
                    }}
                />
            ) : (
                selectedUser && (
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                        <UserEditor
                            ref={editorRef}
                            user={selectedUser}
                            onSaveSuccess={handleBack}
                            activeTab={activeTab}
                        />
                    </div>
                )
            )}
        </div>
    );
};


