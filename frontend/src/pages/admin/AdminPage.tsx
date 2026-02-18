import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';
import styles from './AdminPage.module.css';

interface User {
    id: number;
    username: string;
    role: string;
}

interface NodeType {
    id: number;
    name: string;
    version: string;
    description: string;
    code: string;
    input_schema: any;
    output_schema: any;
    parameters: any[];
    is_async: boolean;
}

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
                is_async: false
            });
        }
        setIsModalOpen(true);
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
            <aside className={styles.sidebar}>
                <div className={styles.logo}>⚡ Workflow Engine</div>
                <nav className={styles.nav}>
                    <button className={activeTab === 'users' ? styles.activeNav : styles.navItem} onClick={() => setActiveTab('users')}>
                        👥 Users
                    </button>
                    <button className={activeTab === 'nodes' ? styles.activeNav : styles.navItem} onClick={() => setActiveTab('nodes')}>
                        🔧 Node Types
                    </button>
                </nav>
                <button className={styles.logout} onClick={logout}>Sign Out</button>
            </aside>

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

                {activeTab === 'users' && (
                    <div className={styles.content}>
                        <table className={styles.table}>
                            <thead>
                                <tr><th>ID</th><th>Username</th><th>Role</th></tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>{u.id}</td>
                                        <td>{u.username}</td>
                                        <td><span className={styles.roleBadge}>{u.role}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'nodes' && (
                    <div className={styles.content}>
                        <div className={styles.grid}>
                            {nodeTypes.map((n) => (
                                <div key={n.id} className={styles.nodeCard}>
                                    <div>
                                        <h3>{n.name}</h3>
                                        <span className={styles.version}>v{n.version}</span>
                                        <p>{n.description}</p>
                                    </div>
                                    <div className={styles.actions}>
                                        <button className={styles.editBtn} onClick={() => handleOpenModal(n)}>
                                            Edit Node
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2>{editingNode ? 'Edit Node Type' : 'Add New Node Type'}</h2>
                        <form onSubmit={handleSave} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Name</label>
                                <input
                                    className={styles.input}
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Version</label>
                                <input
                                    className={styles.input}
                                    value={formData.version || ''}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Description</label>
                                <textarea
                                    className={styles.textarea}
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Python Code</label>
                                <textarea
                                    className={`${styles.textarea} ${styles.codeEditor}`}
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.saveBtn}>
                                    {editingNode ? 'Update Node' : 'Create Node'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
