import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Toaster } from "react-hot-toast";
import EvalsPage from "./components/evals/EvalsPage.tsx";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PairwiseEvalsPage from "./components/evals/PairwiseEvalsPage";
import RunEvalsPage from "./components/evals/RunEvalsPage.tsx";
import BestOfNEvalsPage from "./components/evals/BestOfNEvalsPage.tsx";
import AllEvalsPage from "./components/evals/AllEvalsPage.tsx";
import { PlaygroundPage } from "./pages/PlaygroundPage.tsx";
import { HistoryPage } from "./pages/HistoryPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { BillingPage } from "./pages/BillingPage.tsx";
import { DashboardLayout } from "./components/dashboard/DashboardLayout.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />

        {/* Dashboard routes with SaaS UI layout */}
        <Route element={<DashboardLayout />}>
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/billing" element={<BillingPage />} />
        </Route>

        {/* Evals routes (old UI) */}
        <Route path="/evals" element={<AllEvalsPage />} />
        <Route path="/evals/single" element={<EvalsPage />} />
        <Route path="/evals/pairwise" element={<PairwiseEvalsPage />} />
        <Route path="/evals/best-of-n" element={<BestOfNEvalsPage />} />
        <Route path="/evals/run" element={<RunEvalsPage />} />
      </Routes>
    </Router>
    <Toaster toastOptions={{ className: "dark:bg-zinc-950 dark:text-white" }} />
  </React.StrictMode>
);
