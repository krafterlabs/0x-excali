import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Excalidraw is a heavy dependency — lazy-load it
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { EditorHeader } from "@/components/layout/EditorHeader";

interface CanvasViewProps {
  id: string; // URL-encoded file path
}

/**
 * CanvasView — Fullscreen Excalidraw canvas for editing diagrams.
 *
 * - Strips all default Excalidraw templates and welcome screens
 * - Loads existing content from the Go backend
 * - Auto-saves on change (debounced 1.5s)
 * - Floating "Back" button to return to dashboard
 */
export function CanvasView({ id }: CanvasViewProps) {
  const [, setLocation] = useLocation();
  const filePath = decodeURIComponent(id);

  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [excalidrawTheme, setExcalidrawTheme] = useState<"dark" | "light">("dark");

  // Refs for debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string>("");

  // Load diagram content on mount
  useEffect(() => {
    let cancelled = false;

    async function loadDiagram() {
      try {
        // Load theme setting
        try {
          const { GetSettings } = await import("../../wailsjs/go/settings/Service");
          const config = await GetSettings();
          setExcalidrawTheme((config.excalidrawTheme as "dark" | "light") || "dark");
        } catch {
          // Use default
        }

        // Load diagram content
        const { GetDiagram } = await import("../../wailsjs/go/workspace/Service");
        const content = await GetDiagram(filePath);

        if (cancelled) return;

        if (content) {
          try {
            const parsed = JSON.parse(content);
            setInitialData({
              elements: parsed.elements || [],
              appState: {
                ...parsed.appState,
                collaborators: new Map(),
              },
              files: parsed.files || {},
            });
          } catch {
            // Invalid JSON — start with blank canvas
            setInitialData({
              elements: [],
              appState: { collaborators: new Map() },
              files: {},
            });
          }
        } else {
          // New/empty diagram
          setInitialData({
            elements: [],
            appState: { collaborators: new Map() },
            files: {},
          });
        }

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load diagram");
          setLoading(false);
        }
      }
    }

    loadDiagram();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      // Save any pending changes before unmounting
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (latestContentRef.current) {
          performSave(latestContentRef.current);
        }
      }
    };
  }, []);

  // Perform the actual save
  const performSave = useCallback(
    async (content: string) => {
      setSaving(true);
      try {
        const { SaveDiagram } = await import("../../wailsjs/go/workspace/Service");
        await SaveDiagram(filePath, content);
      } catch (err) {
        console.error("Save error:", err);
      }
      setSaving(false);
    },
    [filePath]
  );

  // Handle Excalidraw changes (debounced auto-save)
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      // Serialize to .excalidraw format
      const content = JSON.stringify(
        {
          type: "excalidraw",
          version: 2,
          source: "0x-excali",
          elements: elements,
          appState: {
            gridSize: appState.gridSize,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          files: files || {},
        },
        null,
        2
      );

      latestContentRef.current = content;

      // Debounce save: 1.5 seconds after last change
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        performSave(content);
      }, 1500);
    },
    [performSave]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => setLocation("/workspace")}>
          Back to Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <EditorHeader filePath={filePath} saving={saving} />
      
      {/* Excalidraw Container */}
      <div className="relative flex-1 w-full">
        {initialData && (
          <Excalidraw
            initialData={initialData}
            theme={excalidrawTheme}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: { saveFileToDisk: true },
              },
            }}
            onChange={handleChange}
          />
        )}
      </div>
    </div>
  );
}
