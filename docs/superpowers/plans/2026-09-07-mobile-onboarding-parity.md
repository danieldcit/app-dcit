# Mobile Onboarding Parity + Expandable Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/mobile`'s onboarding experience to full parity with `apps/web` (welcome video, team section, contract signing, access checklist, unlock dialogs, gestor/rh team view, navigation gate), and add Onboarding + Notificações as quick-access shortcuts in an expandable bottom tab bar.

**Architecture:** Pure frontend work in `apps/mobile` — every backend endpoint already exists and is already consumed by `apps/web`. New `lib/*-api.ts` client functions wrap the missing endpoints; new presentational components render each onboarding task type; `app/onboarding.tsx` gains a role branch (colaborador tasks vs. gestor/rh team list); `(tabs)/_layout.tsx` gains a client-side navigation gate and a custom animated tab bar.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest + `@testing-library/react-native` + `expo-router/testing-library`, `react-native-webview`, `expo-document-picker`, `@react-native-async-storage/async-storage` (already installed).

**Spec:** [`docs/superpowers/specs/2026-09-07-mobile-onboarding-parity-design.md`](../specs/2026-09-07-mobile-onboarding-parity-design.md)

## Global Constraints

- No changes to `apps/api` or the Prisma schema — every endpoint used here already exists and is already consumed by `apps/web`.
- Onboarding and Notificações stay as `Stack` routes outside the `(tabs)` group — the expandable bar only adds shortcuts to them, it does not turn them into `Tabs.Screen` entries (avoids breaking existing links from `perfil.tsx`, `busca.tsx`, and the bell icon in `(tabs)/index.tsx`).
- The onboarding gate is fail-open: any error, timeout, or missing response from `/onboarding/meu-status` must never block navigation — treat as unlocked.
- Only `role === "colaborador"` is ever redirected by the gate; `gestor`/`rh` are never restricted.
- Full access is only ever granted by an explicit gestor/rh action (`grantOnboardingFullAccess`) — never automatically, matching the current (post-revert) backend behavior in `apps/api/src/onboarding/onboarding.service.ts`.
- Follow existing `lib/*-api.ts` conventions exactly: `authedFetch` helper, every function returns `T | null` and swallows exceptions in a `try { } catch { return null; }` block — never throws.
- Follow existing test conventions: `renderRouter("src/app", { initialUrl: ... })` from `expo-router/testing-library`, `globalThis.fetch = jest.fn()` per file with a `beforeEach` implementation keyed on URL, `saveSessionToken(...)` from `@/lib/session` before each test.

---

## File Structure

New files:
- `apps/mobile/src/lib/team-members.ts` — team roster data (mirrors web's `team-members.ts`).
- `apps/mobile/src/assets/images/team/*.jpg` — 14 photos copied from `apps/web/public/team/`.
- `apps/mobile/src/components/team-section.tsx` — "Conhecer o time" grid + manual complete toggle.
- `apps/mobile/src/components/welcome-video-player.tsx` — WebView-embedded YouTube player with resume + anti-skip.
- `apps/mobile/src/components/contract-box.tsx` — pick + upload signed contract PDF (shared by Documentos and Onboarding).
- `apps/mobile/src/components/access-checklist-section.tsx` — per-item IT access toggle list.
- `apps/mobile/src/components/onboarding-celebration-modal.tsx` — shared modal for the two onboarding dialogs.
- `apps/mobile/src/components/expandable-tab-bar.tsx` — custom animated tab bar.
- `apps/mobile/src/app/onboarding-detalhe.tsx` — gestor/rh modal screen for one colaborador's onboarding detail + grant action.
- Test files mirroring each of the above under `apps/mobile/src/__tests__/...` (exact paths given per task).

Modified files:
- `apps/mobile/package.json` — new dependencies.
- `apps/mobile/.env` — new `EXPO_PUBLIC_WEB_APP_URL`.
- `apps/mobile/src/constants/api.ts` — new `WEB_APP_URL` constant.
- `apps/mobile/src/lib/onboarding-api.ts` — extended types + 4 new functions.
- `apps/mobile/src/lib/documentos-api.ts` — 2 new functions.
- `apps/mobile/src/app/onboarding.tsx` — full rewrite: new task sections, dialogs, role branch.
- `apps/mobile/src/app/(tabs)/documentos.tsx` — new "Contrato" category.
- `apps/mobile/src/app/(tabs)/_layout.tsx` — navigation gate + custom tab bar wiring.
- `apps/mobile/src/__tests__/app/tabs-layout.test.tsx` — updated accessibility-label expectations for the custom bar, new gate tests.

---

### Task 1: Add new dependencies

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/.env`
- Modify: `apps/mobile/src/constants/api.ts`

**Interfaces:**
- Produces: `WEB_APP_URL` (exported string constant from `@/constants/api`), used by Task 6 (`contract-box.tsx`).

- [ ] **Step 1: Install the two new Expo-compatible packages**

Run from `apps/mobile`:

```bash
cd apps/mobile
npx expo install expo-document-picker react-native-webview
```

This resolves and pins the exact versions compatible with the installed Expo SDK (57) — do not hand-pick version numbers.

- [ ] **Step 2: Verify the dependencies landed in package.json**

Run: `grep -E "expo-document-picker|react-native-webview" apps/mobile/package.json`
Expected: both lines present with version specifiers.

- [ ] **Step 3: Add the web app URL env var and constant**

Append to `apps/mobile/.env` (same LAN-IP convention as `EXPO_PUBLIC_API_URL`, one line below it):

```
EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.9:3001
```

Modify `apps/mobile/src/constants/api.ts` (append below the existing `API_URL` export):

```typescript
// Same LAN-address requirement as API_URL — a physical device needs the
// web app's real network address, not "localhost", to open static assets
// like the contract template PDF served from apps/web/public.
export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "http://localhost:3001";
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/pnpm-lock.yaml apps/mobile/.env apps/mobile/src/constants/api.ts
git commit -m "chore(mobile): add react-native-webview and expo-document-picker"
```

(If the workspace lockfile lives at the repo root instead of `apps/mobile/pnpm-lock.yaml`, add `pnpm-lock.yaml` from the root instead — check with `git status` before committing.)

---

### Task 2: Extend `lib/onboarding-api.ts` with the missing endpoints

**Files:**
- Modify: `apps/mobile/src/lib/onboarding-api.ts`
- Test: `apps/mobile/src/__tests__/lib/onboarding-api.test.ts` (new)

**Interfaces:**
- Produces:
  - `OnboardingTaskRecord` gains `requiresVideo: boolean`, `showsTeam: boolean`, `requiresContract: boolean`, `requiresAccessChecklist: boolean`.
  - `OnboardingTasksResponse` gains `completedAccessItems: string[]`, `fullAccessGrantedAt: string | null`.
  - `fetchOnboardingStatus(token: string): Promise<{ unlocked: boolean } | null>`
  - `toggleOnboardingAccessItem(token: string, item: string): Promise<{ completed: boolean } | null>`
  - `type TeamOnboardingProgress = { userId: string; userName: string; completedCount: number; totalCount: number; tasks: OnboardingTaskRecord[]; completedTaskIds: string[]; fullAccessGrantedAt: string | null; fullAccessGrantSource: string | null; fullAccessGrantedByName: string | null }`
  - `fetchTeamOnboardingProgress(token: string): Promise<TeamOnboardingProgress[] | null>`
  - `grantOnboardingFullAccess(token: string, userId: string): Promise<{ grantedAt: string; source: string; grantedByName: string | null } | null>`
  - Re-exports `ONBOARDING_ACCESS_ITEMS`, `ONBOARDING_ACCESS_ITEM_LABELS` from `@ponto-dcit/shared-types` (mirrors how `documentos-api.ts` re-exports `ADMISSION_DOCUMENT_KINDS`).
- Consumes: nothing new (uses the existing `authedFetch` helper already in this file).

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/__tests__/lib/onboarding-api.test.ts`:

```typescript
import {
  fetchOnboardingStatus,
  toggleOnboardingAccessItem,
  fetchTeamOnboardingProgress,
  grantOnboardingFullAccess,
} from "@/lib/onboarding-api";

describe("onboarding-api", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("fetchOnboardingStatus", () => {
    it("returns the unlocked flag on success", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ unlocked: true }),
      });
      expect(await fetchOnboardingStatus("token")).toEqual({ unlocked: true });
    });

    it("returns null on a non-ok response", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await fetchOnboardingStatus("token")).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("network"));
      expect(await fetchOnboardingStatus("token")).toBeNull();
    });
  });

  describe("toggleOnboardingAccessItem", () => {
    it("posts to /onboarding/acessos/:item/toggle and returns the result", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ completed: true }),
      });
      const result = await toggleOnboardingAccessItem("token", "movidesk");
      expect(result).toEqual({ completed: true });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/onboarding/acessos/movidesk/toggle"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns null on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await toggleOnboardingAccessItem("token", "movidesk")).toBeNull();
    });
  });

  describe("fetchTeamOnboardingProgress", () => {
    it("returns the team progress array on success", async () => {
      const progress = [
        {
          userId: "u1",
          userName: "Ana",
          completedCount: 2,
          totalCount: 5,
          tasks: [],
          completedTaskIds: [],
          fullAccessGrantedAt: null,
          fullAccessGrantSource: null,
          fullAccessGrantedByName: null,
        },
      ];
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => progress });
      expect(await fetchTeamOnboardingProgress("token")).toEqual(progress);
    });

    it("returns null when the response is not an array", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
      expect(await fetchTeamOnboardingProgress("token")).toBeNull();
    });
  });

  describe("grantOnboardingFullAccess", () => {
    it("posts to /onboarding/equipe/:userId/liberar-acesso", async () => {
      const grant = { grantedAt: "2026-09-07T00:00:00.000Z", source: "manual", grantedByName: "Bruno" };
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => grant });
      const result = await grantOnboardingFullAccess("token", "u1");
      expect(result).toEqual(grant);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/onboarding/equipe/u1/liberar-acesso"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns null on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      expect(await grantOnboardingFullAccess("token", "u1")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/lib/onboarding-api.test.ts`
Expected: FAIL — `fetchOnboardingStatus is not a function` (and the other three).

- [ ] **Step 3: Implement the new functions**

Replace the full contents of `apps/mobile/src/lib/onboarding-api.ts` with:

```typescript
import { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS } from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS };

export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
  requiresVideo: boolean;
  showsTeam: boolean;
  requiresContract: boolean;
  requiresAccessChecklist: boolean;
};

export type OnboardingTasksResponse = {
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
  completedAccessItems: string[];
  fullAccessGrantedAt: string | null;
};

function isOnboardingTasksResponse(data: unknown): data is OnboardingTasksResponse {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return Array.isArray(candidate.tasks) && Array.isArray(candidate.completedTaskIds);
}

async function authedFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function fetchOnboardingTasks(token: string): Promise<OnboardingTasksResponse | null> {
  try {
    const response = await authedFetch(token, "/onboarding/tarefas");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isOnboardingTasksResponse(data) ? (data as OnboardingTasksResponse) : null;
  } catch {
    return null;
  }
}

export async function toggleOnboardingTask(
  token: string,
  taskId: string,
): Promise<{ completed: boolean } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/tarefas/${taskId}/toggle`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { completed: boolean };
  } catch {
    return null;
  }
}

export async function fetchOnboardingStatus(token: string): Promise<{ unlocked: boolean } | null> {
  try {
    const response = await authedFetch(token, "/onboarding/meu-status");
    if (!response.ok) return null;
    return (await response.json()) as { unlocked: boolean };
  } catch {
    return null;
  }
}

export async function toggleOnboardingAccessItem(
  token: string,
  item: string,
): Promise<{ completed: boolean } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/acessos/${item}/toggle`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { completed: boolean };
  } catch {
    return null;
  }
}

export type TeamOnboardingProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: OnboardingTaskRecord[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

export async function fetchTeamOnboardingProgress(
  token: string,
): Promise<TeamOnboardingProgress[] | null> {
  try {
    const response = await authedFetch(token, "/onboarding/equipe");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as TeamOnboardingProgress[]) : null;
  } catch {
    return null;
  }
}

export async function grantOnboardingFullAccess(
  token: string,
  userId: string,
): Promise<{ grantedAt: string; source: string; grantedByName: string | null } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/equipe/${userId}/liberar-acesso`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { grantedAt: string; source: string; grantedByName: string | null };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/lib/onboarding-api.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/onboarding-api.ts apps/mobile/src/__tests__/lib/onboarding-api.test.ts
git commit -m "feat(mobile): add onboarding status, access-item, team-progress and grant API clients"
```

---

### Task 3: Extend `lib/documentos-api.ts` with signed-contract endpoints

**Files:**
- Modify: `apps/mobile/src/lib/documentos-api.ts`
- Test: `apps/mobile/src/__tests__/lib/documentos-api.test.ts` (new)

**Interfaces:**
- Produces:
  - `type SignedContractRecord = { submittedAt: string | null }`
  - `fetchSignedContract(token: string): Promise<SignedContractRecord | null>`
  - `submitSignedContract(token: string, fileDataUrl: string): Promise<{ submittedAt: string } | null>`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/__tests__/lib/documentos-api.test.ts`:

```typescript
import { fetchSignedContract, submitSignedContract } from "@/lib/documentos-api";

describe("documentos-api: signed contract", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it("fetchSignedContract returns the record on success", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-01T00:00:00.000Z" }),
    });
    expect(await fetchSignedContract("token")).toEqual({ submittedAt: "2026-09-01T00:00:00.000Z" });
  });

  it("fetchSignedContract returns null on failure", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await fetchSignedContract("token")).toBeNull();
  });

  it("submitSignedContract posts the fileDataUrl to /documentos/contrato", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-07T00:00:00.000Z" }),
    });
    const result = await submitSignedContract("token", "data:application/pdf;base64,AAAA");
    expect(result).toEqual({ submittedAt: "2026-09-07T00:00:00.000Z" });
    const call = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/documentos/contrato");
    expect(JSON.parse(call[1].body)).toEqual({ fileDataUrl: "data:application/pdf;base64,AAAA" });
  });

  it("submitSignedContract returns null on failure", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await submitSignedContract("token", "data:application/pdf;base64,AAAA")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/lib/documentos-api.test.ts`
Expected: FAIL — `fetchSignedContract is not a function`.

- [ ] **Step 3: Implement the new functions**

Append to `apps/mobile/src/lib/documentos-api.ts` (after the existing `submitCertification` function, before the final closing of the file):

```typescript
export type SignedContractRecord = { submittedAt: string | null };

export async function fetchSignedContract(token: string): Promise<SignedContractRecord | null> {
  try {
    const response = await authedFetch(token, "/documentos/contrato");
    if (!response.ok) return null;
    return (await response.json()) as SignedContractRecord;
  } catch {
    return null;
  }
}

export async function submitSignedContract(
  token: string,
  fileDataUrl: string,
): Promise<{ submittedAt: string } | null> {
  try {
    const response = await authedFetch(token, "/documentos/contrato", {
      method: "POST",
      body: JSON.stringify({ fileDataUrl }),
    });
    if (!response.ok) return null;
    return (await response.json()) as { submittedAt: string };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/lib/documentos-api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/documentos-api.ts apps/mobile/src/__tests__/lib/documentos-api.test.ts
git commit -m "feat(mobile): add signed-contract fetch/submit API clients"
```

---

### Task 4: "Conhecer o time" section (`team-section.tsx`)

**Files:**
- Create: `apps/mobile/src/lib/team-members.ts`
- Create: `apps/mobile/src/assets/images/team/*.jpg` (14 files, copied)
- Create: `apps/mobile/src/components/team-section.tsx`
- Test: `apps/mobile/src/__tests__/components/team-section.test.tsx` (new)

**Interfaces:**
- Produces: `TeamSection({ isDone, pending, onToggle }: { isDone: boolean; pending: boolean; onToggle: () => void }): JSX.Element`, `TEAM_ROWS: TeamMember[][]` from `@/lib/team-members`.
- Consumes: nothing new.

- [ ] **Step 1: Copy the team photos**

```bash
mkdir -p apps/mobile/src/assets/images/team
cp apps/web/public/team/*.jpg apps/mobile/src/assets/images/team/
```

- [ ] **Step 2: Create the team roster data file**

Create `apps/mobile/src/lib/team-members.ts`:

```typescript
// Mirrors apps/web/src/app/(app)/onboarding/team-members.ts — same rows,
// same order, same names/titles; only the image source changes from a
// public-folder URL string to a bundled require().
export type TeamMember = { name: string; title: string; image: ReturnType<typeof require> };

export const TEAM_ROWS: TeamMember[][] = [
  [
    { name: "Claudio Medeiros", title: "Founder e CEO na DCIT", image: require("@/assets/images/team/founder-ceo.jpg") },
    {
      name: "Fabiano Peres",
      title: "IT Analyst - Cloud Architecture",
      image: require("@/assets/images/team/it-analyst-cloud-architecture.jpg"),
    },
    {
      name: "Marlisson Ferreira",
      title: "DataCenter & Cloud Analist",
      image: require("@/assets/images/team/datacenter-cloud-analist.jpg"),
    },
  ],
  [
    { name: "Everton Almeida", title: "Gerente de TI", image: require("@/assets/images/team/gerente-de-ti.jpg") },
    { name: "Nêmora Cristina", title: "Gerente Comercial", image: require("@/assets/images/team/gerente-comercial.jpg") },
  ],
  [
    {
      name: "Matheus Faria",
      title: "Especialista Azure Cloud",
      image: require("@/assets/images/team/especialista-azure-cloud.jpg"),
    },
  ],
  [
    {
      name: "Priscila Goulart",
      title: "Full Stack Developer",
      image: require("@/assets/images/team/full-stack-developer.jpg"),
    },
  ],
  [
    { name: "Adriano Filho", title: "Cybersecurity Analyst", image: require("@/assets/images/team/cybersecurity-analyst.jpg") },
    { name: "Rafael de miguel", title: "Analista Microsoft 365", image: require("@/assets/images/team/analista-microsoft-365.jpg") },
    { name: "Marconi Hastenreiter", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-1.jpg") },
    { name: "Arthur Benício", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-2.jpg") },
    { name: "Daniel Oliveira", title: "Analista Cloud & Ops", image: require("@/assets/images/team/analista-cloud-ops.jpg") },
    { name: "André Mariano", title: "Analista 365", image: require("@/assets/images/team/analista-365.jpg") },
    { name: "Diego Moreira", title: "Analista de Cloud", image: require("@/assets/images/team/analista-de-cloud-3.jpg") },
  ],
];
```

- [ ] **Step 3: Write the failing test**

Create `apps/mobile/src/__tests__/components/team-section.test.tsx`:

```typescript
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TeamSection } from "@/components/team-section";

describe("TeamSection", () => {
  it("renders every team member's name and title", () => {
    render(<TeamSection isDone={false} pending={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Claudio Medeiros")).toBeTruthy();
    expect(screen.getByText("Founder e CEO na DCIT")).toBeTruthy();
    expect(screen.getByText("Diego Moreira")).toBeTruthy();
  });

  it("shows 'Marcar como concluído' when not done and calls onToggle when pressed", () => {
    const onToggle = jest.fn();
    render(<TeamSection isDone={false} pending={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByText("Marcar como concluído"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows 'Desfazer' when done", () => {
    render(<TeamSection isDone pending={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Desfazer")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest src/__tests__/components/team-section.test.tsx`
Expected: FAIL — cannot find module `@/components/team-section`.

- [ ] **Step 5: Implement `TeamSection`**

Create `apps/mobile/src/components/team-section.tsx`:

```typescript
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { TEAM_ROWS } from "@/lib/team-members";

// Plain presentational grid — completion for this task is a separate manual
// action (no natural "finished viewing photos" event), same as the web
// version's TeamSection.
export function TeamSection({
  isDone,
  pending,
  onToggle,
}: {
  isDone: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.container}>
      {TEAM_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((member, memberIndex) => (
            <View key={memberIndex} style={styles.member}>
              <Image source={member.image} style={styles.photo} contentFit="cover" />
              <ThemedText type="smallBold">{member.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {member.title}
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
      <ThemedButton title={isDone ? "Desfazer" : "Marcar como concluído"} onPress={pending ? () => {} : onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  member: {
    width: 100,
    alignItems: "center",
    gap: 2,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest src/__tests__/components/team-section.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/team-members.ts apps/mobile/src/assets/images/team apps/mobile/src/components/team-section.tsx apps/mobile/src/__tests__/components/team-section.test.tsx
git commit -m "feat(mobile): add Conhecer o time onboarding section"
```

---

### Task 5: Welcome video player (`welcome-video-player.tsx`)

**Files:**
- Create: `apps/mobile/src/components/welcome-video-player.tsx`
- Test: `apps/mobile/src/__tests__/components/welcome-video-player.test.tsx` (new)

**Interfaces:**
- Produces: `WelcomeVideoPlayer({ onCompleted }: { onCompleted: () => void }): JSX.Element`.
- Consumes: `@react-native-async-storage/async-storage` (already an installed, globally-mocked dependency — see `jest.setup.js`), `react-native-webview`'s `WebView` (added in Task 1).

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/__tests__/components/welcome-video-player.test.tsx`:

```typescript
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WelcomeVideoPlayer } from "@/components/welcome-video-player";

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

describe("WelcomeVideoPlayer", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("calls onCompleted and clears stored progress when the video ends", async () => {
    await AsyncStorage.setItem("onboarding-video-progress:9US-Rv6-354", "42");
    const onCompleted = jest.fn();
    render(<WelcomeVideoPlayer onCompleted={onCompleted} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type: "ended" }) } });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      expect(await AsyncStorage.getItem("onboarding-video-progress:9US-Rv6-354")).toBeNull();
    });
  });

  it("persists progress messages to AsyncStorage without calling onCompleted", async () => {
    const onCompleted = jest.fn();
    render(<WelcomeVideoPlayer onCompleted={onCompleted} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    act(() => {
      fireEvent(webview, "message", {
        nativeEvent: { data: JSON.stringify({ type: "progress", seconds: 12.5 }) },
      });
    });

    expect(onCompleted).not.toHaveBeenCalled();
    await waitFor(async () => {
      expect(await AsyncStorage.getItem("onboarding-video-progress:9US-Rv6-354")).toBe("12.5");
    });
  });

  it("reads any previously saved progress before rendering the WebView", async () => {
    await AsyncStorage.setItem("onboarding-video-progress:9US-Rv6-354", "30");
    render(<WelcomeVideoPlayer onCompleted={jest.fn()} />);

    const webview = await screen.findByTestId("welcome-video-webview");
    expect(webview.props.source.html).toContain("var maxWatched = 30");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/components/welcome-video-player.test.tsx`
Expected: FAIL — cannot find module `@/components/welcome-video-player`.

- [ ] **Step 3: Implement `WelcomeVideoPlayer`**

Create `apps/mobile/src/components/welcome-video-player.tsx`:

```typescript
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/use-theme";

// Same video as the web version (apps/web/.../onboarding/welcome-video-player.tsx).
const VIDEO_ID = "9US-Rv6-354";
const PROGRESS_STORAGE_KEY = `onboarding-video-progress:${VIDEO_ID}`;

function buildPlayerHtml(initialProgress: number): string {
  return `
<!DOCTYPE html><html><body style="margin:0;background:#000">
  <div id="player"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    var player;
    var maxWatched = ${initialProgress};
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${VIDEO_ID}',
        width: '100%',
        height: '220',
        playerVars: { modestbranding: 1, rel: 0 },
        events: {
          onReady: function() {
            if (maxWatched > 1.5) player.seekTo(maxWatched, true);
            setInterval(function() {
              var current = player.getCurrentTime();
              if (current > maxWatched + 1.5) {
                player.seekTo(maxWatched, true);
              } else {
                maxWatched = Math.max(maxWatched, current);
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'progress', seconds: maxWatched }));
              }
            }, 500);
          },
          onStateChange: function(event) {
            if (event.data === YT.PlayerState.ENDED) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
          }
        }
      });
    }
  </script>
</body></html>`;
}

// The RN WebView doesn't share the app's own storage with the page it
// loads — the YouTube IFrame page's "window" is its own isolated context,
// so progress travels out via postMessage into AsyncStorage instead of the
// web version's direct window.localStorage read/write.
export function WelcomeVideoPlayer({ onCompleted }: { onCompleted: () => void }) {
  const theme = useTheme();
  const [initialProgress, setInitialProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PROGRESS_STORAGE_KEY).then((value) => {
      if (!cancelled) setInitialProgress(Number(value) || 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleMessage(event: WebViewMessageEvent) {
    const data = JSON.parse(event.nativeEvent.data) as { type: string; seconds?: number };
    if (data.type === "progress" && data.seconds !== undefined) {
      AsyncStorage.setItem(PROGRESS_STORAGE_KEY, String(data.seconds));
    } else if (data.type === "ended") {
      AsyncStorage.removeItem(PROGRESS_STORAGE_KEY);
      onCompleted();
    }
  }

  if (initialProgress === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <WebView
        source={{ html: buildPlayerHtml(initialProgress) }}
        onMessage={handleMessage}
        javaScriptEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: "hidden",
  },
  webview: {
    height: 220,
  },
  loading: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/components/welcome-video-player.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/welcome-video-player.tsx apps/mobile/src/__tests__/components/welcome-video-player.test.tsx
git commit -m "feat(mobile): add welcome video player with resume and anti-skip"
```

---

### Task 6: Contract box (`contract-box.tsx`)

**Files:**
- Create: `apps/mobile/src/components/contract-box.tsx`
- Test: `apps/mobile/src/__tests__/components/contract-box.test.tsx` (new)

**Interfaces:**
- Produces: `ContractBox({ existing, onSubmitted }: { existing: SignedContractRecord | null; onSubmitted?: () => void }): JSX.Element`.
- Consumes: `SignedContractRecord`, `submitSignedContract` from `@/lib/documentos-api` (Task 3); `WEB_APP_URL` from `@/constants/api` (Task 1); `getSessionToken` from `@/lib/session`.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/__tests__/components/contract-box.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { saveSessionToken } from "@/lib/session";
import { ContractBox } from "@/components/contract-box";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1wZGY="),
  EncodingType: { Base64: "base64" },
}));

globalThis.fetch = jest.fn();

describe("ContractBox", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ submittedAt: "2026-09-07T00:00:00.000Z" }),
    });
    await saveSessionToken("test-token");
  });

  it("shows 'Nenhum contrato assinado enviado ainda.' when there is no existing contract", () => {
    render(<ContractBox existing={null} />);
    expect(screen.getByText("Nenhum contrato assinado enviado ainda.")).toBeTruthy();
    expect(screen.getByText("Enviar PDF assinado")).toBeTruthy();
  });

  it("shows the submission date when a contract already exists", () => {
    render(<ContractBox existing={{ submittedAt: "2026-09-01T00:00:00.000Z" }} />);
    expect(screen.getByText(/Enviado em/)).toBeTruthy();
    expect(screen.getByText("Reenviar")).toBeTruthy();
  });

  it("opens the model download link in the browser", () => {
    render(<ContractBox existing={null} />);
    fireEvent.press(screen.getByText("Baixar modelo do contrato"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining("/documents/contrato-modelo.pdf"),
    );
  });

  it("picks a PDF and submits it as a base64 data URL", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake.pdf", name: "contrato.pdf", mimeType: "application/pdf" }],
    });
    const onSubmitted = jest.fn();
    render(<ContractBox existing={null} onSubmitted={onSubmitted} />);

    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      const call = (globalThis.fetch as jest.Mock).mock.calls.find(([url]: [string]) =>
        url.endsWith("/documentos/contrato"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1].body)).toEqual({
        fileDataUrl: "data:application/pdf;base64,ZmFrZS1wZGY=",
      });
    });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the document picker is canceled", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    render(<ContractBox existing={null} />);

    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/components/contract-box.test.tsx`
Expected: FAIL — cannot find module `@/components/contract-box`.

- [ ] **Step 3: Implement `ContractBox`**

Create `apps/mobile/src/components/contract-box.tsx`:

```typescript
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as WebBrowser from "expo-web-browser";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { WEB_APP_URL } from "@/constants/api";
import { submitSignedContract, type SignedContractRecord } from "@/lib/documentos-api";
import { getSessionToken } from "@/lib/session";

// Shared by the Documentos "Contrato" tab and the Onboarding "Assinar o
// contrato" task embed, same reuse shape as AdmissionDocumentBox.
export function ContractBox({
  existing,
  onSubmitted,
}: {
  existing: SignedContractRecord | null;
  onSubmitted?: () => void;
}) {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);

  async function handlePickAndSubmit() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.canceled || !result.assets?.[0]) return;
    const token = await getSessionToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const submitted = await submitSignedContract(token, `data:application/pdf;base64,${base64}`);
      if (submitted) onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.form, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Contrato de trabalho</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {existing?.submittedAt
          ? `Enviado em ${new Date(existing.submittedAt).toLocaleDateString("pt-BR")}`
          : "Nenhum contrato assinado enviado ainda."}
      </ThemedText>
      <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_APP_URL}/documents/contrato-modelo.pdf`)}>
        <ThemedText type="small" themeColor="secondary">
          Baixar modelo do contrato
        </ThemedText>
      </Pressable>
      <ThemedButton
        title={submitting ? "Enviando..." : existing?.submittedAt ? "Reenviar" : "Enviar PDF assinado"}
        onPress={submitting ? () => {} : handlePickAndSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/components/contract-box.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/contract-box.tsx apps/mobile/src/__tests__/components/contract-box.test.tsx
git commit -m "feat(mobile): add signed-contract upload component"
```

---

### Task 7: Access checklist section (`access-checklist-section.tsx`)

**Files:**
- Create: `apps/mobile/src/components/access-checklist-section.tsx`
- Test: `apps/mobile/src/__tests__/components/access-checklist-section.test.tsx` (new)

**Interfaces:**
- Produces: `AccessChecklistSection({ completedItems, pendingItem, onToggleItem }: { completedItems: string[]; pendingItem: string | null; onToggleItem: (item: string) => void }): JSX.Element`.
- Consumes: `ONBOARDING_ACCESS_ITEMS`, `ONBOARDING_ACCESS_ITEM_LABELS` from `@/lib/onboarding-api` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/__tests__/components/access-checklist-section.test.tsx`:

```typescript
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessChecklistSection } from "@/components/access-checklist-section";

describe("AccessChecklistSection", () => {
  it("renders every access item with its label and Pendente/Concluído state", () => {
    render(
      <AccessChecklistSection completedItems={["movidesk"]} pendingItem={null} onToggleItem={jest.fn()} />,
    );
    expect(screen.getByText("Movidesk")).toBeTruthy();
    expect(screen.getByText("SGN Portal")).toBeTruthy();
    expect(screen.getAllByText("Concluído")).toHaveLength(1);
    expect(screen.getAllByText("Pendente")).toHaveLength(4);
  });

  it("calls onToggleItem with the item key when its button is pressed", () => {
    const onToggleItem = jest.fn();
    render(<AccessChecklistSection completedItems={[]} pendingItem={null} onToggleItem={onToggleItem} />);
    fireEvent.press(screen.getByText("SGN Portal"));
    expect(onToggleItem).toHaveBeenCalledWith("sgn_portal");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest src/__tests__/components/access-checklist-section.test.tsx`
Expected: FAIL — cannot find module `@/components/access-checklist-section`.

- [ ] **Step 3: Implement `AccessChecklistSection`**

Create `apps/mobile/src/components/access-checklist-section.tsx`:

```typescript
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS } from "@/lib/onboarding-api";

// Each item toggles independently — the outer "Configurar seus acessos"
// task completes on its own once every item here is done (derived
// server-side), same as the web version's AccessChecklistSection. The
// whole row is the tap target (not just the status pill) so it matches
// this app's existing list-row convention (e.g. onboarding task rows) —
// @testing-library/react-native's fireEvent.press bubbles from a pressed
// Text node up to its nearest Pressable ancestor, so the label and the
// pill both need to sit inside the same Pressable to be tappable via either.
export function AccessChecklistSection({
  completedItems,
  pendingItem,
  onToggleItem,
}: {
  completedItems: string[];
  pendingItem: string | null;
  onToggleItem: (item: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {ONBOARDING_ACCESS_ITEMS.map((item) => {
        const isDone = completedItems.includes(item);
        return (
          <Pressable
            key={item}
            disabled={pendingItem === item}
            onPress={() => onToggleItem(item)}
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">{ONBOARDING_ACCESS_ITEM_LABELS[item]}</ThemedText>
            <View style={[styles.badge, { backgroundColor: isDone ? theme.success : theme.textSecondary }]}>
              <ThemedText type="small" style={{ color: theme.onAccent }}>
                {isDone ? "Concluído" : "Pendente"}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: Spacing.three,
  },
  badge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest src/__tests__/components/access-checklist-section.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/access-checklist-section.tsx apps/mobile/src/__tests__/components/access-checklist-section.test.tsx
git commit -m "feat(mobile): add onboarding access checklist section"
```

---

### Task 8: Celebration modal (`onboarding-celebration-modal.tsx`)

**Files:**
- Create: `apps/mobile/src/components/onboarding-celebration-modal.tsx`
- Test: `apps/mobile/src/__tests__/components/onboarding-celebration-modal.test.tsx` (new)

**Interfaces:**
- Produces: `OnboardingCelebrationModal({ visible, title, description, actionLabel, onAction }: { visible: boolean; title: string; description: string; actionLabel: string; onAction: () => void }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/__tests__/components/onboarding-celebration-modal.test.tsx`:

```typescript
import { fireEvent, render, screen } from "@testing-library/react-native";
import { OnboardingCelebrationModal } from "@/components/onboarding-celebration-modal";

describe("OnboardingCelebrationModal", () => {
  it("renders the title, description and action label", () => {
    render(
      <OnboardingCelebrationModal
        visible
        title="🎉 Parabéns! Onboarding concluído"
        description="Aguarde o gestor ou RH liberar seu acesso completo ao portal."
        actionLabel="Fechar"
        onAction={jest.fn()}
      />,
    );
    expect(screen.getByText("🎉 Parabéns! Onboarding concluído")).toBeTruthy();
    expect(screen.getByText("Aguarde o gestor ou RH liberar seu acesso completo ao portal.")).toBeTruthy();
  });

  it("calls onAction when the action button is pressed", () => {
    const onAction = jest.fn();
    render(
      <OnboardingCelebrationModal
        visible
        title="t"
        description="d"
        actionLabel="Ir para o Dashboard"
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByText("Ir para o Dashboard"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest src/__tests__/components/onboarding-celebration-modal.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `OnboardingCelebrationModal`**

Create `apps/mobile/src/components/onboarding-celebration-modal.tsx` (same `Modal`/backdrop/card shape as `punch-confirmation-modal.tsx`):

```typescript
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export function OnboardingCelebrationModal({
  visible,
  title,
  description,
  actionLabel,
  onAction,
}: {
  visible: boolean;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAction}>
      <Pressable style={styles.backdrop} onPress={onAction}>
        <Pressable style={[styles.card, { backgroundColor: theme.backgroundElement }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
          <ThemedButton title={actionLabel} onPress={onAction} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest src/__tests__/components/onboarding-celebration-modal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/onboarding-celebration-modal.tsx apps/mobile/src/__tests__/components/onboarding-celebration-modal.test.tsx
git commit -m "feat(mobile): add shared onboarding celebration modal"
```

---

### Task 9: Rewrite `app/onboarding.tsx` — colaborador branch with all task types + dialogs

**Files:**
- Modify: `apps/mobile/src/app/onboarding.tsx` (full rewrite, currently 147 lines)
- Modify: `apps/mobile/src/__tests__/app/onboarding.test.tsx` (extend existing file, currently 159 lines)

**Interfaces:**
- Consumes: `fetchOnboardingTasks`, `toggleOnboardingTask`, `toggleOnboardingAccessItem` from `@/lib/onboarding-api` (Task 2); `fetchAdmissionDocuments` from `@/lib/documentos-api`; `fetchSignedContract` from `@/lib/documentos-api` (Task 3); `WelcomeVideoPlayer` (Task 5); `TeamSection` (Task 4); `ContractBox` (Task 6); `AccessChecklistSection` (Task 7); `OnboardingCelebrationModal` (Task 8).
- Produces: same default export shape (`OnboardingScreen`), now handling all 5 task-flag combinations and the two celebration dialogs. Role branching (colaborador vs. gestor/rh) is added in Task 10 on top of this file — this task keeps today's behavior of always showing the task-list view (no role check yet), just with the new sections wired in.

- [ ] **Step 1: Extend the existing test file's fetch mock + add new test cases**

The existing `apps/mobile/src/__tests__/app/onboarding.test.tsx` mocks `/onboarding/tarefas` returning only `requiresUpload` tasks. Replace its `beforeEach` fetch mock (lines 20-66) to also serve `/documentos/contrato`, and add tasks covering every flag. Replace the whole file with:

```typescript
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { saveSessionToken } from "@/lib/session";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return { WebView: (props: Record<string, unknown>) => <View testID="welcome-video-webview" {...props} /> };
});

const BASE_TASKS = [
  { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: true, requiresAccessChecklist: false },
  { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "RG, CPF...", order: 2, requiresUpload: true, requiresVideo: false, showsTeam: false, requiresContract: false, requiresAccessChecklist: false },
  { id: "t3", icon: "play-circle-outline", title: "Assistir ao vídeo de boas-vindas", description: "Conheça a empresa.", order: 3, requiresUpload: false, requiresVideo: true, showsTeam: false, requiresContract: false, requiresAccessChecklist: false },
  { id: "t4", icon: "people-outline", title: "Conhecer o time", description: "Veja quem trabalha aqui.", order: 4, requiresUpload: false, requiresVideo: false, showsTeam: true, requiresContract: false, requiresAccessChecklist: false },
  { id: "t5", icon: "key-outline", title: "Configurar seus acessos", description: "Peça os acessos de TI.", order: 5, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: false, requiresAccessChecklist: true },
];

let completedTaskIds: string[];
let completedAccessItems: string[];
let fullAccessGrantedAt: string | null;

describe("onboarding screen", () => {
  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-rg.jpg" }],
    });
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });

    completedTaskIds = [];
    completedAccessItems = [];
    fullAccessGrantedAt = null;

    (globalThis.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/tarefas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tasks: BASE_TASKS, completedTaskIds, completedAccessItems, fullAccessGrantedAt }),
        });
      }
      if (url.includes("/onboarding/tarefas/") && url.endsWith("/toggle")) {
        const taskId = url.split("/onboarding/tarefas/")[1].replace("/toggle", "");
        const already = completedTaskIds.includes(taskId);
        completedTaskIds = already ? completedTaskIds.filter((id) => id !== taskId) : [...completedTaskIds, taskId];
        return Promise.resolve({ ok: true, json: async () => ({ completed: !already }) });
      }
      if (url.includes("/onboarding/acessos/") && url.endsWith("/toggle")) {
        const item = url.split("/onboarding/acessos/")[1].replace("/toggle", "");
        const already = completedAccessItems.includes(item);
        completedAccessItems = already
          ? completedAccessItems.filter((i) => i !== item)
          : [...completedAccessItems, item];
        // Mirrors OnboardingService.mergeDerivedCompletion: "Configurar seus
        // acessos" (t5) is never toggled directly, it completes on its own
        // once every fixed access item is present.
        if (completedAccessItems.length === 5 && !completedTaskIds.includes("t5")) {
          completedTaskIds = [...completedTaskIds, "t5"];
        } else if (completedAccessItems.length < 5) {
          completedTaskIds = completedTaskIds.filter((id) => id !== "t5");
        }
        return Promise.resolve({ ok: true, json: async () => ({ completed: !already }) });
      }
      if (url.endsWith("/documentos/admissionais") && options?.method === "POST") {
        const body = JSON.parse(options.body as string) as { kind: string };
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "adm-new",
            kind: body.kind,
            title: body.kind.toUpperCase(),
            status: "enviado",
            reviewNote: null,
            submittedAt: new Date().toISOString(),
          }),
        });
      }
      if (url.endsWith("/documentos/admissionais")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.endsWith("/documentos/contrato")) {
        return Promise.resolve({ ok: true, json: async () => ({ submittedAt: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await saveSessionToken("test-token");
  });

  it("shows the checklist with all 5 task types", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("Enviar documentos")).toBeTruthy();
    expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy();
    expect(screen.getByText("Conhecer o time")).toBeTruthy();
    expect(screen.getByText("Configurar seus acessos")).toBeTruthy();
    expect(screen.getByText("0 de 5 concluídos")).toBeTruthy();
  });

  it("expanding the video task renders the WelcomeVideoPlayer and completes the task when it ends", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assistir ao vídeo de boas-vindas")).toBeTruthy());

    fireEvent.press(screen.getByText("Assistir ao vídeo de boas-vindas"));
    const webview = await screen.findByTestId("welcome-video-webview");
    fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type: "ended" }) } });

    await waitFor(() => {
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
    });
  });

  it("expanding the team task shows TeamSection and completes it on manual toggle", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Conhecer o time")).toBeTruthy());

    fireEvent.press(screen.getByText("Conhecer o time"));
    fireEvent.press(screen.getByText("Marcar como concluído"));

    await waitFor(() => {
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
    });
  });

  it("expanding the contract task shows ContractBox and completes the task on submit", async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake.pdf", name: "contrato.pdf", mimeType: "application/pdf" }],
    });
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assinar o contrato")).toBeTruthy());

    fireEvent.press(screen.getByText("Assinar o contrato"));
    fireEvent.press(screen.getByText("Enviar PDF assinado"));

    await waitFor(() => {
      expect(screen.getByText("1 de 5 concluídos")).toBeTruthy();
    });
  });

  it("expanding the access checklist task shows AccessChecklistSection and toggles items independently", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Configurar seus acessos")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar seus acessos"));
    fireEvent.press(screen.getByText("SGN Portal"));

    await waitFor(() => {
      expect(screen.getAllByText("Concluído")).toHaveLength(1);
    });
  });

  it("shows the completion dialog once every task is done and no access has been granted yet", async () => {
    completedTaskIds = ["t1", "t2", "t3", "t4"];
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Configurar seus acessos")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar seus acessos"));
    fireEvent.press(screen.getByText("SGN Portal"));
    fireEvent.press(screen.getByText("Movidesk"));
    fireEvent.press(screen.getByText("Email corporativo"));
    fireEvent.press(screen.getByText("Teams"));
    fireEvent.press(screen.getByText("Site24x7"));

    await waitFor(() => {
      expect(screen.getByText("🎉 Parabéns! Onboarding concluído")).toBeTruthy();
    });
  });

  it("shows the unlocked dialog when fullAccessGrantedAt transitions from null to a value on refetch", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => expect(screen.getByText("Assinar o contrato")).toBeTruthy());

    fullAccessGrantedAt = "2026-09-07T12:00:00.000Z";
    // Pull-to-refresh re-runs load() the same way returning to this screen
    // (useFocusEffect) would in the real app — firing "refresh" directly on
    // the RefreshControl, not the ScrollView, since RefreshControl owns the
    // onRefresh callback as its own prop.
    fireEvent(screen.getByTestId("onboarding-refresh-control"), "refresh");

    await waitFor(() => {
      expect(screen.getByText("🎉 Acesso liberado!")).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/app/onboarding.test.tsx`
Expected: FAIL — new task types render nothing, dialogs never appear, `testID="onboarding-scroll"` doesn't exist.

- [ ] **Step 3: Rewrite `app/onboarding.tsx`**

Replace the full contents of `apps/mobile/src/app/onboarding.tsx` with:

```typescript
import { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { AccessChecklistSection } from "@/components/access-checklist-section";
import { AdmissionDocumentBox } from "@/components/admission-document-box";
import { ContractBox } from "@/components/contract-box";
import { OnboardingCelebrationModal } from "@/components/onboarding-celebration-modal";
import { ScreenHeader } from "@/components/screen-header";
import { TeamSection } from "@/components/team-section";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WelcomeVideoPlayer } from "@/components/welcome-video-player";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_KINDS,
  fetchAdmissionDocuments,
  fetchSignedContract,
  type AdmissionDocumentRecord,
  type SignedContractRecord,
} from "@/lib/documentos-api";
import {
  fetchOnboardingTasks,
  toggleOnboardingAccessItem,
  toggleOnboardingTask,
  type OnboardingTaskRecord,
} from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [tasks, setTasks] = useState<OnboardingTaskRecord[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [completedAccessItems, setCompletedAccessItems] = useState<string[]>([]);
  const [fullAccessGrantedAt, setFullAccessGrantedAt] = useState<string | null>(null);
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [signedContract, setSignedContract] = useState<SignedContractRecord>({ submittedAt: null });
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingAccessItem, setPendingAccessItem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const previousIsComplete = useRef(false);
  const previousGrantedAt = useRef<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUnlockedDialog, setShowUnlockedDialog] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const [tasksResult, documentsResult, contractResult] = await Promise.all([
      fetchOnboardingTasks(token),
      fetchAdmissionDocuments(token),
      fetchSignedContract(token),
    ]);
    if (tasksResult) {
      setTasks(tasksResult.tasks);
      setDone(new Set(tasksResult.completedTaskIds));
      setCompletedAccessItems(tasksResult.completedAccessItems);

      const isComplete = tasksResult.tasks.length > 0 && tasksResult.completedTaskIds.length === tasksResult.tasks.length;
      if (!previousIsComplete.current && isComplete && !tasksResult.fullAccessGrantedAt) {
        setShowCompletionDialog(true);
      }
      previousIsComplete.current = isComplete;

      if (!previousGrantedAt.current && tasksResult.fullAccessGrantedAt) {
        setShowUnlockedDialog(true);
      }
      previousGrantedAt.current = tasksResult.fullAccessGrantedAt;
      setFullAccessGrantedAt(tasksResult.fullAccessGrantedAt);
    }
    if (documentsResult) setAdmissionDocuments(documentsResult);
    if (contractResult) setSignedContract(contractResult);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggle(id: string) {
    const token = await getSessionToken();
    if (!token) return;
    const result = await toggleOnboardingTask(token, id);
    if (!result) return;
    setDone((current) => {
      const next = new Set(current);
      if (result.completed) next.add(id);
      else next.delete(id);
      return next;
    });
    await load();
  }

  async function toggleAccessItem(item: string) {
    const token = await getSessionToken();
    if (!token) return;
    setPendingAccessItem(item);
    try {
      const result = await toggleOnboardingAccessItem(token, item);
      if (result) {
        setCompletedAccessItems((current) =>
          result.completed ? [...current, item] : current.filter((i) => i !== item),
        );
      }
    } finally {
      setPendingAccessItem(null);
    }
    await load();
  }

  const uploadTask = tasks.find((task) => task.requiresUpload);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  const progress = tasks.length > 0 ? done.size / tasks.length : 0;

  function isExpandable(task: OnboardingTaskRecord) {
    return task.requiresUpload || task.requiresVideo || task.showsTeam || task.requiresContract || task.requiresAccessChecklist;
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Boas-vindas" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl testID="onboarding-refresh-control" refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <ThemedText type="default" themeColor="textSecondary">
          Complete os passos abaixo antes do seu primeiro dia.
        </ThemedText>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { backgroundColor: theme.secondary, width: `${Math.round(progress * 100)}%` }]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done.size} de {tasks.length} concluídos
        </ThemedText>

        <View style={styles.list}>
          {tasks.map((task) => {
            const checked = done.has(task.id);
            const expanded = expandedTaskId === task.id;
            const expandable = isExpandable(task);
            return (
              <View key={task.id} style={styles.taskGroup}>
                <Pressable
                  onPress={() => (expandable ? setExpandedTaskId(expanded ? null : task.id) : toggle(task.id))}
                  style={[styles.row, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons
                    name={checked ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={checked ? theme.success : theme.textSecondary}
                  />
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold" style={checked ? styles.strikethrough : undefined}>
                      {task.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {task.description}
                    </ThemedText>
                  </View>
                  <Ionicons name={task.icon as keyof typeof Ionicons.glyphMap} size={20} color={theme.secondary} />
                </Pressable>

                {task.requiresUpload && expanded ? (
                  <View style={styles.list}>
                    {ADMISSION_DOCUMENT_KINDS.map((kind) => (
                      <AdmissionDocumentBox
                        key={kind}
                        kind={kind}
                        label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
                        existing={byKind.get(kind) ?? null}
                        onSubmitted={(created) => {
                          setAdmissionDocuments((current) => [created, ...current.filter((d) => d.kind !== kind)]);
                          if (uploadTask) setDone((current) => new Set(current).add(uploadTask.id));
                        }}
                      />
                    ))}
                  </View>
                ) : null}

                {task.requiresVideo && expanded ? (
                  <WelcomeVideoPlayer onCompleted={() => !checked && toggle(task.id)} />
                ) : null}

                {task.showsTeam && expanded ? (
                  <TeamSection isDone={checked} pending={false} onToggle={() => toggle(task.id)} />
                ) : null}

                {task.requiresContract && expanded ? (
                  <ContractBox existing={signedContract} onSubmitted={() => !checked && toggle(task.id)} />
                ) : null}

                {task.requiresAccessChecklist && expanded ? (
                  <AccessChecklistSection
                    completedItems={completedAccessItems}
                    pendingItem={pendingAccessItem}
                    onToggleItem={toggleAccessItem}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <OnboardingCelebrationModal
        visible={showCompletionDialog}
        title="🎉 Parabéns! Onboarding concluído"
        description="Aguarde o gestor ou RH liberar seu acesso completo ao portal."
        actionLabel="Fechar"
        onAction={() => setShowCompletionDialog(false)}
      />
      <OnboardingCelebrationModal
        visible={showUnlockedDialog}
        title="🎉 Acesso liberado!"
        description="Seu acesso total ao SGP Portal foi liberado."
        actionLabel="Ir para o Dashboard"
        onAction={() => {
          setShowUnlockedDialog(false);
          router.replace("/(tabs)");
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  list: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  taskGroup: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
});
```

Note: `fullAccessGrantedAt` state is read only for the dialog-transition check inside `load()` — it is intentionally otherwise unused in this task's JSX (no visible "liberado em" text on this screen today, matching current app behavior); a lint rule flagging unused state would be wrong here since `setFullAccessGrantedAt` does have a reader (the JSX doesn't need one, the transition ref does). If the linter still complains, prefix the setter usage is enough since the value itself is read by nothing else — in that case drop the `fullAccessGrantedAt` state variable entirely and rely solely on `previousGrantedAt.current`/`tasksResult.fullAccessGrantedAt` inside `load()`, which is enough for the dialog logic.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/app/onboarding.test.tsx`
Expected: PASS (all tests, including the original upload-task ones which still apply since `BASE_TASKS` includes `t2` with `requiresUpload: true`).

- [ ] **Step 5: Run the full mobile test suite to check for regressions**

Run: `cd apps/mobile && npx jest`
Expected: PASS. If `apps/mobile/src/__tests__/app/notification-tap-navigation.test.tsx` or any other file also renders `/onboarding`, re-check it against the new fetch mock shape required (it must return `completedAccessItems`/`fullAccessGrantedAt` alongside `tasks`/`completedTaskIds`, or the new `isOnboardingTasksResponse` type guard — unchanged from before — will still accept a response missing those two fields, since the guard only checks `tasks`/`completedTaskIds` are arrays; a response without them is still valid and `completedAccessItems`/`fullAccessGrantedAt` will just be `undefined`, which the screen's `Set`/dialog logic already treats safely as falsy/empty).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app/onboarding.tsx apps/mobile/src/__tests__/app/onboarding.test.tsx
git commit -m "feat(mobile): render video, team, contract and access-checklist onboarding tasks"
```

---

### Task 10: Gestor/RH team onboarding view + detail modal

**Files:**
- Modify: `apps/mobile/src/app/onboarding.tsx` (add role branch on top of Task 9's version)
- Create: `apps/mobile/src/app/onboarding-detalhe.tsx`
- Modify: `apps/mobile/src/__tests__/app/onboarding.test.tsx` (add gestor/rh test cases)
- Test: `apps/mobile/src/__tests__/app/onboarding-detalhe.test.tsx` (new)

**Interfaces:**
- Consumes: `fetchTeamOnboardingProgress`, `grantOnboardingFullAccess`, `type TeamOnboardingProgress` from `@/lib/onboarding-api` (Task 2); `decodeSessionToken` from `@/lib/jwt`.
- Produces: `app/onboarding.tsx` now renders `GestorOnboardingView` when `claims.role !== "colaborador"`; `app/onboarding-detalhe.tsx` default export accepting `?userId=` search param.

- [ ] **Step 1: Write the failing tests for the gestor/rh branch**

Append to `apps/mobile/src/__tests__/app/onboarding.test.tsx` (inside the existing `describe("onboarding screen", ...)`, after the last `it`):

```typescript
  it("shows the team progress list instead of tasks for a gestor", async () => {
    (globalThis.fetch as jest.Mock) = jest.fn((url: string) => {
      if (url.endsWith("/onboarding/equipe")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              userId: "colaborador-1",
              userName: "Ana Colaboradora",
              completedCount: 2,
              totalCount: 5,
              tasks: BASE_TASKS,
              completedTaskIds: ["t1", "t2"],
              fullAccessGrantedAt: null,
              fullAccessGrantSource: null,
              fullAccessGrantedByName: null,
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    function b64(value: string) {
      const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      );
      let bits = "";
      for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
      let out = "";
      for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL[parseInt(bits.slice(i, i + 6), 2)];
      const rem = bits.length % 6;
      if (rem) out += BASE64URL[parseInt(bits.slice(-rem).padEnd(6, "0"), 2)];
      return out;
    }
    await saveSessionToken(`${b64("{}")}.${b64(JSON.stringify({ sub: "gestor-1", role: "gestor", name: "Bruno" }))}.sig`);

    renderRouter("src/app", { initialUrl: "/onboarding" });

    expect(await screen.findByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText("2 de 5 tarefas concluídas")).toBeTruthy();
  });
```

Create `apps/mobile/src/__tests__/app/onboarding-detalhe.test.tsx`:

```typescript
import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

type StoredProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Record<string, unknown>[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

describe("onboarding detalhe screen", () => {
  let teamProgress: StoredProgress[];

  beforeEach(async () => {
    teamProgress = [
      {
        userId: "colaborador-1",
        userName: "Ana Colaboradora",
        completedCount: 1,
        totalCount: 1,
        tasks: [
          { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false, requiresVideo: false, showsTeam: false, requiresContract: true, requiresAccessChecklist: false },
        ],
        completedTaskIds: ["t1"],
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
    ];

    (globalThis.fetch as jest.Mock) = jest.fn((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/equipe") && !options?.method) {
        return Promise.resolve({ ok: true, json: async () => teamProgress });
      }
      if (url.includes("/liberar-acesso")) {
        teamProgress[0].fullAccessGrantedAt = "2026-09-07T12:00:00.000Z";
        teamProgress[0].fullAccessGrantSource = "manual";
        teamProgress[0].fullAccessGrantedByName = "Bruno Gestor";
        return Promise.resolve({
          ok: true,
          json: async () => ({ grantedAt: "2026-09-07T12:00:00.000Z", source: "manual", grantedByName: "Bruno Gestor" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => teamProgress });
    });
    await saveSessionToken("test-token");
  });

  it("shows the selected colaborador's tasks with their status", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding-detalhe?userId=colaborador-1" });

    expect(await screen.findByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    expect(screen.getByText("Concluída")).toBeTruthy();
  });

  it("grants full access after confirmation", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find((b) => b.text === "Confirmar liberação");
      confirm?.onPress?.();
    });

    renderRouter("src/app", { initialUrl: "/onboarding-detalhe?userId=colaborador-1" });
    await screen.findByText("Ana Colaboradora");

    fireEvent.press(screen.getByText("Liberar acesso total ao SGP Portal"));

    await waitFor(() => {
      expect(
        (globalThis.fetch as jest.Mock).mock.calls.some(([url]: [string]) =>
          url.endsWith("/onboarding/equipe/colaborador-1/liberar-acesso"),
        ),
      ).toBe(true);
    });
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npx jest src/__tests__/app/onboarding.test.tsx src/__tests__/app/onboarding-detalhe.test.tsx`
Expected: FAIL — gestor test still sees the colaborador task list (no role branch yet); `onboarding-detalhe.test.tsx` fails to resolve the route.

- [ ] **Step 3: Add the role branch to `app/onboarding.tsx`**

Modify `apps/mobile/src/app/onboarding.tsx`: rename the current default-exported function from `OnboardingScreen` to `ColaboradorOnboardingScreen` (keep its body exactly as Task 9 left it), then add a new default export that branches by role, plus the new `GestorOnboardingView` function. Apply this diff:

Replace:
```typescript
export default function OnboardingScreen() {
```
with:
```typescript
function ColaboradorOnboardingScreen() {
```

Add `useEffect` to the existing `react` import (line 1 currently reads `import { useCallback, useRef, useState } from "react";`):
```typescript
import { useCallback, useEffect, useRef, useState } from "react";
```

Add these two new imports alongside the existing `@/lib/onboarding-api` import:
```typescript
import { decodeSessionToken } from "@/lib/jwt";
import { fetchTeamOnboardingProgress, type TeamOnboardingProgress } from "@/lib/onboarding-api";
```

`Pressable` and `useRouter` are already imported at the top of this file (used by `ColaboradorOnboardingScreen`) — `GestorOnboardingView` and `OnboardingScreen` below reuse those same identifiers directly, no aliasing needed.

Append at the end of the file, after `ColaboradorOnboardingScreen`'s closing brace and before the `styles` `StyleSheet.create` block stays where it is — add the new code **after** the `styles` block instead, so `ColaboradorOnboardingScreen`'s own `styles` constant isn't shadowed:

```typescript
function GestorOnboardingView() {
  const theme = useTheme();
  const router = useRouter();
  const [progress, setProgress] = useState<TeamOnboardingProgress[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchTeamOnboardingProgress(token);
        if (!cancelled && result) setProgress(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Onboarding" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {progress.map((entry) => {
            const percent = entry.totalCount === 0 ? 0 : Math.round((entry.completedCount / entry.totalCount) * 100);
            return (
              <Pressable
                key={entry.userId}
                onPress={() => router.push(`/onboarding-detalhe?userId=${entry.userId}`)}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}
              >
                <View style={styles.rowContent}>
                  <ThemedText type="smallBold">{entry.userName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.completedCount} de {entry.totalCount} tarefas concluídas
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="secondary">
                  {percent}%
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

export default function OnboardingScreen() {
  const [role, setRole] = useState<"colaborador" | "gestor" | "rh" | null>(null);

  useEffect(() => {
    getSessionToken().then((token) => {
      if (token) setRole(decodeSessionToken(token)?.role ?? null);
    });
  }, []);

  if (role && role !== "colaborador") return <GestorOnboardingView />;
  return <ColaboradorOnboardingScreen />;
}
```

- [ ] **Step 4: Create `app/onboarding-detalhe.tsx`**

Create `apps/mobile/src/app/onboarding-detalhe.tsx`:

```typescript
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  fetchTeamOnboardingProgress,
  grantOnboardingFullAccess,
  type TeamOnboardingProgress,
} from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

function grantLabel(entry: TeamOnboardingProgress): string {
  if (!entry.fullAccessGrantedAt) return "Liberar acesso total ao SGP Portal";
  if (entry.fullAccessGrantSource === "manual" && entry.fullAccessGrantedByName) {
    return `Liberado manualmente por ${entry.fullAccessGrantedByName}`;
  }
  return "Acesso liberado automaticamente";
}

export default function OnboardingDetalheScreen() {
  const theme = useTheme();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [entry, setEntry] = useState<TeamOnboardingProgress | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const result = await fetchTeamOnboardingProgress(token);
    if (result) setEntry(result.find((item) => item.userId === userId) ?? null);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function handleGrant() {
    if (!entry) return;
    const token = await getSessionToken();
    if (!token) return;
    setGranting(true);
    try {
      await grantOnboardingFullAccess(token, entry.userId);
      await load();
    } finally {
      setGranting(false);
    }
  }

  function confirmGrant() {
    if (!entry) return;
    const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;
    Alert.alert(
      `Liberar acesso total ao SGP Portal para ${entry.userName}?`,
      complete
        ? `${entry.userName} concluiu todas as etapas do onboarding — essa ação libera o acesso completo ao portal.`
        : `${entry.userName} ainda não completou o onboarding (${entry.completedCount} de ${entry.totalCount}). Essa é uma exceção manual — o colaborador ganha acesso completo ao portal mesmo assim.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar liberação", onPress: handleGrant },
      ],
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
        <ScreenHeader title="Onboarding" />
      </ThemedView>
    );
  }

  const completedSet = new Set(entry.completedTaskIds);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title={entry.userName} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          {entry.tasks.map((task) => {
            const done = completedSet.has(task.id);
            return (
              <View key={task.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.rowContent}>
                  <ThemedText type="smallBold">{task.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {task.description}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor={done ? "success" : "textSecondary"}>
                  {done ? "Concluída" : "Pendente"}
                </ThemedText>
              </View>
            );
          })}
        </View>
        <ThemedButton
          title={granting ? "Liberando..." : grantLabel(entry)}
          onPress={granting || entry.fullAccessGrantedAt ? () => {} : confirmGrant}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/app/onboarding.test.tsx src/__tests__/app/onboarding-detalhe.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full mobile test suite**

Run: `cd apps/mobile && npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/onboarding.tsx apps/mobile/src/app/onboarding-detalhe.tsx apps/mobile/src/__tests__/app/onboarding.test.tsx apps/mobile/src/__tests__/app/onboarding-detalhe.test.tsx
git commit -m "feat(mobile): add gestor/rh onboarding team view and grant-access detail screen"
```

---

### Task 11: "Contrato" tab in Documentos

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/documentos.tsx`
- Modify: `apps/mobile/src/__tests__/app/(tabs)/documentos.test.tsx`

**Interfaces:**
- Consumes: `ContractBox` (Task 6), `fetchSignedContract` from `@/lib/documentos-api` (Task 3).

- [ ] **Step 1: Write the failing test**

Add to the existing fetch mock in `apps/mobile/src/__tests__/app/(tabs)/documentos.test.tsx`'s `beforeEach` implementation (insert this branch before the final `return Promise.resolve({ ok: true, json: async () => [] });` fallback, around line 150):

```typescript
      if (url.endsWith("/documentos/contrato") && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ submittedAt: new Date().toISOString() }) });
      }
      if (url.endsWith("/documentos/contrato")) {
        return Promise.resolve({ ok: true, json: async () => ({ submittedAt: null }) });
      }
```

Add this new `it` at the end of the `describe` block (before the closing `});` on the last line):

```typescript
  it("shows the Contrato category with the download link and upload button", async () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Contrato"));

    await waitFor(() => {
      expect(screen.getByText("Nenhum contrato assinado enviado ainda.")).toBeTruthy();
    });
    expect(screen.getByText("Baixar modelo do contrato")).toBeTruthy();
    expect(screen.getByText("Enviar PDF assinado")).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest "src/__tests__/app/(tabs)/documentos.test.tsx"`
Expected: FAIL — no "Contrato" text found.

- [ ] **Step 3: Add the Contrato category**

Modify `apps/mobile/src/app/(tabs)/documentos.tsx`:

Change line 38 from:
```typescript
type Category = "admissionais" | "atestados" | "holerites" | "certificacoes";
```
to:
```typescript
type Category = "admissionais" | "atestados" | "holerites" | "certificacoes" | "contrato";
```

Change lines 40-45 (the `CATEGORIES` array) to add the new entry:
```typescript
const CATEGORIES: { key: Category; label: string }[] = [
  { key: "admissionais", label: "Admissionais" },
  { key: "atestados", label: "Atestados" },
  { key: "holerites", label: "Holerites" },
  { key: "certificacoes", label: "Certificações" },
  { key: "contrato", label: "Contrato" },
];
```

Add the import (alongside the other `@/lib/documentos-api` imports around line 25-35):
```typescript
import { fetchSignedContract, type SignedContractRecord } from "@/lib/documentos-api";
import { ContractBox } from "@/components/contract-box";
```

Add the render branch (line 81, right after `{category === "certificacoes" ? <CertificacoesSection /> : null}`):
```typescript
        {category === "contrato" ? <ContratoSection /> : null}
```

Add the new section function (anywhere among the other `XSection` functions, e.g. right after `CertificacoesSection`'s closing brace):
```typescript
function ContratoSection() {
  const [contract, setContract] = useState<SignedContractRecord>({ submittedAt: null });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchSignedContract(token);
        if (!cancelled && result) setContract(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return <ContractBox existing={contract} onSubmitted={() => {}} />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest "src/__tests__/app/(tabs)/documentos.test.tsx"`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/src/app/(tabs)/documentos.tsx" "apps/mobile/src/__tests__/app/(tabs)/documentos.test.tsx"
git commit -m "feat(mobile): add Contrato category to Documentos"
```

---

### Task 12: Onboarding navigation gate in `(tabs)/_layout.tsx`

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx` (currently 77 lines — gate only in this task, custom tab bar comes in Task 13)
- Test: `apps/mobile/src/__tests__/app/tabs-layout.test.tsx` (extend existing file)

**Interfaces:**
- Consumes: `getSessionToken` from `@/lib/session`; `decodeSessionToken` from `@/lib/jwt`; `fetchOnboardingStatus` from `@/lib/onboarding-api` (Task 2).
- Note: no loading overlay — the gate runs `useFocusEffect` and calls `router.replace("/onboarding")` only if the check resolves `unlocked: false`; tabs render immediately in the meantime (accepted trade-off: a locked colaborador may see a one-frame flash of the tab bar before the redirect fires — this keeps the existing synchronous `tabs-layout.test.tsx` assertions valid without a loading-state rewrite, and matches the app's existing fail-open philosophy of favoring availability over strict enforcement).

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/src/__tests__/app/tabs-layout.test.tsx` (it currently has no `saveSessionToken` import — add it):

```typescript
import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function fakeJwt(claims: Record<string, unknown>) {
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL[parseInt(bits.slice(i, i + 6), 2)];
    const rem = bits.length % 6;
    if (rem) out += BASE64URL[parseInt(bits.slice(-rem).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("(tabs) navigation", () => {
  it("renders a tab bar with all 5 sections", () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.getByText("Ponto")).toBeTruthy();
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Documentos")).toBeTruthy();
    expect(screen.getByText("Mural")).toBeTruthy();

    expect(screen.getAllByLabelText(/, tab, \d+ of \d+$/)).toHaveLength(5);
  });

  it("navigates to the Banco de Horas route", () => {
    renderRouter("src/app", { initialUrl: "/banco-de-horas" });

    expect(screen).toHavePathname("/banco-de-horas");
  });

  it("redirects a locked colaborador to /onboarding", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: false }) });
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
  });

  it("does not redirect an unlocked colaborador", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: true }) });
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });

  it("never redirects a gestor even if the status endpoint says locked", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unlocked: false }) });
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });

  it("fails open (no redirect) when the status request errors", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network"));
    await saveSessionToken(fakeJwt({ sub: "colaborador-1", role: "colaborador", name: "Ana" }));

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Ponto")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd apps/mobile && npx jest src/__tests__/app/tabs-layout.test.tsx`
Expected: the first two (pre-existing) tests PASS; the three new ones FAIL (no redirect happens today, and the "fails open" one currently passes trivially but re-run after Step 3 to confirm intent).

- [ ] **Step 3: Add the gate to `(tabs)/_layout.tsx`**

Modify `apps/mobile/src/app/(tabs)/_layout.tsx`. Change the imports at the top (lines 1-7) from:

```typescript
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
```

to:

```typescript
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { Radius } from "@/constants/theme";
import { decodeSessionToken } from "@/lib/jwt";
import { fetchOnboardingStatus } from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";
```

Change the `export default function TabsLayout() {` body (lines 26-27) from:

```typescript
export default function TabsLayout() {
  const theme = useTheme();

  return (
```

to:

```typescript
export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();

  // Expo Router has no server middleware — from the root Stack's
  // perspective (tabs) is a single screen, so this fires every time the
  // group gains focus (including returning from /onboarding), same trigger
  // point the web version's middleware+layout combination covers per
  // request. Fail-open on any error/missing response, same as the web gate.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const token = await getSessionToken();
        if (!token || cancelled) return;
        const claims = decodeSessionToken(token);
        if (claims?.role !== "colaborador") return;
        const status = await fetchOnboardingStatus(token);
        if (cancelled || !status || status.unlocked) return;
        router.replace("/onboarding");
      })();
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  return (
```

Leave the rest of the file (the `<Tabs>` JSX and its 5 `<Tabs.Screen>` entries) unchanged for this task.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/app/tabs-layout.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full mobile test suite**

Run: `cd apps/mobile && npx jest`
Expected: PASS — pay particular attention to `src/__tests__/app/(tabs)/index.test.tsx`'s "shows a confirmation modal..." test (uses a real colaborador JWT): its `fetch` mock resolves `{ ok: true }` with no `.json` method, so `fetchOnboardingStatus`'s `await response.json()` throws inside its own `try/catch` and returns `null`, which this gate treats as fail-open (no redirect) — confirm this test still passes unmodified.

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/src/app/(tabs)/_layout.tsx" apps/mobile/src/__tests__/app/tabs-layout.test.tsx
git commit -m "feat(mobile): add client-side onboarding navigation gate"
```

---

### Task 13: Expandable tab bar

**Files:**
- Create: `apps/mobile/src/components/expandable-tab-bar.tsx`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx` (wire in the custom `tabBar`, on top of Task 12's gate)
- Modify: `apps/mobile/src/__tests__/app/tabs-layout.test.tsx` (add expand/collapse tests)

**Interfaces:**
- Consumes: `useNotificationContext` from `@/context/notification-context` (for the unread badge).
- Produces: `ExpandableTabBar` — a `tabBar` render-prop implementation for `<Tabs>`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/mobile/src/__tests__/app/tabs-layout.test.tsx`, inside the existing `describe` block:

```typescript
  it("expands to reveal Onboarding and Notificações shortcuts, then navigates and collapses", async () => {
    renderRouter("src/app", { initialUrl: "/" });

    expect(screen.queryByText("Onboarding")).toBeNull();
    fireEvent.press(screen.getByLabelText("Mais opções"));

    expect(await screen.findByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Notificações")).toBeTruthy();

    fireEvent.press(screen.getByText("Onboarding"));

    await waitFor(() => {
      expect(screen).toHavePathname("/onboarding");
    });
  });
```

Add the `fireEvent` import to the top of the file (it currently only imports `renderRouter, screen, waitFor`):

```typescript
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest src/__tests__/app/tabs-layout.test.tsx`
Expected: FAIL — no "Mais opções" label exists yet.

- [ ] **Step 3: Implement `ExpandableTabBar`**

Create `apps/mobile/src/components/expandable-tab-bar.tsx`:

```typescript
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import type { ComponentProps } from "react";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Radius, Spacing } from "@/constants/theme";
import { useNotificationContext } from "@/context/notification-context";

// Derived structurally from <Tabs>'s own `tabBar` prop type instead of
// importing BottomTabBarProps from @react-navigation/bottom-tabs directly —
// that package is only a transitive dependency here (expo-router depends
// on it, apps/mobile does not declare it itself).
type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type ExpandableTabBarProps = Parameters<TabBarRenderer>[0];

const EXTRA_ROW_HEIGHT = 64;

export function ExpandableTabBar({ state, descriptors, navigation }: ExpandableTabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationContext();
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  function animateTo(value: number) {
    Animated.timing(heightAnim, { toValue: value, duration: 200, useNativeDriver: false }).start();
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    animateTo(next ? 1 : 0);
  }

  function goToShortcut(path: "/onboarding" | "/notificacoes") {
    setExpanded(false);
    animateTo(0);
    router.push(path);
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <Animated.View
        style={[
          styles.extraRow,
          {
            backgroundColor: theme.backgroundElement,
            height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, EXTRA_ROW_HEIGHT] }),
          },
        ]}
      >
        <Pressable style={styles.extraItem} onPress={() => goToShortcut("/onboarding")}>
          <Ionicons name="rocket-outline" size={22} color={theme.textSecondary} />
          <ThemedText type="small">Onboarding</ThemedText>
        </Pressable>
        <Pressable style={styles.extraItem} onPress={() => goToShortcut("/notificacoes")}>
          <View>
            <Ionicons name="notifications-outline" size={22} color={theme.textSecondary} />
            {unreadCount > 0 ? <View style={[styles.badge, { backgroundColor: theme.accent }]} /> : null}
          </View>
          <ThemedText type="small">Notificações</ThemedText>
        </Pressable>
      </Animated.View>

      <View
        style={[
          styles.mainRow,
          { backgroundColor: theme.backgroundElement, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
        ]}
      >
        <Pressable style={styles.expandHandle} onPress={toggle} accessibilityLabel="Mais opções">
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={16} color={theme.textSecondary} />
        </Pressable>

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = String(options.title ?? route.name);

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityLabel={`${label}, tab, ${index + 1} of ${state.routes.length}`}
            >
              {options.tabBarIcon?.({ focused, color: focused ? theme.secondary : theme.textSecondary, size: 24 })}
              <ThemedText type="small" style={focused ? { color: theme.secondary } : undefined}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "column",
  },
  extraRow: {
    flexDirection: "row",
    overflow: "hidden",
  },
  extraItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mainRow: {
    flexDirection: "row",
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  expandHandle: {
    position: "absolute",
    top: -14,
    left: "50%",
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
});
```

- [ ] **Step 4: Wire `ExpandableTabBar` into `(tabs)/_layout.tsx`**

Modify `apps/mobile/src/app/(tabs)/_layout.tsx`: add the import alongside the others added in Task 12:

```typescript
import { ExpandableTabBar } from "@/components/expandable-tab-bar";
```

Change the `<Tabs ...>` opening tag. It currently reads (after Task 12's edits, this is still the same original block):

```typescript
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.secondary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopWidth: 0,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
        },
      }}
    >
```

Replace it with (the custom `tabBar` now owns all the visual concerns the removed `screenOptions` used to carry — `headerShown` is unrelated to the bar and stays):

```typescript
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ExpandableTabBar {...props} />}>
```

The five `<Tabs.Screen>` entries below stay exactly as they are — `ExpandableTabBar` reads their `title`/`tabBarIcon` options directly from `descriptors`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/mobile && npx jest src/__tests__/app/tabs-layout.test.tsx`
Expected: PASS (8 tests) — including the original "5 sections" and accessibility-label-count assertions, now satisfied by `ExpandableTabBar`'s own `accessibilityLabel` construction rather than React Navigation's default bar.

- [ ] **Step 6: Run the full mobile test suite**

Run: `cd apps/mobile && npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/expandable-tab-bar.tsx "apps/mobile/src/app/(tabs)/_layout.tsx" apps/mobile/src/__tests__/app/tabs-layout.test.tsx
git commit -m "feat(mobile): add expandable tab bar with Onboarding/Notificações shortcuts"
```

---

## Final verification

- [ ] Run the entire mobile suite once more: `cd apps/mobile && npx jest`. Expected: all tests PASS.
- [ ] Run the type checker: `cd apps/mobile && npx tsc --noEmit`. Expected: no errors.
- [ ] Manually smoke-test on the running emulator (see `project-mobile-android-emulator-setup` for the launch sequence already used earlier this session): log in as a colaborador seed account, open Onboarding from the tab-bar shortcut, expand each of the 5 task types, confirm the video plays and completes, confirm the contract PDF picker opens, confirm the access checklist toggles independently, confirm the completion dialog appears once all tasks are done. Then log in as `gestor-1`, open Onboarding, confirm the team list renders, tap a colaborador, confirm the detail screen and grant-access confirmation work.
