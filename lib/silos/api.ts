/**
 * Thin SILOS API client. All data access goes through here so swapping the
 * mock routes for the real backend is a base-URL change
 * (NEXT_PUBLIC_SILOS_API_BASE), not a rewrite.
 */
import type {
  ClaimRequest,
  FeedEvent,
  Fire,
  FirePrediction,
  MessageRequest,
  Org,
  Sector,
  SectorDetail,
} from "@/lib/silos/types";

const BASE = process.env.NEXT_PUBLIC_SILOS_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`SILOS API ${path} failed with ${response.status}.`);
  }
  return (await response.json()) as T;
}

export function getCurrentFire(): Promise<Fire> {
  return request<Fire>("/fires/current");
}

export function getFirePrediction(fireId: string): Promise<FirePrediction> {
  return request<FirePrediction>(`/fires/${encodeURIComponent(fireId)}/prediction`);
}

export function getSectors(): Promise<Sector[]> {
  return request<Sector[]>("/sectors");
}

export function getSectorDetail(id: string): Promise<SectorDetail> {
  return request<SectorDetail>(`/sectors/${encodeURIComponent(id)}`);
}

export function claimSector(id: string, body: ClaimRequest): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/sectors/${encodeURIComponent(id)}/claim`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getOrgs(): Promise<Org[]> {
  return request<Org[]>("/orgs");
}

export function getCommunityFeed(): Promise<FeedEvent[]> {
  return request<FeedEvent[]>("/community/feed");
}

export function postCommunityMessage(body: MessageRequest): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/community/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Demo-only helper: restart the scripted timeline before going on stage. */
export function resetDemo(): Promise<{ demo_started_at: string }> {
  return request<{ demo_started_at: string }>("/demo/reset", { method: "POST" });
}
