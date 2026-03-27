import React from 'react';
import { Icon } from '../../../shared/ui/icon';
import { Header } from '../../../shared/ui/header';
import { AppInput } from '../../../shared/ui/app-input';

interface AppHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
    onBack?: () => void;
    isDirty?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    onToggleSidebar,
    isSidebarOpen = false,
    leftContent,
    rightContent,
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Search...",
    onBack,
    isDirty
}) => {
    return (
        <Header
            leftContent={
                <>
                    <button
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden transition-colors shrink-0"
                        onClick={onToggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <Icon name={isSidebarOpen ? "close" : "menu"} size={22} className={!isSidebarOpen ? "text-brand" : ""} />
                    </button>
                    {onBack && (
                        <button
                            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-colors shrink-0 mr-2 hidden lg:flex"
                            onClick={onBack}
                            aria-label="Go back"
                            title="Go back (Esc)"
                        >
                            <Icon name="arrow_back" size={22} />
                        </button>
                    )}
                    <div className="relative flex items-center">
                        {leftContent}
                        {isDirty && (
                            <div className="flex items-center ml-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-sm shadow-brand/50" title="Unsaved changes" />
                            </div>
                        )}
                    </div>
                </>
            }
            rightContent={
                <>
                    {onSearchChange && (
                        <AppInput
                            value={searchQuery || ''}
                            onChange={onSearchChange}
                            placeholder={searchPlaceholder}
                            icon="search"
                            showClear={!!onSearchChange}
                            className="flex-1 min-w-[200px] lg:w-[320px] ml-auto"
                        />
                    )}
                    {rightContent}
                </>
            }
        />
    );
};
