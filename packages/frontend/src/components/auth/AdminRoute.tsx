import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@tradeapp/shared';
import type { ReactNode } from 'react';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || user.role !== UserRole.ADMIN) return <Navigate to="/" replace />;

  return <>{children}</>;
}
