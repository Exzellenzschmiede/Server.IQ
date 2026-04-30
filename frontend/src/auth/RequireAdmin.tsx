import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Spinner from "../components/ui/Spinner";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  }
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
