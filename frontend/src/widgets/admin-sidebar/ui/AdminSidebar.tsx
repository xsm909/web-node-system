import React from 'react';
import styles from './AdminSidebar.module.css';

interface AdminSidebarProps {
    activeTab: 'users' | 'nodes';
    setActiveTab: (tab: 'users' | 'nodes') => void;
    onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>⚡ Workflow Engine</div>
            <nav className={styles.nav}>
                <button
                    className={activeTab === 'users' ? styles.activeNav : styles.navItem}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users
                </button>
                <button
                    className={activeTab === 'nodes' ? styles.activeNav : styles.navItem}
                    onClick={() => setActiveTab('nodes')}
                >
                    🔧 Node Types
                </button>
            </nav>
            <button className={styles.logout} onClick={onLogout}>Sign Out</button>
        </aside>
    );
};
