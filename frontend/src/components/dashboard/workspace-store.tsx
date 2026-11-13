"use client";

/**
 * One client store for every dashboard module.
 *
 * AI employees are read from and written to the FastAPI database through the
 * `/api/employees` Route Handlers; the rest of the modules still render the
 * demo content in `@/content/workspace` until they are wired the same way.
 * The shapes match the /api/v1 responses, so replacing the remaining seeds is
 * the same data-source change.
 */

import * as React from "react";

import type { ImportSummary } from "@/lib/api/employees";
import {
  type Agent,
  type ApiKeyRecord,
  type Campaign,
  type CampaignStatus,
  type Conversation,
  type KnowledgeSource,
  type Lead,
  type LeadStatus,
  type PhoneNumberRecord,
  type TeamMember,
  type WebhookRecord,
  type WorkspaceSettings,
  billing,
  seedApiKeys,
  seedCampaigns,
  seedConversations,
  seedInvoices,
  seedLeads,
  seedNumbers,
  seedSettings,
  seedTeam,
  seedWebhooks,
} from "@/content/workspace";

type AgentsStatus = "loading" | "ready" | "error";

type WorkspaceState = {
  agents: Agent[];
  agentsStatus: AgentsStatus;
  leads: Lead[];
  campaigns: Campaign[];
  numbers: PhoneNumberRecord[];
  conversations: Conversation[];
  invoices: typeof seedInvoices;
  apiKeys: ApiKeyRecord[];
  webhooks: WebhookRecord[];
  team: TeamMember[];
  settings: WorkspaceSettings;
  creditsLimit: number;
  creditsUsed: number;
};

export type NewAgentInput = {
  name: string;
  purpose: string;
  category?: string;
  templateKey?: string;
  languages: string[];
  defaultLanguage: string;
  voice: string;
  voiceId: string;
  model: string;
  modelId: Agent["modelId"];
  greeting: string;
  prompt: string;
  tone?: string;
};

type WorkspaceActions = {
  /** Creates the employee in the database; calls stay off until enabled. */
  addAgent: (input: NewAgentInput) => Promise<Agent>;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  /** Re-read every employee. Call after a duplicate pass or a failed save. */
  refreshAgents: () => Promise<void>;
  /** Turn calls on for an employee, deploying the line if there is none. */
  enableCalling: (id: string) => Promise<Agent>;
  dedupeAgents: () => Promise<number>;
  /** Pull the agents that already exist in your connected account in as employees. */
  importAgents: () => Promise<ImportSummary>;
  addLead: (input: Omit<Lead, "id">) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addCampaign: (input: {
    name: string;
    agentId: string;
    contacts: number;
    schedule: string;
  }) => void;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  addNumber: (input: { number: string; provider: string; mode: PhoneNumberRecord["mode"] }) => void;
  updateNumber: (id: string, patch: Partial<PhoneNumberRecord>) => void;
  addConversation: (input: Omit<Conversation, "id">) => string;
  addKnowledge: (agentId: string, source: Omit<KnowledgeSource, "id" | "addedAt">) => string;
  setKnowledgeStatus: (
    agentId: string,
    sourceId: string,
    status: KnowledgeSource["status"],
  ) => void;
  removeKnowledge: (agentId: string, sourceId: string) => void;
  buyCredits: (amount: number) => void;
  addApiKey: (label: string) => string;
  revokeApiKey: (id: string) => void;
  addWebhook: (url: string, events: string[]) => void;
  toggleWebhook: (id: string) => void;
  updateTeamRole: (id: string, role: TeamMember["role"]) => void;
  inviteMember: (email: string, role: TeamMember["role"]) => void;
  saveSettings: (patch: Partial<WorkspaceSettings>) => void;
};

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const initialState: WorkspaceState = {
  agents: [],
  agentsStatus: "loading",
  leads: seedLeads,
  campaigns: seedCampaigns,
  numbers: seedNumbers,
  conversations: seedConversations,
  invoices: seedInvoices,
  apiKeys: seedApiKeys,
  webhooks: seedWebhooks,
  team: seedTeam,
  settings: seedSettings,
  creditsLimit: billing.creditsIncluded,
  creditsUsed: billing.creditsUsed,
};

const WorkspaceContext = React.createContext<WorkspaceStore | null>(null);

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

/**
 * Knowledge sources, actions and outcomes still live only in the browser -
 * they have no column yet - so a server round-trip must not wipe them.
 */
function mergeLocal(current: Agent | undefined, next: Agent): Agent {
  if (!current) return next;
  return {
    ...next,
    knowledge: current.knowledge,
    actions: current.actions,
    outcomes: current.outcomes,
  };
}

type AgentPayload = { agent?: Agent; items?: Agent[]; error?: { message?: string } };

async function readAgent(response: Response, fallback: string): Promise<Agent> {
  const body = (await response.json().catch(() => null)) as AgentPayload | null;
  if (!response.ok || !body?.agent) throw new Error(body?.error?.message ?? fallback);
  return body.agent;
}

async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch("/api/employees", { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as AgentPayload | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "Could not load employees.");
  return body?.items ?? [];
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WorkspaceState>(initialState);

  const applyAgents = React.useCallback((items: Agent[]) => {
    setState((prev) => {
      const known = new Map(prev.agents.map((agent) => [agent.id, agent]));
      return {
        ...prev,
        agents: items.map((item) => mergeLocal(known.get(item.id), item)),
        agentsStatus: "ready",
      };
    });
  }, []);

  // The list is read once when the shell mounts; `refreshAgents` is what the
  // screens call afterwards (after a duplicate pass, or a refused save).
  React.useEffect(() => {
    let cancelled = false;
    fetchAgents()
      .then((items) => {
        if (!cancelled) applyAgents(items);
      })
      .catch((error: unknown) => {
        console.error("[workspace] load employees", error);
        if (!cancelled) setState((prev) => ({ ...prev, agentsStatus: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, [applyAgents]);

  const refreshAgents = React.useCallback(async () => {
    try {
      applyAgents(await fetchAgents());
    } catch (error) {
      console.error("[workspace] load employees", error);
      setState((prev) => ({ ...prev, agentsStatus: "error" }));
    }
  }, [applyAgents]);

  const addAgent = React.useCallback(async (input: NewAgentInput): Promise<Agent> => {
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const agent = await readAgent(response, "The employee could not be created.");
    setState((prev) => ({ ...prev, agents: [agent, ...prev.agents] }));
    return agent;
  }, []);

  const updateAgent = React.useCallback(
    (id: string, patch: Partial<Agent>) => {
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.id === id ? { ...agent, ...patch } : agent,
        ),
      }));

      // Fire and forget: the row is already updated on screen, and a refusal
      // re-reads the server so the UI never keeps an edit that was rejected.
      void fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then(async (response) => {
          const agent = await readAgent(response, "The change could not be saved.");
          setState((prev) => ({
            ...prev,
            agents: prev.agents.map((current) =>
              current.id === id ? mergeLocal(current, agent) : current,
            ),
          }));
        })
        .catch((error: unknown) => {
          console.error("[workspace] save employee", error);
          void refreshAgents();
        });
    },
    [refreshAgents],
  );

  const enableCalling = React.useCallback(async (id: string): Promise<Agent> => {
    const response = await fetch(`/api/employees/${id}`, { method: "POST" });
    const agent = await readAgent(response, "Calls could not be enabled.");
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((current) =>
        current.id === id ? mergeLocal(current, agent) : current,
      ),
    }));
    return agent;
  }, []);

  const dedupeAgents = React.useCallback(async (): Promise<number> => {
    const response = await fetch("/api/employees/dedupe", { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | { duplicates?: number; error?: { message?: string } }
      | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "The duplicate check failed.");
    await refreshAgents();
    return Number(body?.duplicates ?? 0);
  }, [refreshAgents]);

  const importAgents = React.useCallback(async (): Promise<ImportSummary> => {
    const response = await fetch("/api/employees/import", { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | (ImportSummary & { error?: { message?: string } })
      | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Your connected account could not be read.");
    await refreshAgents();
    return {
      fetched: Number(body?.fetched ?? 0),
      created: Number(body?.created ?? 0),
      updated: Number(body?.updated ?? 0),
      skipped: Number(body?.skipped ?? 0),
      items: body?.items ?? [],
    };
  }, [refreshAgents]);

  const addLead = React.useCallback((input: Omit<Lead, "id">) => {
    setState((prev) => ({
      ...prev,
      leads: [{ ...input, id: uid("lead") }, ...prev.leads],
    }));
  }, []);

  const updateLead = React.useCallback((id: string, patch: Partial<Lead>) => {
    setState((prev) => ({
      ...prev,
      leads: prev.leads.map((lead) =>
        lead.id === id ? { ...lead, ...patch } : lead,
      ),
    }));
  }, []);

  const addCampaign = React.useCallback(
    (input: { name: string; agentId: string; contacts: number; schedule: string }) => {
      const campaign: Campaign = {
        id: uid("camp"),
        name: input.name,
        agentId: input.agentId,
        contacts: input.contacts,
        schedule: input.schedule,
        status: "Running",
        completed: 0,
        answered: 0,
        failed: 0,
        leads: 0,
        createdAt: "Today",
      };
      setState((prev) => ({ ...prev, campaigns: [campaign, ...prev.campaigns] }));
    },
    [],
  );

  const setCampaignStatus = React.useCallback(
    (id: string, status: CampaignStatus) => {
      setState((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((campaign) =>
          campaign.id === id ? { ...campaign, status } : campaign,
        ),
      }));
    },
    [],
  );

  const addNumber = React.useCallback(
    (input: { number: string; provider: string; mode: PhoneNumberRecord["mode"] }) => {
      setState((prev) => ({
        ...prev,
        numbers: [
          {
            id: uid("num"),
            number: input.number,
            provider: input.provider,
            mode: input.mode,
            status: "Pending",
            agentId: null,
            welcome: "",
          },
          ...prev.numbers,
        ],
      }));
    },
    [],
  );

  const updateNumber = React.useCallback(
    (id: string, patch: Partial<PhoneNumberRecord>) => {
      setState((prev) => ({
        ...prev,
        numbers: prev.numbers.map((record) =>
          record.id === id ? { ...record, ...patch } : record,
        ),
      }));
    },
    [],
  );

  const addConversation = React.useCallback((input: Omit<Conversation, "id">) => {
    const id = uid("conv");
    setState((prev) => ({
      ...prev,
      conversations: [{ ...input, id }, ...prev.conversations],
      creditsUsed: prev.creditsUsed + input.credits,
    }));
    return id;
  }, []);

  const addKnowledge = React.useCallback(
    (agentId: string, source: Omit<KnowledgeSource, "id" | "addedAt">) => {
      const entry: KnowledgeSource = {
        ...source,
        id: uid("k"),
        addedAt: "Today",
      };
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.id === agentId
            ? { ...agent, knowledge: [entry, ...agent.knowledge] }
            : agent,
        ),
      }));
      return entry.id;
    },
    [],
  );

  const setKnowledgeStatus = React.useCallback(
    (agentId: string, sourceId: string, status: KnowledgeSource["status"]) => {
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                knowledge: agent.knowledge.map((item) =>
                  item.id === sourceId ? { ...item, status } : item,
                ),
              }
            : agent,
        ),
      }));
    },
    [],
  );

  const removeKnowledge = React.useCallback((agentId: string, sourceId: string) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              knowledge: agent.knowledge.filter((item) => item.id !== sourceId),
            }
          : agent,
      ),
    }));
  }, []);

  const buyCredits = React.useCallback((amount: number) => {
    setState((prev) => ({ ...prev, creditsLimit: prev.creditsLimit + amount }));
  }, []);

  const addApiKey = React.useCallback((label: string) => {
    const raw = Math.random().toString(36).slice(2, 10);
    const prefix = `sk_live_${raw.slice(0, 4)}`;
    setState((prev) => ({
      ...prev,
      apiKeys: [
        { id: uid("key"), label, prefix, createdAt: "Today", lastUsed: "Never" },
        ...prev.apiKeys,
      ],
    }));
    return `sk_live_${raw}`;
  }, []);

  const revokeApiKey = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      apiKeys: prev.apiKeys.filter((key) => key.id !== id),
    }));
  }, []);

  const addWebhook = React.useCallback((url: string, events: string[]) => {
    setState((prev) => ({
      ...prev,
      webhooks: [{ id: uid("wh"), url, events, status: "Active" }, ...prev.webhooks],
    }));
  }, []);

  const toggleWebhook = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      webhooks: prev.webhooks.map((hook) =>
        hook.id === id
          ? { ...hook, status: hook.status === "Active" ? "Disabled" : "Active" }
          : hook,
      ),
    }));
  }, []);

  const updateTeamRole = React.useCallback((id: string, role: TeamMember["role"]) => {
    setState((prev) => ({
      ...prev,
      team: prev.team.map((member) =>
        member.id === id ? { ...member, role } : member,
      ),
    }));
  }, []);

  const saveSettings = React.useCallback((patch: Partial<WorkspaceSettings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const inviteMember = React.useCallback(
    (email: string, role: TeamMember["role"]) => {
      const handle = email.split("@")[0] ?? email;
      const name = handle
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const member: TeamMember = {
        id: uid("tm"),
        name: name || email,
        email,
        role,
        status: "Invited",
      };
      setState((prev) => ({ ...prev, team: [...prev.team, member] }));
    },
    [],
  );

  const value = React.useMemo<WorkspaceStore>(
    () => ({
      ...state,
      addAgent,
      updateAgent,
      refreshAgents,
      enableCalling,
      dedupeAgents,
      importAgents,
      addLead,
      updateLead,
      addCampaign,
      setCampaignStatus,
      addNumber,
      updateNumber,
      addConversation,
      addKnowledge,
      setKnowledgeStatus,
      removeKnowledge,
      buyCredits,
      addApiKey,
      revokeApiKey,
      addWebhook,
      toggleWebhook,
      updateTeamRole,
      inviteMember,
      saveSettings,
    }),
    [
      state,
      addAgent,
      updateAgent,
      refreshAgents,
      enableCalling,
      dedupeAgents,
      importAgents,
      addLead,
      updateLead,
      addCampaign,
      setCampaignStatus,
      addNumber,
      updateNumber,
      addConversation,
      addKnowledge,
      setKnowledgeStatus,
      removeKnowledge,
      buyCredits,
      addApiKey,
      revokeApiKey,
      addWebhook,
      toggleWebhook,
      updateTeamRole,
      inviteMember,
      saveSettings,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const store = React.useContext(WorkspaceContext);
  if (!store) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  }
  return store;
}

/** Convenience lookups shared by the module screens. */
export function useAgentName(agentId: string | null) {
  const { agents } = useWorkspace();
  return agents.find((agent) => agent.id === agentId)?.name ?? "Unassigned";
}

export const LEAD_TONE: Record<LeadStatus, "default" | "secondary" | "success" | "warning" | "danger"> = {
  New: "default",
  Contacted: "secondary",
  Qualified: "success",
  Appointment: "warning",
  "Not interested": "danger",
};

export const CAMPAIGN_TONE: Record<CampaignStatus, "default" | "secondary" | "success" | "warning"> = {
  Running: "success",
  Paused: "warning",
  Completed: "secondary",
  Draft: "default",
};
