import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';

interface AppContextMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRect: DOMRect | null;
    children: React.ReactNode;
    className?: string;
    zIndex?: number;
}

/**
 * A shared context menu component that renders using React Portals to document.body.
 * This ensures the menu is never clipped by parents with overflow:hidden and 
 * always stays on top of the UI.
 */
export const AppContextMenu: React.FC<AppContextMenuProps> = ({ 
    isOpen, 
    onClose, 
    anchorRect, 
    children, 
    className = '',
    zIndex = 2000
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null);

    useEffect(() => {
        if (isOpen && anchorRect) {
            // Estimated menu dimensions for initial placement
            const menuWidth = 208; 
            const menuHeight = 130; 
            
            let top = anchorRect.bottom + 8;
            let left = anchorRect.right - menuWidth;

            // Flip up if space below is tight (viewport bottom constraint)
            if (top + menuHeight > window.innerHeight - 20) {
                top = anchorRect.top - menuHeight - 8;
            }

            // Boundary checks for horizontal positioning
            if (left < 16) left = 16;
            if (left + menuWidth > window.innerWidth - 16) {
                left = window.innerWidth - menuWidth - 16;
            }

            // Final fallback for negative top
            if (top < 16) top = 16;

            setPosition({ top, left });
        } else {
            setPosition(null);
        }
    }, [isOpen, anchorRect]);

    useHotkeys([
        { key: 'Escape', description: 'Close Menu', handler: () => onClose() }
    ], { 
        scopeName: 'Context Menu',
        enabled: isOpen,
        exclusive: true 
    });

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 10);
        
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !anchorRect || !position) return null;

    return createPortal(
        <div 
            ref={menuRef}
            style={{ 
                position: 'fixed', 
                top: `${position.top}px`, 
                left: `${position.left}px`,
                zIndex,
                width: '208px'
            }}
            className={`bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-300 ring-4 ring-black/5 ${className}`}
        >
            {children}
        </div>,
        document.body
    );
};
