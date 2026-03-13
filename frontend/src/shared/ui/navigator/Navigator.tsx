import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export interface NavigatorContextType {
    push: (component: ReactNode) => void;
    pop: () => void;
    replace: (component: ReactNode) => void;
    canGoBack: boolean;
}

const NavigatorContext = createContext<NavigatorContextType | null>(null);

export function useNavigator() {
    const context = useContext(NavigatorContext);
    if (!context) {
        throw new Error('useNavigator must be used within a NavigatorProvider');
    }
    return context;
}

interface NavigatorProps {
    initialScene: ReactNode;
}

export function Navigator({ initialScene }: NavigatorProps) {
    const [pushedStack, setPushedStack] = useState<{ id: string; component: ReactNode }[]>([]);

    const push = useCallback((component: ReactNode) => {
        setPushedStack(prev => [...prev, { id: Math.random().toString(36).substring(7), component }]);
    }, []);

    const pop = useCallback(() => {
        setPushedStack(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
    }, []);

    const replace = useCallback((component: ReactNode) => {
        setPushedStack(prev => {
            const newStack = [...prev];
            if (newStack.length > 0) {
                newStack[newStack.length - 1] = { id: Math.random().toString(36).substring(7), component };
                return newStack;
            }
            return [{ id: Math.random().toString(36).substring(7), component }];
        });
    }, []);

    const canGoBack = pushedStack.length > 0;

    const value = useMemo(() => ({ 
        push, 
        pop, 
        replace, 
        canGoBack 
    }), [push, pop, replace, canGoBack]);

    const fullStack = useMemo(() => [
        { id: 'initial', component: initialScene },
        ...pushedStack
    ], [initialScene, pushedStack]);

    return (
        <NavigatorContext.Provider value={value}>
            <div className="w-full h-full relative overflow-hidden bg-[var(--bg-app)]">
                {fullStack.map(({ id, component }, index) => {
                    const isActive = index === fullStack.length - 1;
                    return (
                        <div
                            key={id}
                            className={`absolute inset-0 w-full h-full bg-[var(--bg-app)] flex flex-col transition-transform duration-300 ease-in-out ${
                                isActive ? 'translate-x-0' : '-translate-x-full opacity-0 pointer-events-none'
                            }`}
                            style={{ zIndex: index }}
                        >
                            {component}
                        </div>
                    );
                })}
            </div>
        </NavigatorContext.Provider>
    );
}
