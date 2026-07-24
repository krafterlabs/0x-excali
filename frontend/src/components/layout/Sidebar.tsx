import { useLocation } from "wouter";
import { FolderTree } from "@/components/FolderTree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, FolderPlus, FileText } from "lucide-react";

export interface SidebarProps {
  fileTree: any[];
  onFileClick: (path: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onCreateDiagram: (parentPath?: string) => void;
  onDelete: (path: string) => void;
}

export function Sidebar({
  fileTree,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
}: SidebarProps) {
  const [location] = useLocation();
  const selectedPath = location.startsWith("/workspace/") ? decodeURIComponent(location.slice(11)) : "";

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-border/50 bg-sidebar text-sidebar-foreground">
      <div className="p-3 pb-2">
        <Button
          variant="default"
          className="w-full justify-start gap-2 shadow-sm transition-colors font-medium"
          onClick={() => onCreateDiagram("")}
        >
          <Plus className="h-4 w-4" />
          <span>New diagram</span>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-1.5 flex items-center justify-between group cursor-pointer hover:bg-sidebar-accent/50 rounded-md mx-2 transition-colors">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
            Files
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onCreateDiagram(""); }}
              className="p-1 hover:bg-sidebar-accent hover:text-primary rounded text-muted-foreground transition-colors"
            >
              <FileText className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCreateFolder(""); }}
              className="p-1 hover:bg-sidebar-accent hover:text-primary rounded text-muted-foreground transition-colors"
            >
              <FolderPlus className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="px-2 pb-4">
          <FolderTree
            nodes={fileTree}
            selectedPath={selectedPath}
            onFileClick={onFileClick}
            onCreateFolder={onCreateFolder}
            onCreateDiagram={onCreateDiagram}
            onDelete={onDelete}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
