import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { AppHeader } from '../../app-header';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { UserEditor, type UserEditorRef } from './UserEditor';
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
    const [activeTab, setActiveTab] = useState<'common' | 'metadata' | 'prompts'>('common');
    const [isFormDirty, setIsFormDirty] = useState(false);
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
            cell: info => <span className="text-[var(--text-main)]">{info.getValue()}</span>,
        }),
        columnHelper.accessor('role', {
            header: 'Role',
            cell: info => {
                const role = info.getValue();
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tracking-widest ring-1 ring-inset bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20`}>
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
                        <span className="text-[10px] uppercase tracking-widest opacity-30 italic">Unassigned</span>
                    )
                ) : (
                    <span className="text-[10px] uppercase tracking-widest opacity-10">—</span>
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

    const isSaving = editorRef.current?.isSaving || false;

    if (view === 'edit') {
        if (!selectedUser) {
            return (
                <AppFormView
                    title="Add User"
                    parentTitle="User Management"
                    icon="person"
                    isDirty={isFormDirty}
                    isSaving={isSaving}
                    onSave={() => {}}
                    onCancel={handleBack}
                >
                    <div className="p-8 text-center text-[var(--text-muted)] opacity-50">User creation not implemented via Editor.</div>
                </AppFormView>
            );
        }

        return (
            <AppFormView
                title={selectedUser.username}
                parentTitle="User Management"
                icon="person"
                isDirty={isFormDirty}
                isSaving={isSaving}
                onSave={() => editorRef.current?.handleSave()}
                onCancel={handleBack}
                tabs={selectedUser.role === 'client' ? [
                    { id: 'common', label: 'Common Profile' },
                    { id: 'metadata', label: 'Client Metadata' },
                    { id: 'prompts', label: 'Prompt Viewer' }
                ] : [
                    { id: 'common', label: 'Common Profile' }
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'common' | 'metadata')}
                saveLabel="Save User"
            >
                <div className="max-w-5xl mx-auto w-full">
                    <UserEditor
                        ref={editorRef}
                        user={selectedUser}
                        onSaveSuccess={handleBack}
                        activeTab={activeTab}
                        onDirtyChange={setIsFormDirty}
                    />
                </div>
            </AppFormView>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 px-2 lg:px-0">
                            User Management
                        </h1>
                    </div>
                }
                rightContent={
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
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by username, role or ID..."
            />

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
        </div>
    );
};


