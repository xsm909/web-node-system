import { useState, useEffect } from 'react';
import { AppHeader } from '../../app-header';
import { AppTabs } from '../../../shared/ui/app-tabs/AppTabs';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { 
    useAiProviders, 
    useCreateAiProvider, 
    useUpdateAiProvider, 
    useDeleteAiProvider 
} from '../../../entities/ai-provider/api';
import { AiProviderList } from './AiProviderList';
import { AiProviderEditor } from './AiProviderEditor';
import { CredentialManagement } from '../../credential-management';
import type { AiProvider } from '../../../entities/ai-provider/model/types';
import { useProjectStore } from '../../../features/projects/store';

interface ApiManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    initialTab?: 'providers' | 'credentials';
    initialEditId?: string | null;
}

export function ApiManagement({ onToggleSidebar, isSidebarOpen, initialTab, initialEditId }: ApiManagementProps) {
    const [activeTab, setActiveTab] = useState<'providers' | 'credentials'>(initialTab || 'providers');
    const { baseProject } = useProjectStore();
    
    // AI Providers state
    const { data: providers = [], isLoading: providersLoading } = useAiProviders(baseProject?.id);
    const createProvider = useCreateAiProvider();
    const updateProvider = useUpdateAiProvider();
    const deleteProvider = useDeleteAiProvider();
    
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null);
    const [providerToDelete, setProviderToDelete] = useState<AiProvider | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Internal deep-link support
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
        if (initialEditId && initialTab === 'providers' && providers.length > 0) {
            const found = providers.find(p => p.id === initialEditId);
            if (found) {
                setSelectedProvider(found);
                setView('edit');
            }
        }
    }, [initialTab, initialEditId, providers]);

    const handleCreateProvider = () => {
        setSelectedProvider(null);
        setView('edit');
    };

    const handleEditProvider = (provider: AiProvider) => {
        setSelectedProvider(provider);
        setView('edit');
    };

    const handleSaveProvider = async (data: Partial<AiProvider>) => {
        try {
            let result: AiProvider;
            if (selectedProvider) {
                result = await updateProvider.mutateAsync({ id: selectedProvider.id, data });
            } else {
                result = await createProvider.mutateAsync(data);
            }
            setSelectedProvider(result);
            // setView('list'); // Keep editor open
        } catch (err) {
            console.error("Failed to save provider", err);
        }
    };

    const confirmDeleteProvider = async () => {
        if (!providerToDelete) return;
        try {
            await deleteProvider.mutateAsync(providerToDelete.id);
        } finally {
            setProviderToDelete(null);
        }
    };

    if (view === 'edit' && activeTab === 'providers') {
        return (
            <AiProviderEditor
                provider={selectedProvider}
                isSaving={createProvider.isPending || updateProvider.isPending}
                onSave={handleSaveProvider}
                onCancel={() => setView('list')}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex flex-col">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                            API Management
                        </h1>
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 px-2 lg:px-0">
                            Configure AI providers and secure credentials.
                        </p>
                    </div>
                }
                rightContent={
                    activeTab === 'providers' && (
                        <AppRoundButton
                            onClick={handleCreateProvider}
                            icon="add"
                            variant="brand"
                            title="Add AI Provider"
                            iconSize={20}
                        />
                    )
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={activeTab === 'providers' ? "Search providers..." : "Search credentials..."}
            />

            <div className="px-8 border-b border-[var(--border-base)] bg-[var(--bg-app)]">
                <AppTabs
                    tabs={[
                        { id: 'providers', label: 'AI Providers', icon: 'hive' },
                        { id: 'credentials', label: 'Credentials', icon: 'verified' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => {
                        setActiveTab(id as 'providers' | 'credentials');
                        setSearchQuery('');
                    }}
                    variant="underline"
                />
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'providers' ? (
                    providersLoading ? (
                        <div className="p-8 text-center text-[var(--text-muted)] italic">Loading providers...</div>
                    ) : (
                        <AiProviderList
                            providers={providers}
                            searchQuery={searchQuery}
                            onEdit={handleEditProvider}
                            onDelete={setProviderToDelete}
                        />
                    )
                ) : (
                    <CredentialManagement 
                        hideHeader 
                        externalSearchQuery={searchQuery} 
                        onExternalSearchQueryChange={setSearchQuery} 
                    />
                )}
            </div>

            <ConfirmModal
                isOpen={!!providerToDelete}
                title="Delete AI Provider"
                description={`Are you sure you want to delete the provider '${providerToDelete?.key}'?`}
                confirmLabel="Delete"
                isLoading={deleteProvider.isPending}
                onConfirm={confirmDeleteProvider}
                onCancel={() => setProviderToDelete(null)}
            />
        </div>
    );
}
