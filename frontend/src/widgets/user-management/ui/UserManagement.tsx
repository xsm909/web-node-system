import React from 'react';
import type { User } from '../../../entities/user/model/types';
import styles from './UserManagement.module.css';

interface UserManagementProps {
    users: User[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ users }) => {
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
