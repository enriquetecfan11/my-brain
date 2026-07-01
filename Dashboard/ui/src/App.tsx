import { useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { Header } from "./components/Header";
import { GraphPanel } from "./components/GraphPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { SchemaPanel } from "./components/SchemaPanel";
import type { AppTab } from "./types";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [chatSeed, setChatSeed] = useState<string | null>(null);

  const handleSelectProject = (name: string) => {
    setSelectedProject(name);
    setActiveTab("schema");
  };

  const handleAskInChat = (message: string) => {
    setChatSeed(message);
    setActiveTab("chat");
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
        {activeTab === "graph" && (
          <GraphPanel projectName={selectedProject} onAskInChat={handleAskInChat} />
        )}
        {activeTab === "chat" && (
          <ChatPanel
            projectName={selectedProject}
            seedMessage={chatSeed}
            onSeedConsumed={() => setChatSeed(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
