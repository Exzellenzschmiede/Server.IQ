import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { checkSetup } from "./api/auth";
import { AuthProvider } from "./auth/AuthContext";
import { CleanupProvider } from "./context/CleanupContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import RequireAdmin from "./auth/RequireAdmin";
import AppShell from "./components/layout/AppShell";
import Spinner from "./components/ui/Spinner";
import AccessLogPage from "./pages/AccessLogPage";
import AppLogsPage from "./pages/AppLogsPage";
import BandwidthPage from "./pages/BandwidthPage";
import CleanupPage from "./pages/CleanupPage";
import NginxPage from "./pages/NginxPage";
import ConsolePage from "./pages/ConsolePage";
import ContainerLogsPage from "./pages/ContainerLogsPage";
import ContainersPage from "./pages/ContainersPage";
import CronPage from "./pages/CronPage";
import DashboardPage from "./pages/DashboardPage";
import Fail2banPage from "./pages/Fail2banPage";
import FilesPage from "./pages/FilesPage";
import FirewallPage from "./pages/FirewallPage";
import HealthPage from "./pages/HealthPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import PortsPage from "./pages/PortsPage";
import ServicesPage from "./pages/ServicesPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import SslPage from "./pages/SslPage";
import UpdatesPage from "./pages/UpdatesPage";
import UsersPage from "./pages/UsersPage";
import PowerPage from "./pages/PowerPage";

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
      <CleanupProvider>
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
                    <Route path="health" element={<HealthPage />} />
                    <Route path="firewall" element={<FirewallPage />} />
                    <Route path="fail2ban" element={<Fail2banPage />} />
                    <Route path="ports" element={<PortsPage />} />
                    <Route path="ssl" element={<SslPage />} />
                    <Route path="cron" element={<CronPage />} />
                    <Route path="updates" element={<UpdatesPage />} />
                    <Route path="bandwidth" element={<BandwidthPage />} />
                    <Route path="access-log" element={<AccessLogPage />} />
                    <Route path="nginx" element={<NginxPage />} />
                    <Route path="cleanup" element={<RequireAdmin><CleanupPage /></RequireAdmin>} />
                    <Route path="power" element={<RequireAdmin><PowerPage /></RequireAdmin>} />
                    <Route path="files" element={<FilesPage />} />
                    <Route path="users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
                    <Route path="notifications" element={<RequireAdmin><NotificationsPage /></RequireAdmin>} />
                    <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
                    <Route path="logs" element={<RequireAdmin><AppLogsPage /></RequireAdmin>} />
                  </Route>
                </Routes>
              </ProtectedRoute>
            </SetupGuard>
          } />
        </Routes>
      </CleanupProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
