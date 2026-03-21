import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionGroup } from '../../../shared/ui/selection-list';
import { ClientMetadataManagement } from '../../client-metadata-management/ui/ClientMetadataManagement';
import { PromptViewer } from '../../prompt-viewer/ui/PromptViewer';
import { AppInput, AppFormBox } from "../../../shared/ui/app-input";
import { FormField } from '../../../shared/ui/form-field';


interface UserEditorProps {
    user: User;
    onSaveSuccess?: () => void;
    activeTab?: 'common' | 'metadata' | 'prompts';
    onDirtyChange?: (isDirty: boolean) => void;
    isLocked?: boolean;
}

export interface UserEditorRef {
    handleSave: () => void;
    isSaving: boolean;
}

export const UserEditor = forwardRef<UserEditorRef, UserEditorProps>(({ user, onSaveSuccess, activeTab = 'common', onDirtyChange, isLocked }, ref) => {
    const queryClient = useQueryClient();
    const [selectedManagerId, setSelectedManagerId] = useState<string>('');

    const { data: managers = [] } = useQuery({
        queryKey: ['admin-managers'],
        queryFn: async () => {
            const response = await apiClient.get<User[]>('/admin/managers');
            return response.data;
        },
        enabled: user?.role === 'client',
    });

    useEffect(() => {
        if (user?.role === 'client') {
            const currentManager = user.assigned_managers?.[0];
            setSelectedManagerId(currentManager?.id || '');
        }
    }, [user]);

    const isDirty = useMemo(() => {
        if (user?.role !== 'client') return false;
        const currentManagerId = user.assigned_managers?.[0]?.id || '';
        return selectedManagerId !== currentManagerId;
    }, [user, selectedManagerId]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const managersData: Record<string, SelectionGroup> = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};
        managers.forEach(m => {
            data[m.username] = {
                id: m.id,
                name: m.username,
                selectable: true,
                icon: 'person',
                items: [],
                children: {}
            };
        });
        return data;
    }, [managers]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!user) return;
            const currentManagerId = user.assigned_managers?.[0]?.id;

            // If manager changed
            if (selectedManagerId !== currentManagerId) {
                // Remove old if exists
                if (currentManagerId) {
                    await apiClient.delete(`/admin/users/manager-assignment/${currentManagerId}/${user.id}`);
                }
                // Add new if selected
                if (selectedManagerId) {
                    await apiClient.post(`/admin/users/${selectedManagerId}/assign/${user.id}`);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            onSaveSuccess?.();
        },
        onError: (error) => {
            console.error('Failed to save manager assignment', error);
        }
    });

    useImperativeHandle(ref, () => ({
        handleSave: () => mutation.mutate(),
        isSaving: mutation.isPending
    }));

    const selectedManager = managers.find(m => m.id === selectedManagerId);

    return (
        <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col ${(activeTab === 'prompts' || activeTab === 'metadata') ? 'flex-1 h-full min-h-0' : 'min-h-[500px]'}`}>
            {activeTab === 'common' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)] px-1">Account Profile</h3>
                        <div className="grid grid-cols-1 gap-6">
                            <AppInput
                                label="Username"
                                value={user.username}
                                onChange={() => {}}
                                disabled
                                showCopy
                                className="font-normal"
                            />
                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-[var(--text-main)]">Role</label>
                                <AppFormBox disabled={true}>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-normal uppercase tracking-widest ring-1 ring-inset ${user.role === 'admin'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'
                                        : user.role === 'manager'
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20'
                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                                        }`}>
                                        {user.role}
                                    </span>
                                </AppFormBox>
                            </div>
                        </div>

                    </div>

                    {user.role === 'client' && (
                        <div className="space-y-6">
                            <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)] px-1">Management</h3>
                            <div className="space-y-3">
                                <FormField label="Responsible Manager">
                                    <ComboBox
                                        value={selectedManagerId}
                                        label={selectedManager?.username || 'Select Manager...'}
                                        placeholder="Select Manager..."
                                        data={managersData}
                                        onSelect={(item) => setSelectedManagerId(item.id)}
                                        variant="primary"
                                        className="w-full"
                                        config={{ groupActions: [] }}
                                        disabled={isLocked}
                                    />
                                </FormField>
                                {selectedManagerId && !isLocked && (
                                    <button
                                        onClick={() => setSelectedManagerId('')}
                                        className="text-[10px] font-normal text-red-500/60 hover:text-red-500 uppercase tracking-widest transition-colors ml-1"
                                    >
                                        Clear Assignment
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'metadata' && (
                <ClientMetadataManagement activeClientId={user.id} hideHeader={true} />
            )}

            {activeTab === 'prompts' && (
                <PromptViewer referenceId={user.id} />
            )}
        </div>
    );
});
