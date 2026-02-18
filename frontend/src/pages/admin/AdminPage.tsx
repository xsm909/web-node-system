import { useEffect, useState } from 'react';
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
}

export default function AdminPage() {
    const { logout } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'nodes'>('users');

    useEffect(() => {
        apiClient.get('/admin/users').then((r) => setUsers(r.data)).catch(() => { });
        apiClient.get('/admin/node-types').then((r) => setNodeTypes(r.data)).catch(() => { });
    }, []);

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
                                    <h3>{n.name}</h3>
                                    <span className={styles.version}>v{n.version}</span>
                                    <p>{n.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
