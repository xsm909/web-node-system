import styles from './Console.module.css';

interface LogEntry {
    timestamp: string;
    message: string;
    node_id?: string;
    level: string;
}

interface ConsoleProps {
    logs: LogEntry[];
    isVisible: boolean;
    onClose?: () => void;
}

export function Console({ logs, isVisible, onClose }: ConsoleProps) {
    if (!isVisible) return null;

    return (
        <div className={styles.console}>
            <div className={styles.header}>
                <span className={styles.title}>Debug Console</span>
                {onClose && <button onClick={onClose} style={{ color: '#858585', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>}
            </div>
            <div className={styles.logArea}>
                {logs.length === 0 ? (
                    <div style={{ color: '#555', fontStyle: 'italic' }}>No logs yet. Run the workflow to see output...</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={styles.entry}>
                            <span className={styles.timestamp}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            {log.node_id && <span className={styles.nodeId}>{log.node_id}:</span>}
                            <span className={`${styles.message} ${styles[`level_${log.level}`] || ''}`}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
