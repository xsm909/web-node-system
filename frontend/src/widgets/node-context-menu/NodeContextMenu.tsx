import React, { useEffect, useRef } from 'react';

interface NodeContextMenuProps {
    x: number;
    y: number;
    nodeId: string;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
    x,
    y,
    nodeId,
    onDelete,
    onClose,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('wheel', onClose);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('wheel', onClose);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="absolute z-[1000] min-w-[180px] bg-surface-800 border border-[var(--border-base)] rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.4)] p-1.5 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/5 -translate-x-1/2 translate-y-3"
            style={{ top: y, left: x }}
        >
            <button
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/30 transition-all group active:scale-95"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(nodeId);
                    onClose();
                }}
            >
                <div className="flex items-center gap-3">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity"
                    >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Terminate Node</span>
                </div>
                <div className="text-[9px] opacity-40 group-hover:opacity-100 font-sans">DEL</div>
            </button>
        </div>

    );
};

