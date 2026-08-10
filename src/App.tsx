import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import AuditPage from "./pages/AuditPage";
import ChartPage from "./pages/ChartPage";

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded px-3 py-1.5 text-sm transition ${
      isActive ? "bg-edge text-slate-100" : "text-muted hover:text-slate-300"
    }`;

  return (
    <header className="border-b border-edge bg-panel">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <span className="font-semibold tracking-tight text-slate-100">
          Technical Analysis
        </span>
        <nav className="flex gap-1">
          <NavLink to="/audit" className={linkClass}>
            Audit
          </NavLink>
          <NavLink to="/chart" className={linkClass}>
            Charts
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/audit" replace />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="*" element={<Navigate to="/audit" replace />} />
          </Routes>
        </main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs leading-relaxed text-muted">
          Analytics on your own trading records. Not investment advice, not a
          recommendation to trade, and no part of it predicts future returns.
        </footer>
      </div>
    </BrowserRouter>
  );
}
