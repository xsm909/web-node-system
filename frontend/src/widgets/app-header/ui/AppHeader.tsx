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
    isPinned?: boolean;
    canPin?: boolean;
    onPinToggle?: () => void;
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
    isDirty,
    isPinned = false,
    canPin = false,
    onPinToggle,
}) => {
    return (
        <Header
            leftContent={
                <>
                    <button
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden transition-all shrink-0 active:scale-95"
                        onClick={onToggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <Icon name={isSidebarOpen ? "close" : "menu"} size={18} className={!isSidebarOpen ? "text-brand" : ""} />
                    </button>
                    {onBack && (
                        <div className="flex items-center gap-1">
                            <button
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all shrink-0 hidden lg:flex active:scale-95"
                                onClick={onBack}
                                aria-label={isPinned ? "Close tab" : "Go back"}
                                title={isPinned ? "Close tab (Esc)" : "Go back (Esc)"}
                            >
                                <Icon name={isPinned ? "close" : "arrow_back"} size={18} />
                            </button>
                            {canPin && onPinToggle && !isPinned && (
                                <button
                                    className={`p-1.5 rounded-lg transition-all shrink-0 hidden lg:flex text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] active:scale-95 ${isDirty ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                                    onClick={isDirty ? undefined : onPinToggle}
                                    disabled={isDirty}
                                    aria-label="Pin form"
                                    title={isDirty ? "Cannot pin unsaved data" : "Pin (detach)"}
                                >
                                    <Icon name="keep" size={18} />
                                </button>
                            )}
                        </div>
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
