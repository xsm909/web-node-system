import React from 'react';

export interface HeaderProps {
    className?: string;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
    className = '',
    leftContent,
    rightContent,
    children,
}) => {
    return (
        <header className={`sticky top-0 z-40 flex items-center justify-between px-4 lg:px-8 bg-surface-900/80 backdrop-blur-md border-b border-[var(--border-base)] h-16 shrink-0 ${className}`}>
            <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                {leftContent}
                {children}
            </div>

            {rightContent && (
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                    {rightContent}
                </div>
            )}
        </header>
    );
};
