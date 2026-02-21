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
            className="absolute z-[1000] min-w-[160px] bg-surface-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-white/5 -translate-x-1/2 translate-y-2"
            style={{ top: y, left: x }}
        >
            <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500 transition-all group"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(nodeId);
                    onClose();
                }}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
                >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Delete Node
            </button>
        </div>
    );
};

