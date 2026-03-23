import React, { useMemo } from 'react';
import { useHotkeysContext } from '../../lib/hotkeys/HotkeysContext';

// Helper to determine order weight
const getWeight = (key: string): number => {
    const lower = key.toLowerCase();
    if (lower === 'escape' || lower === 'esc') return 1;
    if (lower === 'enter') return 2;
    if (/^f\d+$/.test(lower)) return 3;
    if (lower.includes('ctrl') || lower.includes('cmd') || lower.includes('meta') || lower.includes('alt')) return 5;
    return 4; // Other keys
};

// Helper to extract numerical value from F-keys for secondary sorting
const getSecondaryWeight = (key: string): number => {
    const lower = key.toLowerCase();
    const fMatch = lower.match(/^f(\d+)$/);
    if (fMatch) return parseInt(fMatch[1], 10);
    return 0;
};

const formatGroupedKeys = (keys: string[]): string => {
    const lowerKeys = keys.map(k => k.toLowerCase());
    const usedKeys = new Set<string>();
    const mergedPairs: string[] = [];

    // Group matching ctrl+ and cmd+ keys
    const ctrlKeys = lowerKeys.filter(k => k.startsWith('ctrl+'));
    const cmdKeys = new Set(lowerKeys.filter(k => k.startsWith('cmd+')));

    for (const c of ctrlKeys) {
        const suffix = c.slice(5);
        if (cmdKeys.has(`cmd+${suffix}`)) {
            mergedPairs.push(`ctrl/cmd+${suffix}`);
            usedKeys.add(c);
            usedKeys.add(`cmd+${suffix}`);
        }
    }

    // Retain remaining unique keys (e.g. F5, Esc) formatting them properly
    const remainingKeys = lowerKeys
        .filter(k => !usedKeys.has(k))
        .map(k => /^f\d+$/.test(k) ? k.toUpperCase() : k);

    // Join all formatted keys into one string (e.g. "F5 / ctrl/cmd+r")
    return [...remainingKeys, ...mergedPairs].join(' / ');
};

export const AppFooter: React.FC = () => {
    const { scopes } = useHotkeysContext();

    const displayGroups = useMemo(() => {
        const activeHotkeys: Array<{ key: string, description: string }> = [];
        const seenKeys = new Set<string>();
        let allowedKeys: Set<string> | undefined = undefined;

        // Traverse scopes top-down (same logic as HotkeysDebug)
        for (let i = scopes.length - 1; i >= 0; i--) {
            const scope = scopes[i];
            
            if (scope.hotkeys) {
                for (const hk of scope.hotkeys) {
                    if (hk.enabled === false) continue;
                    const lowerKey = hk.key.toLowerCase();
                    
                    if (allowedKeys !== undefined && !allowedKeys.has(lowerKey)) {
                        continue;
                    }

                    if (!seenKeys.has(lowerKey)) {
                        seenKeys.add(lowerKey);
                        activeHotkeys.push({
                            key: hk.key,
                            description: hk.description
                        });
                    }
                }
            }

            if (scope.exclusive) {
                const scopeExceptions = new Set((scope.exclusiveExceptions || []).map(e => e.toLowerCase()));
                
                if (allowedKeys === undefined) {
                    allowedKeys = scopeExceptions;
                } else {
                    const newAllowed = new Set<string>();
                    for (const k of allowedKeys) {
                        if (scopeExceptions.has(k)) {
                            newAllowed.add(k);
                        }
                    }
                    allowedKeys = newAllowed;
                }

                if (allowedKeys.size === 0) {
                    break;
                }
            }
        }

        // Group by description
        const grouped = new Map<string, string[]>();
        for (const hk of activeHotkeys) {
            const existing = grouped.get(hk.description) || [];
            if (!existing.includes(hk.key)) {
                existing.push(hk.key);
            }
            grouped.set(hk.description, existing);
        }

        const groupsArray = Array.from(grouped.entries()).map(([description, keys]) => {
            // Find minimum weight among keys for sorting
            const weights = keys.map(getWeight);
            const minWeight = Math.min(...weights);

            // For secondary weight, we take the one from the key that has the minimum primary weight
            // (or if multiple have the same min weight, the minimum among those)
            const secondaryWeights = keys
                .filter((_, idx) => weights[idx] === minWeight)
                .map(getSecondaryWeight);
            const minSecondaryWeight = Math.min(...secondaryWeights);

            return {
                description,
                keys,
                formattedKey: formatGroupedKeys(keys),
                weight: minWeight,
                secondaryWeight: minSecondaryWeight
            };
        });

        // Sort by weight
        groupsArray.sort((a, b) => {
            if (a.weight !== b.weight) return a.weight - b.weight;
            return a.secondaryWeight - b.secondaryWeight;
        });

        return groupsArray;
    }, [scopes]);

    const isVisible = displayGroups.length > 0;

    return (
        <div 
            className={`fixed bottom-0 h-8 bg-[var(--bg-footer)] border-t border-[var(--border-footer)] z-[90] flex items-center px-4 shadow-xl select-none transition-all duration-500 ease-in-out
                ${isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
            style={{
                left: 'var(--sidebar-width, 0px)',
                width: 'calc(100% - var(--sidebar-width, 0px))'
            }}
        >
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar w-full text-xs">
                {displayGroups.map((group, idx) => (
                    <div key={`${group.description}-${idx}`} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                        <kbd className="font-mono font-medium text-[var(--text-footer-kbd)] bg-[var(--bg-footer-kbd)] px-1.5 py-0.5 rounded border border-[var(--border-footer-kbd)]">
                            {group.formattedKey}
                        </kbd>
                        <span className="text-slate-500 font-medium">
                            {group.description}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
