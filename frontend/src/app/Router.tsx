import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store';
import LoginPage from '../pages/login/LoginPage';
import AdminPage from '../pages/admin/AdminPage';
import ManagerPage from '../pages/manager/ManagerPage';
import { ReactFlowProvider } from 'reactflow';
import ClientPage from '../pages/client/ClientPage';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

function ProtectedRoute({
    children,
    allowedRoles,
}: ProtectedRouteProps) {
    const { user, token } = useAuthStore();

    if (!token) return <Navigate to="/login" replace />;
    if (user && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;

    return children;
}

function HomeRedirect() {
    const { user, token } = useAuthStore();
    if (!token || !user) return <Navigate to="/login" replace />;

    switch (user.role) {
        case 'admin': return <Navigate to="/admin" replace />;
        case 'manager': return <Navigate to="/manager" replace />;
        case 'client': return <Navigate to="/client" replace />;
        default: return <Navigate to="/login" replace />;
    }
}

export default function Router() {
    const { restoreSession } = useAuthStore();

    React.useEffect(() => {
        restoreSession();
    }, [restoreSession]);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/manager/*"
                    element={
                        <ProtectedRoute allowedRoles={['manager']}>
                            <ReactFlowProvider>
                                <ManagerPage />
                            </ReactFlowProvider>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/client/*"
                    element={
                        <ProtectedRoute allowedRoles={['client']}>
                            <ClientPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
