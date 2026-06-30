import { useState } from "react";
import { Header } from "./components/Header";
import { GraphPanel } from "./components/GraphPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { SchemaPanel } from "./components/SchemaPanel";
import type { AppTab } from "./types";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const handleSelectProject = (name: string) => {
    setSelectedProject(name);
    setActiveTab("schema");
  };

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        selectedProject={selectedProject}
        onTabChange={setActiveTab}
      />
      <main className="app-main">
        {activeTab === "projects" && (
          <ProjectsPanel
            selectedProject={selectedProject}
            onSelectProject={handleSelectProject}
          />
        )}
        {activeTab === "schema" && <SchemaPanel projectName={selectedProject} />}
        {activeTab === "graph" && <GraphPanel projectName={selectedProject} />}
      </main>
    </div>
  );
}

export default App;
