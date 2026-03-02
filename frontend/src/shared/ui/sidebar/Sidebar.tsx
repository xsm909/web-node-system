import type { ReactNode } from 'react';

export interface SidebarProps {
    className?: string;
    isOpen?: boolean;
    onClose?: () => void;
    header: ReactNode;
    content: ReactNode;
    footer: ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
    className = '',
    isOpen = true,
    onClose,
    header,
    content,
    footer
}) => {
    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && onClose && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
                    onClick={onClose}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-[70] w-72 bg-surface-900 border-r border-[var(--border-base)] flex flex-col h-full ring-1 ring-black/5 dark:ring-white/5
                transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                ${className}
            `}>
                <div className="p-6">
                    {header}
                </div>

                <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                    {content}
                </nav>

                <div className="p-4 border-t border-[var(--border-base)]">
                    {footer}
                </div>
            </aside>
        </>
    );
};
