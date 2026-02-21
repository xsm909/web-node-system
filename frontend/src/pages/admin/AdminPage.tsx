import { useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { AdminSidebar } from '../../widgets/admin-sidebar';
import { AdminUserManagement } from '../../widgets/admin-user-management';
import { AdminNodeLibrary } from '../../widgets/admin-node-library';
import { AdminCredentialManagement } from '../../widgets/admin-credential-management';
import { NodeTypeFormModal } from '../../widgets/node-type-form-modal';
import { useNodeTypeManagement } from '../../features/node-type-management';
import { ThemeToggle } from '../../shared/ui/theme-toggle/ThemeToggle';

import { Icon } from '../../shared/ui/icon';

export default function AdminPage() {
    const { logout } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'users' | 'nodes' | 'credentials'>('users');
    const [refreshCount, setRefreshCount] = useState(0);

    const {
        isModalOpen,
        setIsModalOpen,
        editingNode,
        formData,
        setFormData,
        handleOpenModal,
        handleSave
    } = useNodeTypeManagement();

    return (
        <div className="flex h-screen bg-surface-900 text-[var(--text-main)] font-sans overflow-hidden">
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={logout}
            />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 flex items-center justify-between px-8 border-b border-[var(--border-base)] bg-surface-900/80 backdrop-blur-md sticky top-0 z-10">
                    <h1 className="text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90">
                        {activeTab === 'users' ? 'User Management' :
                            activeTab === 'nodes' ? 'Node Library' : 'Credentials'}
                    </h1>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <div className="w-px h-6 bg-[var(--border-base)] mx-1" />
                        {activeTab === 'nodes' && (
                            <button
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-all active:scale-[0.98]"
                                onClick={() => handleOpenModal()}
                            >
                                <Icon name="add" size={18} />
                                Add New Node
                            </button>
                        )}
                    </div>
                </header>


                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {activeTab === 'users' ? (
                            <AdminUserManagement />
                        ) : activeTab === 'nodes' ? (
                            <AdminNodeLibrary
                                onEditNode={handleOpenModal}
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
            />
        </div>
    );
}

