import { useState, useEffect } from 'react';
import { AppHeader } from '../../app-header';
import { AppTabs } from '../../../shared/ui/app-tabs/AppTabs';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { AppSectionTitle } from '../../../shared/ui/app-section-title/AppSectionTitle';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { 
    useAiProviders, 
    useAiProvider,
    useCreateAiProvider, 
    useUpdateAiProvider, 
    useDeleteAiProvider 
} from '../../../entities/ai-provider/api';
import { AiProviderList } from './AiProviderList';
import { AiProviderEditor } from './AiProviderEditor';
import { CredentialList } from '../../credential-management/ui/CredentialList';
import { CredentialEditor } from '../../credential-management/ui/CredentialEditor';
import { 
    useCredentials, 
    useDeleteCredential 
} from '../../../entities/credential/api';
import { 
    useApiRegistries,
    useApiRegistry,
    useCreateApiRegistry,
    useUpdateApiRegistry,
    useDeleteApiRegistry
} from '../../../entities/api-registry/api';
import { ApiRegistryList } from './ApiRegistryList';
import { ApiRegistryEditor } from './ApiRegistryEditor';
import type { ApiRegistry } from '../../../entities/api-registry/model/types';
import type { AiProvider } from '../../../entities/ai-provider/model/types';
import type { Credential } from '../../../entities/credential/model/types';
import { useProjectStore } from '../../../features/projects/store';

interface ApiManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    initialTab?: 'providers' | 'credentials' | 'api_registry';
    initialEditId?: string | null;
}

export function ApiManagement({ onToggleSidebar, isSidebarOpen, initialTab, initialEditId }: ApiManagementProps) {
    const [activeTab, setActiveTab] = useState<'providers' | 'credentials' | 'api_registry'>(initialTab || 'providers');
    const { baseProject } = useProjectStore();
    
    // AI Providers state
    const { data: providers = [], isLoading: providersLoading } = useAiProviders(baseProject?.id);
    const { data: directProvider, isLoading: directProviderLoading } = useAiProvider(initialEditId);
    const createProvider = useCreateAiProvider();
    const updateProvider = useUpdateAiProvider();
    const deleteProvider = useDeleteAiProvider();

    // Credentials state
    const { data: credentials = [], isLoading: credentialsLoading } = useCredentials();
    const deleteCredentialMutation = useDeleteCredential();
    
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [selectedProvider, setSelectedProvider] = useState<AiProvider | null>(null);
    const [providerToDelete, setProviderToDelete] = useState<AiProvider | null>(null);
    const [credentialToDelete, setCredentialToDelete] = useState<Credential | null>(null);
    const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // API Registry state
    const { data: apiRegistries = [], isLoading: apisLoading } = useApiRegistries(baseProject?.id);
    const { data: directApi, isLoading: directApiLoading } = useApiRegistry(initialEditId);
    const createApi = useCreateApiRegistry();
    const updateApi = useUpdateApiRegistry();
    const deleteApi = useDeleteApiRegistry();
    const [selectedApi, setSelectedApi] = useState<ApiRegistry | null>(null);
    const [apiToDelete, setApiToDelete] = useState<ApiRegistry | null>(null);

    // Internal deep-link support
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
        if (initialEditId) {
            if (activeTab === 'providers') {
                const found = providers.find(p => p.id === initialEditId);
                if (found) {
                    setSelectedProvider(found);
                    setView('edit');
                } else if (directProvider && !directProviderLoading) {
                    setSelectedProvider(directProvider);
                    setView('edit');
                }
            } else if (activeTab === 'credentials') {
                setEditingCredentialId(initialEditId);
                setView('edit');
            } else if (activeTab === 'api_registry') {
                const found = apiRegistries.find(a => a.id === initialEditId);
                if (found) {
                    setSelectedApi(found);
                    setView('edit');
                } else if (directApi && !directApiLoading) {
                    setSelectedApi(directApi);
                    setView('edit');
                }
            }
        }
    }, [initialTab, initialEditId, providers, directProvider, directProviderLoading, apiRegistries, directApi, directApiLoading, activeTab]);

    const handleCreateProvider = () => {
        setSelectedProvider(null);
        setView('edit');
    };

    const handleCreateCredential = () => {
        setEditingCredentialId('new');
        setView('edit');
    };

    const handleEditProvider = (provider: AiProvider) => {
        setSelectedProvider(provider);
        setView('edit');
    };

    const handleEditCredential = (cred: Credential) => {
        setEditingCredentialId(cred.id);
        setView('edit');
    };

    const handleCreateApi = () => {
        setSelectedApi(null);
        setView('edit');
    };

    const handleEditApi = (api: ApiRegistry) => {
        setSelectedApi(api);
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
            // Stay in edit mode after save to follow pinned data persistence rule
            // setView('list');
        } catch (err) {
            console.error("Failed to save provider", err);
            alert("Failed to save provider. Check console for details.");
        }
    };

    const handleSaveApi = async (data: Partial<ApiRegistry>) => {
        try {
            let result: ApiRegistry;
            if (selectedApi) {
                result = await updateApi.mutateAsync({ id: selectedApi.id, data });
            } else {
                result = await createApi.mutateAsync(data);
            }
            setSelectedApi(result);
            // Stay in edit mode after save to follow pinned data persistence rule
            // setView('list');
        } catch (err) {
            console.error("Failed to save API Registry entry", err);
            alert("Failed to save API Registry entry. Check console for details.");
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

    const confirmDeleteCredential = async () => {
        if (!credentialToDelete) return;
        try {
            await deleteCredentialMutation.mutateAsync(credentialToDelete.id);
        } finally {
            setCredentialToDelete(null);
        }
    };

    const confirmDeleteApi = async () => {
        if (!apiToDelete) return;
        try {
            await deleteApi.mutateAsync(apiToDelete.id);
        } finally {
            setApiToDelete(null);
        }
    };

    if (view === 'edit') {
        if (activeTab === 'providers') {
            return (
                <AiProviderEditor
                    provider={selectedProvider}
                    isSaving={createProvider.isPending || updateProvider.isPending}
                    onSave={handleSaveProvider}
                    onCancel={() => setView('list')}
                />
            );
        } else if (activeTab === 'credentials') {
            return (
                <CredentialEditor
                    credentialId={editingCredentialId}
                    onCancel={() => setView('list')}
                    onSaveSuccess={(cred) => setEditingCredentialId(cred.id)}
                />
            );
        } else if (activeTab === 'api_registry') {
            return (
                <ApiRegistryEditor
                    api={selectedApi}
                    isSaving={createApi.isPending || updateApi.isPending}
                    onSave={handleSaveApi}
                    onCancel={() => setView('list')}
                />
            );
        }
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <AppSectionTitle 
                        icon="verified" 
                        title="API Management" 
                        projectId={null}
                    />
                }
                rightContent={
                    <AppRoundButton
                        onClick={
                            activeTab === 'providers' ? handleCreateProvider : 
                            activeTab === 'api_registry' ? handleCreateApi : 
                            handleCreateCredential
                        }
                        icon="add"
                        variant="brand"
                        title={
                            activeTab === 'providers' ? "Add AI Provider" : 
                            activeTab === 'api_registry' ? "Add External API" : 
                            "Add Credential"
                        }
                        iconSize={20}
                    />
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={
                    activeTab === 'providers' ? "Search providers..." : 
                    activeTab === 'api_registry' ? "Search APIs..." : 
                    "Search credentials..."
                }
            />

            <div className="px-8 border-b border-[var(--border-base)] bg-[var(--bg-app)]">
                <AppTabs
                    tabs={[
                        { id: 'providers', label: 'AI Providers', icon: 'hive' },
                        { id: 'api_registry', label: 'External APIs', icon: 'api' },
                        { id: 'credentials', label: 'Credentials', icon: 'verified' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => {
                        setActiveTab(id as 'providers' | 'credentials' | 'api_registry');
                        setSearchQuery('');
                        setView('list');
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
                ) : activeTab === 'api_registry' ? (
                    apisLoading ? (
                        <div className="p-8 text-center text-[var(--text-muted)] italic">Loading APIs...</div>
                    ) : (
                        <ApiRegistryList
                            apis={apiRegistries}
                            searchQuery={searchQuery}
                            onEdit={handleEditApi}
                            onDelete={setApiToDelete}
                        />
                    )
                ) : (
                    credentialsLoading ? (
                        <div className="p-8 text-center text-[var(--text-muted)] italic">Loading credentials...</div>
                    ) : (
                        <CredentialList 
                            credentials={credentials}
                            searchQuery={searchQuery}
                            onEdit={handleEditCredential}
                            onDelete={setCredentialToDelete}
                        />
                    )
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

            <ConfirmModal
                isOpen={!!credentialToDelete}
                title="Delete Credential"
                description={`Are you sure you want to delete the credential '${credentialToDelete?.key || ''}'?`}
                confirmLabel="Delete"
                isLoading={deleteCredentialMutation.isPending}
                onConfirm={confirmDeleteCredential}
                onCancel={() => setCredentialToDelete(null)}
            />

            <ConfirmModal
                isOpen={!!apiToDelete}
                title="Delete External API"
                description={`Are you sure you want to delete the API '${apiToDelete?.name}'?`}
                confirmLabel="Delete"
                isLoading={deleteApi.isPending}
                onConfirm={confirmDeleteApi}
                onCancel={() => setApiToDelete(null)}
            />
        </div>
    );
}
