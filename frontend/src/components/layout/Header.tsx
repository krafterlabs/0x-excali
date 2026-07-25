import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Link } from "wouter";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { database } from "../../../wailsjs/go/models";

export interface HeaderProps {
  workspace: database.Workspace | null;
  activeFile?: string;
  syncStatus: "synced" | "syncing" | "error" | "offline";
  dirtyCount: number;
  onSync: () => void | Promise<void>;
}

export function Header({ workspace, activeFile, syncStatus, dirtyCount, onSync }: HeaderProps) {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-background px-4">
        <div className="flex items-center gap-2 overflow-hidden mr-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                {activeFile ? (
                  <BreadcrumbLink render={<Link href="/workspace" />}>
                    {workspace?.name.split("/")[1] || "Workspace"}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{workspace?.name.split("/")[1] || "Workspace"}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {activeFile && (
                <>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeFile.split("/").pop()}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              onClick={onSync}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              {syncStatus === "syncing" ? (
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              ) : syncStatus === "error" ? (
                <CloudOff className="h-4 w-4 text-destructive" />
              ) : dirtyCount > 0 ? (
                <div className="relative">
                  <Cloud className="h-4 w-4 text-amber-500" />
                  <span className="absolute -right-1 -top-1 flex h-2 w-2 rounded-full bg-amber-500" />
                </div>
              ) : (
                <Cloud className="h-4 w-4 text-green-500" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {syncStatus === "syncing"
                ? "Syncing..."
                : dirtyCount > 0
                  ? `${dirtyCount} pending changes`
                  : "Synced"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </>
  );
}
