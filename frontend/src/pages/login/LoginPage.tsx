import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store';
import { Icon } from '../../shared/ui/icon';
import { ThemeToggle } from '../../shared/ui/theme-toggle/ThemeToggle';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch {
            alert('Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-900 p-4 font-sans">
            <div className="w-full max-w-[400px] rounded-3xl bg-surface-800 border border-[var(--border-base)] p-10 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in zoom-in duration-500">
                <div className="mb-10 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-lg shadow-brand/5 mx-auto mb-6">
                        <Icon name="bolt" size={32} className="text-brand" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)]">Workflow Engine</h1>
                    <p className="mt-3 text-sm text-[var(--text-muted)] opacity-60">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold"
                            placeholder="your.username"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-bold"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-4 rounded-2xl bg-brand hover:brightness-110 text-white font-bold shadow-xl shadow-brand/20 transition-all active:scale-[0.98] mt-4"
                    >
                        Sign In
                    </button>
                </form>

                <div className="mt-10 pt-8 border-t border-[var(--border-base)] flex items-center justify-between">
                    <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">System Access Control</div>
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
}
