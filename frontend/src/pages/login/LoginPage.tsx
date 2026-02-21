import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store';
import { ThemeToggle } from '../../shared/ui/theme-toggle/ThemeToggle';


export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading, error } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await login(username, password);
        const { user: updatedUser } = useAuthStore.getState();
        if (updatedUser) {
            navigate(`/${updatedUser.role}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-[var(--text-main)] font-sans selection:bg-brand/30">
            <div className="absolute top-8 right-8">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[400px] rounded-3xl bg-surface-800 border border-[var(--border-base)] p-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in zoom-in duration-500">
                <div className="mb-10 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-lg shadow-brand/5 mx-auto mb-6">
                        <span className="text-3xl">⚡</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)]">Workflow Engine</h1>
                    <p className="mt-3 text-sm text-[var(--text-muted)] opacity-60">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-semibold text-[var(--text-main)] opacity-70 ml-1">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                            required
                            autoComplete="username"
                            placeholder="Enter username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-semibold text-[var(--text-main)] opacity-70 ml-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                            required
                            autoComplete="current-password"
                            placeholder="Enter password"
                        />
                    </div>

                    {error && (
                        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-in shake duration-300">
                            <p className="text-sm text-red-500 text-center font-bold">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 px-4 rounded-2xl bg-brand hover:brightness-110 text-white font-bold shadow-xl shadow-brand/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-3 mt-4"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <>
                                <span>Sign In</span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}


