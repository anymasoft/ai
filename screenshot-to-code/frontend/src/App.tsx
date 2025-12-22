import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/landing/landing-page";
import { LoginPage } from "./pages/LoginPage";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { BillingPage } from "./pages/BillingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard routes with layout */}
        <Route element={<DashboardLayout />}>
          <Route path="/app/playground" element={<PlaygroundPage />} />
          <Route path="/app/history" element={<HistoryPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/app/billing" element={<BillingPage />} />
        </Route>

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
