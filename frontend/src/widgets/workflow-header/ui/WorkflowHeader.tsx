import React from 'react';
import styles from './WorkflowHeader.module.css';

interface WorkflowHeaderProps {
    title: string;
    isRunning: boolean;
    isSidebarOpen: boolean;
    onSave: () => void;
    onRun: () => void;
    onToggleSidebar: () => void;
    canAction: boolean;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
    title,
    isRunning,
    isSidebarOpen,
    onSave,
    onRun,
    onToggleSidebar,
    canAction,
}) => {
    return (
        <header className={`${styles.header} ${isSidebarOpen ? styles.sidebarOpenActive : ''}`}>
            <button
                className={styles.hamburger}
                onClick={onToggleSidebar}
                aria-label="Toggle menu"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.actions}>
                <button
                    className={styles.saveBtn}
                    onClick={onSave}
                    disabled={!canAction}
                    title="Save Workflow"
                    aria-label="Save"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                </button>
                <button
                    className={styles.runBtn}
                    onClick={onRun}
                    disabled={!canAction || isRunning}
                    title={isRunning ? 'Running...' : 'Run Workflow'}
                    aria-label="Run"
                >
                    {isRunning ? (
                        <svg className={styles.spinner} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
};
