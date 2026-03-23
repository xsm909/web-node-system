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
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { AppLockToggle } from '../../../shared/ui/app-lock-toggle';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

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
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [metadataActions, setMetadataActions] = useState<React.ReactNode>(null);
    const editorRef = useRef<UserEditorRef>(null);

    const { data: users = [], isLoading, refetch } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await apiClient.get<User[]>('/admin/users');
            return response.data;
        },
    });

    const columns = useMemo(() => [
        columnHelper.accessor('username', {
            header: 'Username',
            cell: info => {
                const user = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="person"
                        label={user.username}
                        isLocked={user.is_locked}
                    />
                );
            },
        }),
        columnHelper.accessor('role', {
            header: 'Role',
            cell: info => {
                const role = info.getValue();
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tracking-widest ring-1 ring-inset bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20 uppercase`}>
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
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const user = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {!user.is_locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setDeletingUser(user); }}
                                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete User"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}
                    </div>
                );
            },
        }),
    ], [refetch]);

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

    const handleConfirmDelete = async () => {
        if (!deletingUser) return;
        try {
            await apiClient.delete(`/admin/users/${deletingUser.id}`);
            refetch();
        } catch (error) {
            console.error('Failed to delete user:', error);
        } finally {
            setDeletingUser(null);
        }
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
                tabs={[
                    { id: 'common', label: 'Common Profile' },
                    { id: 'metadata', label: 'Metadata' },
                    ...(selectedUser.role === 'client' ? [{ id: 'prompts', label: 'Prompt Viewer' }] : [])
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'common' | 'metadata' | 'prompts')}
                saveLabel="Save User"
                headerRightContent={
                    <div className="flex items-center gap-2">
                        {activeTab === 'metadata' && metadataActions}
                        <AppLockToggle 
                            entityId={selectedUser.id} 
                            entityType="users" 
                            initialLocked={selectedUser.is_locked}
                            onToggle={(locked) => {
                                setSelectedUser({ ...selectedUser, is_locked: locked });
                                refetch();
                            }}
                        />
                    </div>
                }
                noPadding={activeTab === 'prompts' || activeTab === 'metadata'}
                fullHeight={activeTab === 'prompts' || activeTab === 'metadata'}
            >
                <div className={(activeTab === 'prompts' || activeTab === 'metadata') ? 'flex-1 h-full min-h-0 w-full flex flex-col' : 'max-w-5xl mx-auto w-full'}>
                    <UserEditor
                        ref={editorRef}
                        user={selectedUser}
                        onSaveSuccess={handleBack}
                        activeTab={activeTab}
                        onDirtyChange={setIsFormDirty}
                        isLocked={selectedUser.is_locked}
                        onHeaderActionsChange={setMetadataActions}
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
                    <AppRoundButton
                        onClick={() => {
                            setSelectedUser(null);
                            setView('edit');
                            setActiveTab('common');
                        }}
                        icon="add"
                        variant="brand"
                        title="Add User"
                    />
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
                    emptyMessage: 'No users found.',
                    indentColumnId: 'username'
                }}
            />

            <ConfirmModal
                isOpen={!!deletingUser}
                title="Delete User"
                description={`Are you sure you want to delete user "${deletingUser?.username}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeletingUser(null)}
            />
        </div>
    );
};


