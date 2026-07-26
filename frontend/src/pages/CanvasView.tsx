import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';

import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

import { EditorHeader } from '@/components/layout/EditorHeader';
import { Button } from '@/components/ui/button';

import { SaveDiagram } from '../../wailsjs/go/workspace/Service';

type ExcalidrawComponentProps = ComponentProps<typeof Excalidraw>;
type OnChangeFn = NonNullable<ExcalidrawComponentProps['onChange']>;
type ExcalidrawElement = Parameters<OnChangeFn>[0][number];
type AppState = Parameters<OnChangeFn>[1];
type BinaryFiles = Parameters<OnChangeFn>[2];
type ExcalidrawInitialDataState = NonNullable<ExcalidrawComponentProps['initialData']>;

interface CanvasViewProps {
  id: string;
}

export function CanvasView({ id }: CanvasViewProps) {
  const [, setLocation] = useLocation();
  const filePath = decodeURIComponent(id);

  const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [excalidrawTheme, setExcalidrawTheme] = useState<'dark' | 'light'>('dark');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    async function loadDiagram() {
      try {
        try {
          const { GetSettings } = await import('../../wailsjs/go/settings/Service');
          const config = await GetSettings();
          setExcalidrawTheme((config.excalidrawTheme as 'dark' | 'light') || 'dark');
        } catch {
          void 0;
        }

        const { GetDiagram } = await import('../../wailsjs/go/workspace/Service');
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
            setInitialData({
              elements: [],
              appState: { collaborators: new Map() },
              files: {},
            });
          }
        } else {
          setInitialData({
            elements: [],
            appState: { collaborators: new Map() },
            files: {},
          });
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load diagram');
          setLoading(false);
        }
      }
    }

    loadDiagram();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (latestContentRef.current) {
          const contentToSave = latestContentRef.current;
          SaveDiagram(filePath, contentToSave).catch(console.error);
        }
      }
    };
  }, [filePath]);

  const performSave = useCallback(
    async (content: string) => {
      setSaving(true);
      try {
        await SaveDiagram(filePath, content);
      } catch (err) {
        console.error('Save error:', err);
      }
      setSaving(false);
    },
    [filePath]
  );

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const content = JSON.stringify(
        {
          type: 'excalidraw',
          version: 2,
          source: '0x-excali',
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

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        performSave(content);
      }, 1500);
    },
    [performSave]
  );

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

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => setLocation('/workspace')}>
          Back to Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <EditorHeader saving={saving} />

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
