import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { checkSetup } from "./api/auth";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import ContainerLogsPage from "./pages/ContainerLogsPage";
import ContainersPage from "./pages/ContainersPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ServicesPage from "./pages/ServicesPage";
import SetupPage from "./pages/SetupPage";
import Spinner from "./components/ui/Spinner";

function SetupGuard({ children }: { children: React.ReactNode }) {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    checkSetup()
      .then((res) => setSetupRequired(res.setup_required))
      .catch(() => setSetupRequired(false));
  }, []);

  if (setupRequired === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (setupRequired) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/*"
            element={
              <SetupGuard>
                <ProtectedRoute>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="services" element={<ServicesPage />} />
                      <Route path="containers" element={<ContainersPage />} />
                      <Route
                        path="containers/:id/logs"
                        element={<ContainerLogsPage />}
                      />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              </SetupGuard>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
