import { useEffect } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { Toolbar } from "@/components/Toolbar";
import { ReferenceTable } from "@/components/ReferenceTable";
import { useReferences } from "@/hooks/useReferences";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

function App() {
  const { fetchReferences } = useReferences();

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  return (
    <ThemeProvider>
      <div className="h-screen bg-background text-foreground">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="20" minSize="5" maxSize="80">
            <Sidebar />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="80" minSize="20">
            <main className="h-full flex flex-col overflow-hidden">
              <Toolbar />
              <div className="flex-1 overflow-auto p-4">
                <ReferenceTable />
              </div>
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
