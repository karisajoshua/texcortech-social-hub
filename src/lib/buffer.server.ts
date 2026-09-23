const BUFFER_API = "https://api.bufferapp.com/1";

export type BufferProfile = {
  id: string;
  service: string;
  service_username?: string;
  formatted_username?: string;
  avatar_https?: string;
  timezone?: string;
  disabled?: boolean;
};

export function getBufferToken(): string | null {
  const token = process.env["BUFFER_ACCESS_TOKEN"];
  return token && token.trim().length > 0 ? token.trim() : null;
}

/** Normalises Buffer's service names onto our platform keys. */
export function normalisePlatform(service: string): string {
  const s = service.toLowerCase();
  if (s === "x" || s === "twitter") return "twitter";
  if (s.startsWith("instagram")) return "instagram";
  if (s.startsWith("facebook")) return "facebook";
  if (s.startsWith("linkedin")) return "linkedin";
  if (s.startsWith("google")) return "youtube";
  return s;
}

async function bufferRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = `${BUFFER_API}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      (body as { error?: string; message?: string } | null)?.error ??
      (body as { message?: string } | null)?.message ??
      `Buffer request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function fetchBufferUser(token: string) {
  return bufferRequest<{ id: string; name?: string; email?: string }>("/user.json", token);
}

export async function fetchBufferProfiles(token: string) {
  return bufferRequest<BufferProfile[]>("/profiles.json", token);
}

export async function createBufferUpdate(
  token: string,
  input: { profileIds: string[]; text: string; scheduledAt?: string | null; mediaUrl?: string | null },
) {
  const form = new URLSearchParams();
  for (const id of input.profileIds) form.append("profile_ids[]", id);
  form.set("text", input.text);
  if (input.scheduledAt) {
    form.set("scheduled_at", String(Math.floor(new Date(input.scheduledAt).getTime() / 1000)));
  } else {
    form.set("now", "true");
  }
  if (input.mediaUrl) form.set("media[photo]", input.mediaUrl);

  return bufferRequest<{
    success: boolean;
    updates?: { id: string; profile_id: string }[];
    message?: string;
  }>("/updates/create.json", token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}
