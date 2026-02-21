import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store';

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
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 selection:bg-brand/30">
            <div className="w-full max-w-[400px] rounded-2xl bg-surface-800 border border-white/10 p-10 shadow-2xl ring-1 ring-white/5">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Workflow Engine</h1>
                    <p className="mt-2 text-sm text-white/50">Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium text-white/70 ml-1">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                            required
                            autoComplete="username"
                            placeholder="Enter username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-white/70 ml-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                            required
                            autoComplete="current-password"
                            placeholder="Enter password"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold shadow-lg shadow-brand/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Signing in...</span>
                            </>
                        ) : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

