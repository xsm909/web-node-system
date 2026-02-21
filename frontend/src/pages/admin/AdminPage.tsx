import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';
import type { User } from '../../entities/user/model/types';
import type { NodeType } from '../../entities/node-type/model/types';
import type { Credential } from '../../entities/credential/model/types';
import { AdminSidebar } from '../../widgets/admin-sidebar';
import { AdminUserManagement } from '../../widgets/admin-user-management';
import { AdminNodeLibrary } from '../../widgets/admin-node-library';
import { AdminCredentialManagement } from '../../widgets/admin-credential-management';
import { NodeTypeFormModal } from '../../widgets/node-type-form-modal';

export default function AdminPage() {
    const { logout } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'nodes' | 'credentials'>('users');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<NodeType | null>(null);
    const [formData, setFormData] = useState<Partial<NodeType>>({});

    const fetchData = () => {
        apiClient.get('/admin/users').then((r: { data: User[] }) => setUsers(r.data)).catch(() => { });
        apiClient.get('/admin/node-types').then((r: { data: NodeType[] }) => setNodeTypes(r.data)).catch(() => { });
        apiClient.get('/admin/credentials').then((r: { data: Credential[] }) => setCredentials(r.data)).catch(() => { });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (node?: NodeType) => {
        if (node) {
            setEditingNode(node);
            setFormData(node);
        } else {
            setEditingNode(null);
            setFormData({
                name: '',
                version: '1.0',
                description: '',
                code: 'def run(inputs, params):\n    return {}',
                input_schema: {},
                output_schema: {},
                parameters: [],
                category: '',
                is_async: false
            });
        }
        setIsModalOpen(true);
    };

    const handleDeleteNode = async (node: NodeType) => {
        try {
            await apiClient.delete(`/admin/node-types/${node.id}`);
            fetchData();
        } catch {
            alert('Failed to delete node type');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingNode) {
                await apiClient.put(`/admin/node-types/${editingNode.id}`, formData);
            } else {
                await apiClient.post('/admin/node-types', formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch {
            alert('Failed to save node type');
        }
    };

    return (
        <div className="flex h-screen bg-surface-900 text-white font-sans overflow-hidden">
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={logout}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-surface-900 overflow-hidden">
                <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-surface-800/50 backdrop-blur-md sticky top-0 z-10">
                    <h1 className="text-xl font-semibold tracking-tight text-white/90">
                        {activeTab === 'users' ? 'User Management' :
                            activeTab === 'nodes' ? 'Node Library' : 'Credentials'}
                    </h1>
                    {activeTab === 'nodes' && (
                        <button
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand/90 text-white text-sm font-medium shadow-lg shadow-brand/10 transition-all active:scale-[0.98]"
                            onClick={() => handleOpenModal()}
                        >
                            <span className="text-lg leading-none">+</span>
                            Add New Node
                        </button>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {activeTab === 'users' ? (
                            <AdminUserManagement users={users} />
                        ) : activeTab === 'nodes' ? (
                            <AdminNodeLibrary
                                nodeTypes={nodeTypes}
                                onEditNode={handleOpenModal}
                                onDeleteNode={handleDeleteNode}
                            />
                        ) : (
                            <AdminCredentialManagement
                                credentials={credentials}
                                onRefresh={fetchData}
                            />
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
                onSave={handleSave}
            />
        </div>
    );
}

