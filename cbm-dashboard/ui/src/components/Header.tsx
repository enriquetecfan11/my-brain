import type { AppTab } from "../types";

const TABS: { id: AppTab; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "schema", label: "Schema" },
  { id: "graph", label: "Graph" },
];

interface HeaderProps {
  activeTab: AppTab;
  selectedProject: string | null;
  onTabChange: (tab: AppTab) => void;
}

export function Header({ activeTab, selectedProject, onTabChange }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <h1>cbm-dashboard</h1>
        {selectedProject ? (
          <span className="app-header__project">Project: {selectedProject}</span>
        ) : (
          <span className="app-header__project app-header__project--empty">
            No project selected
          </span>
        )}
      </div>
      <nav className="app-tabs" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`app-tabs__btn${activeTab === tab.id ? " app-tabs__btn--active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
