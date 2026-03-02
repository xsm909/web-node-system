import { useState, useEffect } from 'react';
import { AppSidebar } from '../../widgets/app-sidebar';
import { AdminUserManagement } from '../../widgets/admin-user-management';
import { AdminNodeLibrary } from '../../widgets/admin-node-library';
import { AdminCredentialManagement } from '../../widgets/admin-credential-management';
import { NodeTypeFormModal } from '../../widgets/node-type-form-modal';
import { useNodeTypeManagement } from '../../features/node-type-management';
import { apiClient } from '../../shared/api/client';
import type { NodeType } from '../../entities/node-type/model/types';
import { Icon } from '../../shared/ui/icon';
import { AppHeader } from '../../widgets/app-header';

export default function AdminPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'nodes' | 'credentials'>('users');
    const [refreshCount, setRefreshCount] = useState(0);
    const [allNodes, setAllNodes] = useState<NodeType[]>([]);

    useEffect(() => {
        apiClient.get('/admin/node-types').then(({ data }) => setAllNodes(data)).catch(() => { });
    }, [refreshCount]);

    const {
        isModalOpen,
        setIsModalOpen,
        editingNode,
        formData,
        setFormData,
        handleOpenModal,
        handleDuplicateNode,
        handleSave
    } = useNodeTypeManagement();

    return (
        <div className="flex h-screen bg-surface-900 text-[var(--text-main)] font-sans overflow-hidden">
            <AppSidebar
                title="Workflow Engine"
                headerIcon="bolt"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                navItems={[
                    {
                        id: 'users',
                        label: 'Users',
                        icon: 'people',
                        isActive: activeTab === 'users',
                        onClick: () => setActiveTab('users'),
                    },
                    {
                        id: 'nodes',
                        label: 'Node Types',
                        icon: 'build',
                        isActive: activeTab === 'nodes',
                        onClick: () => setActiveTab('nodes'),
                    },
                    {
                        id: 'credentials',
                        label: 'Credentials',
                        icon: 'key',
                        isActive: activeTab === 'credentials',
                        onClick: () => setActiveTab('credentials'),
                    },
                ]}
            />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AppHeader
                    onToggleSidebar={() => setIsSidebarOpen(true)}
                    isSidebarOpen={isSidebarOpen}
                    leftContent={
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90">
                            {activeTab === 'users' ? 'User Management' :
                                activeTab === 'nodes' ? 'Node Library' : 'Credentials'}
                        </h1>
                    }
                    rightContent={
                        activeTab === 'nodes' && (
                            <button
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-all active:scale-[0.98]"
                                onClick={() => handleOpenModal()}
                            >
                                <Icon name="add" size={18} />
                                Add New Node
                            </button>
                        )
                    }
                />


                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {activeTab === 'users' ? (
                            <AdminUserManagement />
                        ) : activeTab === 'nodes' ? (
                            <AdminNodeLibrary
                                onEditNode={handleOpenModal}
                                onDuplicateNode={handleDuplicateNode}
                                refreshTrigger={refreshCount}
                            />
                        ) : (
                            <AdminCredentialManagement />
                        )}
                    </div>
                </div>
            </main>

            <NodeTypeFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingNode={editingNode}
                formData={formData}
                setFormData={setFormData}
                onSave={(e) => handleSave(e, () => setRefreshCount(r => r + 1))}
                allNodes={allNodes}
            />
        </div>
    );
}

