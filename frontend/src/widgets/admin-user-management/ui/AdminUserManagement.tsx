import React from 'react';
import type { User } from '../../../entities/user/model/types';
import styles from './AdminUserManagement.module.css';

interface AdminUserManagementProps {
    users: User[];
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ users }) => {
    return (
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
    );
};
