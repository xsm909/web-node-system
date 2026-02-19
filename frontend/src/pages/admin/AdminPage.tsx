import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';
import type { User } from '../../entities/user/model/types';
import type { NodeType } from '../../entities/node-type/model/types';
import { AdminSidebar } from '../../widgets/admin-sidebar';
import { AdminUserManagement } from '../../widgets/admin-user-management';
import { AdminNodeLibrary } from '../../widgets/admin-node-library';
import { NodeTypeFormModal } from '../../widgets/node-type-form-modal';
import styles from './AdminPage.module.css';

export default function AdminPage() {
    const { logout } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'nodes'>('users');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<NodeType | null>(null);
    const [formData, setFormData] = useState<Partial<NodeType>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        apiClient.get('/admin/users').then((r: { data: User[] }) => setUsers(r.data)).catch(() => { });
        apiClient.get('/admin/node-types').then((r: { data: NodeType[] }) => setNodeTypes(r.data)).catch(() => { });
    };

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
        } catch (error) {
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
        } catch (error) {
            alert('Failed to save node type');
        }
    };

    return (
        <div className={styles.layout}>
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={logout}
            />

            <main className={styles.main}>
                <header className={styles.header}>
                    <h1>{activeTab === 'users' ? 'User Management' : 'Node Library'}</h1>
                    <span className={styles.badge}>Admin</span>
                    {activeTab === 'nodes' && (
                        <button className={styles.addBtn} onClick={() => handleOpenModal()}>
                            + Add New Node
                        </button>
                    )}
                </header>

                {activeTab === 'users' ? (
                    <AdminUserManagement users={users} />
                ) : (
                    <AdminNodeLibrary
                        nodeTypes={nodeTypes}
                        onEditNode={handleOpenModal}
                        onDeleteNode={handleDeleteNode}
                    />
                )}
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
