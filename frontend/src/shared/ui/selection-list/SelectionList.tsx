import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icon';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';

export type SelectionAction = 'add' | 'delete' | 'rename' | 'duplicate';

export interface SelectionItem {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    selectable?: boolean;
    icon?: string;
    iconDir?: 'icons' | 'node_icons';
}

export interface SelectionGroup {
    id: string;
    name: string;
    items: SelectionItem[];
    children: Record<string, SelectionGroup>;
    selectable?: boolean;
    icon?: string;
    iconDir?: 'icons' | 'node_icons';
    /** Per-group override of config.groupActions. If set, only these actions show for this group. */
    groupActions?: SelectionAction[];
    /** If set, overrides config.allowDelete/allowRename/allowDuplicate for items in this group. */
    itemActions?: SelectionAction[];
}

export interface SelectionListConfig {
    allowAdd?: boolean;
    allowDelete?: boolean;
    allowRename?: boolean;
    allowDuplicate?: boolean;
    groupActions?: SelectionAction[];
}

interface SelectionListProps {
    data: Record<string, SelectionGroup>;
    items?: SelectionItem[];
    config?: SelectionListConfig;
    activeItemId?: string;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
    onClose?: () => void;
    searchPlaceholder?: string;
    position?: { x: number, y: number };
    align?: 'left' | 'right';
}

// --- Unified Selection List Content ---
interface SelectionListContentProps {
    groups?: Record<string, SelectionGroup>;
    items?: SelectionItem[];
    breadcrumb: string[];
    config: SelectionListConfig;
    activeDescendant?: string[]; // For highlighting hovered path in groups
    activeItemId?: string;      // For highlighting active item
    onNavigate?: (path: string[], top: number) => void;
    onSelect: (item: SelectionItem) => void;
    onAction?: (action: SelectionAction, target: SelectionItem | SelectionGroup) => void;
}

const SelectionListContent: React.FC<SelectionListContentProps> = ({
    groups = {},
    items = [],
    breadcrumb,
    config,
    activeDescendant = [],
    activeItemId,
    onNavigate,
    onSelect,
    onAction
}) => {
    const groupEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
    const hasVisibleBreadcrumb = breadcrumb.some(seg => seg.trim() !== '');

    return (
        <div className="flex flex-col gap-1">
            {hasVisibleBreadcrumb && (
                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1 flex-wrap">
                    {breadcrumb.map((seg, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="opacity-50">›</span>}
                            <span>{seg}</span>
                        </React.Fragment>
                    ))}
                </div>
            )}
            <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                {/* Render Groups (Categories) */}
                {groupEntries.map(([label, group]) => {
                    const hasChildren = Object.keys(group.children).length > 0;
                    const fullPath = [...breadcrumb, label];
                    const isActive = activeDescendant[breadcrumb.length] === label;
                    const isSelectable = group.selectable ?? false;
                    const effectiveGroupActions = group.groupActions ?? config.groupActions;

                    return (
                        <div key={`group-${label}`} className="group/item relative">
                            <button
                                type="button"
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const containerRect = e.currentTarget.closest('.selection-list-inner')?.getBoundingClientRect();
                                    const top = rect.top - (containerRect?.top || 0) - 48; // Adjust for search bar height
                                    onNavigate?.(fullPath, top);
                                }}
                                onClick={() => {
                                    if (isSelectable) {
                                        onSelect({
                                            id: group.id,
                                            name: group.name,
                                            parentId: group.id
                                        });
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[40px] border border-transparent ${isActive
                                    ? 'bg-brand/10 border-brand/20 text-brand shadow-sm'
                                    : isSelectable
                                        ? 'text-[var(--text-muted)] hover:text-brand hover:bg-brand/5 hover:border-brand/10'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                    } ${!isSelectable && !isActive ? 'cursor-default' : ''}`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 truncate pr-4">
                                        <Icon name={group.icon || "folder_code"} dir={group.iconDir || 'icons'} size={14} className={isActive ? 'text-brand' : isSelectable ? 'text-brand/50 group-hover:text-brand' : 'text-brand/40'} />
                                        <span className="truncate">{label}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {isActive && effectiveGroupActions?.map(action => (
                                            <button
                                                type="button"
                                                key={action}
                                                onClick={(e) => { e.stopPropagation(); onAction?.(action, group); }}
                                                className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                            >
                                                <Icon name={action === 'add' ? 'add' : action === 'delete' ? 'delete' : action === 'rename' ? 'edit' : 'content_copy'} size={12} />
                                            </button>
                                        ))}
                                        {(hasChildren || group.items.length > 0) && (
                                            <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    );
                })}

                {/* Optional Separator if both groups and items exist */}
                {groupEntries.length > 0 && sortedItems.length > 0 && (
                    <div className="h-px bg-[var(--border-base)] mx-2 my-1 opacity-50" />
                )}

                {/* Render Items (Schemas) */}
                {sortedItems.map(item => {
                    const isActive = item.id === activeItemId;
                    const isSelectable = item.selectable ?? true;

                    return (
                        <div key={`item-${item.id}`} className="group/item relative">
                            <button
                                type="button"
                                onMouseEnter={() => {
                                    // Clearing sub-panels at deeper levels when hovering an item
                                    onNavigate?.([...breadcrumb, ''], 0);
                                }}
                                onClick={() => isSelectable && onSelect(item)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent flex flex-col justify-center min-h-[40px] ${isActive
                                    ? 'bg-brand/10 border-brand/20 text-brand'
                                    : isSelectable
                                        ? 'text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 hover:border-brand/20'
                                        : 'text-[var(--text-muted)] cursor-default'
                                    }`}
                            >
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-2 truncate flex-1 pr-2">
                                        <Icon name={item.icon || "data_object"} dir={item.iconDir || 'icons'} size={14} className={isActive ? 'text-brand' : 'text-brand/50'} />
                                        <span className={`truncate ${isActive ? 'text-brand' : 'text-[var(--text-main)] group-hover/item:text-brand'}`}>{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {config.allowRename && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onAction?.('rename', item); }}
                                                className="p-1 hover:bg-brand/10 rounded-md transition-all opacity-0 group-hover/item:opacity-100"
                                                title="Rename"
                                            >
                                                <Icon name="drive_file_rename_outline" size={12} className="text-brand" />
                                            </button>
                                        )}
                                        {config.allowDelete && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onAction?.('delete', item); }}
                                                className="p-1 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover/item:opacity-100"
                                                title="Delete"
                                            >
                                                <Icon name="delete" size={12} className="text-red-500" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {item.description && (
                                    <div className="text-[10px] opacity-40 group-hover/item:opacity-60 font-mono mt-0.5 line-clamp-1 truncate max-w-full">
                                        {item.description}
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}

                {groupEntries.length === 0 && sortedItems.length === 0 && (
                    <div className="px-3 py-8 text-center text-[10px] text-[var(--text-muted)] italic opacity-40">
                        Empty
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main SelectionList ---
export const SelectionList: React.FC<SelectionListProps> = ({
    data,
    items = [],
    config = {},
    activeItemId,
    onSelect,
    onAction,
    onClose,
    searchPlaceholder = "Search...",
    position,
    align = 'left'
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [hoveredPath, setHoveredPath] = useState<string[]>([]);
    const [hoveredTops, setHoveredTops] = useState<number[]>([]);
    const navigateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (navigateTimeout.current) clearTimeout(navigateTimeout.current);
        };
    }, []);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchResultsRef = useRef<HTMLDivElement>(null);

    const flatItems = useMemo(() => {
        const result: SelectionItem[] = [...items];
        const traverse = (groups: Record<string, SelectionGroup>) => {
            Object.values(groups).forEach(g => {
                const hasChildren = Object.keys(g.children).length > 0;
                const hasItems = g.items.length > 0;

                // If group is a leaf (selectable as a group), add it as an item for search
                if (!hasChildren && !hasItems) {
                    result.push({
                        id: g.id,
                        name: g.name,
                        parentId: g.id
                    });
                }

                result.push(...g.items);
                traverse(g.children);
            });
        };
        traverse(data);
        return result;
    }, [data, items]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return flatItems.filter(item =>
            item.name.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q)
        );
    }, [flatItems, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => { setHighlightedIndex(0); }, [searchQuery]);

    useHotkeys([
        {
            key: 'enter',
            description: 'Select highlighted item',
            handler: () => {
                if (isSearching && searchResults.length > 0) {
                    onSelect(searchResults[highlightedIndex] || searchResults[0]);
                } else {
                    onClose?.();
                }
            }
        },
        {
            key: 'escape',
            description: 'Close list',
            handler: () => onClose?.()
        }
    ], {
        scopeName: 'Selection List',
        exclusive: true
    });

    useEffect(() => {
        if (isSearching && searchResultsRef.current) {
            const container = searchResultsRef.current;
            const highlightedElement = container.children[highlightedIndex] as HTMLElement;
            if (highlightedElement) {
                highlightedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [highlightedIndex, isSearching]);

    const handleNavigate = (path: string[], top: number) => {
        if (navigateTimeout.current) {
            clearTimeout(navigateTimeout.current);
            navigateTimeout.current = null;
        }

        const isClearing = path.length === 0 || (path.length > 0 && path[path.length - 1] === '');

        if (isClearing) {
            navigateTimeout.current = setTimeout(() => {
                setHoveredPath(path);
                setHoveredTops(prev => {
                    const next = [...prev];
                    next[path.length - 1] = top;
                    return next;
                });
                navigateTimeout.current = null;
            }, 300);
        } else {
            setHoveredPath(path);
            setHoveredTops(prev => {
                const next = [...prev];
                next[path.length - 1] = top;
                return next;
            });
        }
    };



    return createPortal(
        <div className="fixed inset-0 z-[4000] selection-list-container">
            {/* Click-outside backdrop */}
            <div
                className="fixed inset-0 bg-black/5 backdrop-blur-[0.7px] cursor-default"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose?.();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onClose?.();
                }}
            />
            <div
                className={`absolute flex items-start h-full pointer-events-none selection-list-inner ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
                style={{
                    height: 'fit-content',
                    ...(align === 'right' ? {
                        right: position ? window.innerWidth - position.x : 'auto'
                    } : {
                        left: position?.x ?? 'auto'
                    }),
                    top: (() => {
                        if (!position) return 'auto';
                        const menuHeight = isSearching ? 400 : 360; // Approximate max heights
                        const spaceBelow = window.innerHeight - position.y;
                        if (spaceBelow < menuHeight && position.y > menuHeight) {
                            // Open upwards if not enough space below but enough space above
                            return position.y - menuHeight - 16;
                        }
                        return position.y;
                    })()
                }}
            >
                <div
                    className={`${isSearching ? 'w-80' : 'w-64'} border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/80 transition-all duration-300 z-[1] pointer-events-auto shadow-2xl shadow-black/10`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-1 pb-1 pt-1 relative">
                        <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                        <input
                            ref={inputRef}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                    if (isSearching && searchResults.length > 0) {
                                        onSelect(searchResults[highlightedIndex] || searchResults[0]);
                                    } else {
                                        onClose?.();
                                    }
                                } else if (e.key === 'Escape') {
                                    onClose?.();
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setHighlightedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setHighlightedIndex(prev => Math.max(0, prev - 1));
                                }
                            }}
                            placeholder={searchPlaceholder}
                            className="w-full bg-[var(--bg-app)] text-xs text-[var(--text-main)] pl-8 pr-8 py-2.5 rounded-xl border border-[var(--border-base)] outline-none focus:border-brand/50 transition-colors shadow-inner"
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 p-1">
                                <Icon name="close" size={12} />
                            </button>
                        )}
                    </div>

                    {!isSearching && (
                        <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar relative">
                            <SelectionListContent
                                groups={data}
                                items={items}
                                breadcrumb={[]}
                                config={config}
                                activeDescendant={hoveredPath}
                                activeItemId={activeItemId}
                                onNavigate={handleNavigate}
                                onSelect={onSelect}
                                onAction={onAction}
                            />
                        </div>
                    )}

                    {isSearching && (
                        <div
                            ref={searchResultsRef}
                            className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar"
                        >
                            {searchResults.map((item, index) => {
                                const isHighlighted = index === highlightedIndex;
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => onSelect(item)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col justify-center min-h-[40px] group ${isHighlighted
                                            ? 'bg-brand/10 border-brand/20 text-brand shadow-sm'
                                            : 'border-transparent text-[var(--text-main)] hover:bg-brand/5 hover:border-brand/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Icon name={item.icon || "data_object"} dir={item.iconDir || 'icons'} size={14} className={isHighlighted ? 'text-brand' : 'text-brand/50'} />
                                            <span className={`truncate transition-colors ${isHighlighted ? 'text-brand' : 'group-hover:text-brand'}`}>{item.name}</span>
                                        </div>
                                        {item.description && (
                                            <span className={`text-[10px] font-mono mt-0.5 ml-0 line-clamp-1 transition-opacity ${isHighlighted ? 'opacity-70' : 'opacity-40 group-hover:opacity-60'}`} style={{ paddingLeft: '22px' }}>
                                                {item.description}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {!isSearching && hoveredPath.length > 0 && (() => {
                    const subPanels: React.ReactElement[] = [];
                    let cur = data;
                    let depth = 1;

                    for (const seg of hoveredPath) {
                        const group = cur[seg];
                        if (!group) break;

                        const topOffset = hoveredTops[depth - 1] || 0;
                        const panelStyle = {
                            position: 'absolute' as const,
                            ...(align === 'right' ? {
                                right: `${depth * 110}px`,
                            } : {
                                left: `${depth * 110}px`,
                            }),
                            top: `${topOffset + 48}px`,
                            zIndex: depth + 1,
                        };

                        const hasItems = group.items.length > 0;
                        const hasChildren = Object.keys(group.children).length > 0;

                        if (hasChildren || hasItems) {
                            subPanels.push(
                                <div
                                    key={`panel-${depth}`}
                                    style={panelStyle}
                                    className={`pointer-events-auto border border-[var(--border-base)] rounded-2xl p-2 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/80 shadow-2xl animate-in ${align === 'right' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'} duration-200`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <SelectionListContent
                                        groups={group.children}
                                        items={group.items}
                                        breadcrumb={[hoveredPath[depth - 1]]}
                                        config={config}
                                        activeDescendant={hoveredPath}
                                        activeItemId={activeItemId}
                                        onNavigate={handleNavigate}
                                        onSelect={onSelect}
                                        onAction={onAction}
                                    />
                                </div>
                            );
                            if (hasChildren) {
                                cur = group.children;
                                depth++;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    return subPanels;
                })()}
            </div>
        </div>,
        document.body
    );
};
