import { useEffect, useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';
import styles from './ClientPage.module.css';

interface WorkflowResult {
    id: string;
    workflow_name: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    created_at: string;
    result_summary: string;
}

export default function ClientPage() {
    const { logout } = useAuthStore();
    const [results, setResults] = useState<WorkflowResult[]>([]);

    useEffect(() => {
        apiClient.get('/client/results').then((r) => setResults(r.data)).catch(() => { });
    }, []);

    const statusColor: Record<string, string> = {
        pending: '#f59e0b',
        running: '#3b82f6',
        success: '#10b981',
        failed: '#ef4444',
    };

    return (
        <div className={styles.layout}>
            <header className={styles.header}>
                <div className={styles.logo}>⚡ Workflow Engine</div>
                <div className={styles.headerRight}>
                    <span className={styles.badge}>Client Portal</span>
                    <button className={styles.logout} onClick={logout}>Sign Out</button>
                </div>
            </header>

            <main className={styles.main}>
                <h1 className={styles.title}>My Workflow Results</h1>
                <div className={styles.grid}>
                    {results.length === 0 && (
                        <div className={styles.empty}>No workflow results yet.</div>
                    )}
                    {results.map((r) => (
                        <div key={r.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3>{r.workflow_name}</h3>
                                <span className={styles.status} style={{ color: statusColor[r.status] }}>
                                    ● {r.status}
                                </span>
                            </div>
                            <p className={styles.summary}>{r.result_summary || 'No output yet.'}</p>
                            <span className={styles.date}>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
