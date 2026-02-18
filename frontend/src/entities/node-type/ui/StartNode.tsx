import { Handle, Position } from 'reactflow';
import styles from './StartNode.module.css';

export function StartNode() {
    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <span className={styles.icon}>🏁</span>
                <span className={styles.title}>Start</span>
            </div>
            <div className={styles.body}>
                Process begins here
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                className={styles.handle}
            />
        </div>
    );
}
