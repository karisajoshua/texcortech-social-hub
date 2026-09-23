import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapWorkspace } from "./tenant.functions";

export type Role = "owner" | "admin" | "approver" | "editor" | "viewer";

export type Workspace = {
  organization: { id: string; name: string; slug: string; timezone: string };
  role: Role;
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspaceQuery() {
  const bootstrap = useServerFn(bootstrapWorkspace);
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => (await bootstrap()) as Workspace,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function canApprove(role: Role) {
  return role === "owner" || role === "admin" || role === "approver";
}

export function canEdit(role: Role) {
  return role !== "viewer";
}

export function canManageIntegrations(role: Role) {
  return role === "owner" || role === "admin";
}
