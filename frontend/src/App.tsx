import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { checkSetup } from "./api/auth";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import RequireAdmin from "./auth/RequireAdmin";
import AppShell from "./components/layout/AppShell";
import Spinner from "./components/ui/Spinner";
import ConsolePage from "./pages/ConsolePage";
import ContainerLogsPage from "./pages/ContainerLogsPage";
import ContainersPage from "./pages/ContainersPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ServicesPage from "./pages/ServicesPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import UsersPage from "./pages/UsersPage";

function useSetupRequired() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  useEffect(() => {
    checkSetup()
      .then((res) => setSetupRequired(res.setup_required))
      .catch(() => setSetupRequired(false));
  }, []);
  return setupRequired;
}

function SetupPageGuard({ children }: { children: React.ReactNode }) {
  const setupRequired = useSetupRequired();
  if (setupRequired === null) {
    return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  }
  if (!setupRequired) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const setupRequired = useSetupRequired();
  if (setupRequired === null) {
    return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>;
  }
  if (setupRequired) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPageGuard><SetupPage /></SetupPageGuard>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <SetupGuard>
              <ProtectedRoute>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="services" element={<ServicesPage />} />
                    <Route path="containers" element={<ContainersPage />} />
                    <Route path="containers/:id/logs" element={<ContainerLogsPage />} />
                    <Route path="console" element={<ConsolePage />} />
                    <Route path="users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
                    <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
                  </Route>
                </Routes>
              </ProtectedRoute>
            </SetupGuard>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
