import React from 'react';
import { useHotkeysContext } from '../../lib/hotkeys/HotkeysContext';

export const HotkeysDebug: React.FC = () => {
    const { scopes } = useHotkeysContext();

    // Calculate active hotkeys (top-down) so shadowed hotkeys are hidden
    const activeHotkeys: Array<{ key: string, description: string }> = [];
    const seenKeys = new Set<string>();

    let allowedKeys: Set<string> | undefined = undefined;

    // DEBUG LOG ADDED TO TRACE BUG
    console.log('[HotkeysDebug] Current scopes stack:', scopes.map(s => ({ name: s.name, exec: s.exclusive, hotkeys: s.hotkeys.map(h => h.key) })));

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

    if (activeHotkeys.length === 0) {
        return null;
    }

    // Sort or just reverse so they display bottom-up as requested
    // "если клавиш много выводим с низу вверх"
    // activeHotkeys were collected top-down context, let's reverse them so the highest priority (modal) is at bottom or top?
    // Let's just reverse the array to display bottom-up logically.
    const displayHotkeys = [...activeHotkeys].reverse();

    return (
        <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none flex flex-col gap-2 items-end">
            {displayHotkeys.map((hk, idx) => (
                <div 
                    key={`${hk.key}-${idx}`}
                    className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-lg"
                >
                    <span className="text-slate-300 text-sm font-medium">
                        {hk.description}
                    </span>
                    <kbd className="px-2 py-1 bg-slate-800 text-slate-200 text-xs font-mono font-bold rounded border border-slate-700 shadow-sm min-w-[2rem] text-center">
                        {hk.key}
                    </kbd>
                </div>
            ))}
        </div>
    );
};
