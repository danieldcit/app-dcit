# Onboarding Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a colaborador upload their admissional documents (RG, CPF, comprovante de endereço, certidão de casamento, certidão de nascimento dos filhos) directly from the Onboarding checklist's "Enviar documentos" task, on both web and mobile, without leaving Onboarding — and have that task show as done automatically once at least one document has been sent.

**Architecture:** `OnboardingTask` gains a `requiresUpload` boolean column. `OnboardingService.getTasks`/`listTeamProgress` derive completion of the flagged task from `AdmissionDocument` existence (not a separate progress row) — this is a deliberate deviation from the original 2026-09-05 spec (which proposed a dedicated `POST /onboarding/tarefas/:taskId/documento` endpoint): the spec predates today's `AdmissionDocument.kind`/`photos[]` rework, and deriving completion from document existence means the *exact same* fixed-document-box UI and the *exact same* `POST /documentos/admissionais` endpoint built for the Documentos page can be reused verbatim inside Onboarding — no parallel endpoint, no duplicated business logic, and a colaborador who already sent their documents via the Documentos tab sees the Onboarding task as done too (the spec's original design would not have covered that case). Web embeds the existing `AdmissionDocumentBox` component inside a new colaborador-facing Onboarding page (which does not exist yet — today `/onboarding` is gestor/rh-only). Mobile already has a colaborador Onboarding screen (toggle-only); its equivalent box component is extracted out of `documentos.tsx` into a shared component so both screens can use it.

**Tech Stack:** NestJS + Prisma (SQLite) API, Next.js 16 App Router web, Expo/React Native mobile, Zod shared-types (unchanged in this plan — reuses `AdmissionDocumentInputSchema` as-is).

**Spec:** `docs/superpowers/specs/2026-09-05-document-review-onboarding-upload-design.md` — this plan implements only §5 "Fora de escopo" item removed (multi-photo is no longer out of scope, already shipped) and the onboarding-upload portions of §2, §3.6, §4.6, §5.3, §6. Every other section of that spec (notifications, Aprovações redesign, atestado/admissional review workflow, "Reprovado" relabeling) was already implemented earlier in the 2026-09-05 session via direct live fixes and is **not** touched by this plan. Where this plan's design differs from the spec (see Architecture above), this plan is authoritative.

## Global Constraints

- Onboarding's upload task introduces no new "status" concept beyond the existing `completedTaskIds` list — completion is binary (done/not done), never "em análise"/"aprovado"/"reprovado" inside Onboarding itself; that review status only ever shows in `/documentos` (already true today, unchanged).
- No new gestor/RH screens on mobile — this plan's mobile changes touch only the colaborador-facing `onboarding.tsx` and shared components under `apps/mobile/src/components/`.
- Every notification/push call added or touched must keep the existing pattern: DB write `awaited`, push `void`-fired — this plan adds none, but must not regress the ones already in `DocumentosService.createAdmissionDocument` (it is called unchanged, not reimplemented).
- Reuse `AdmissionDocumentInputSchema` (`{ kind, photos }`, already shipped) — no new Zod schema.
- `apps/api` requires `npm run migrate-test-db` after any Prisma migration, and `packages/shared-types` requires `npm run build` after any change there (none needed in this plan, called out only because it bit this session repeatedly).
- `npx prisma migrate dev` fails in this environment ("non-interactive"). Use the manual migration method proven earlier today: hand-write the migration folder + `migration.sql`, apply it directly via a Prisma `$executeRawUnsafe` node script against `dev.db`, mark it applied with `prisma migrate resolve --applied <name>`, then run `npm run migrate-test-db` (which uses `migrate deploy` and applies the same file for real against `test.db`).

---

### Task 1: API — `requiresUpload` column + derived task completion

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`OnboardingTask` model)
- Create: `apps/api/prisma/migrations/<timestamp>_onboarding_task_requires_upload/migration.sql`
- Modify: `apps/api/prisma/seed.ts` (`seedOnboarding`)
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Test: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing), `AdmissionDocument` model (existing, has `userId: String`, no relation needed — a plain `count` query is enough).
- Produces: `OnboardingService.getTasks(userId: string): Promise<{ tasks: OnboardingTask[]; completedTaskIds: string[] }>` — same signature as today, `tasks` now includes `requiresUpload: boolean` (automatic, no explicit `select`). `OnboardingService.listTeamProgress(): Promise<{ userId; userName; completedCount; totalCount; tasks; completedTaskIds }[]>` — same signature, `completedCount`/`completedTaskIds` now factor in derived completion too. Task 2 (web) and Task 3 (mobile) both consume `requiresUpload` off `OnboardingTaskRecord`/`Task`.

- [ ] **Step 1: Add the column to the Prisma schema**

In `apps/api/prisma/schema.prisma`, find:

```prisma
model OnboardingTask {
  id          String @id @default(uuid())
  icon        String
  title       String
  description String
  order       Int
}
```

Replace with:

```prisma
model OnboardingTask {
  id             String  @id @default(uuid())
  icon           String
  title          String
  description    String
  order          Int
  requiresUpload Boolean @default(false)
}
```

- [ ] **Step 2: Write and apply the migration**

```bash
cd apps/api
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_onboarding_task_requires_upload"
cat > "prisma/migrations/${TS}_onboarding_task_requires_upload/migration.sql" << 'EOF'
-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN "requiresUpload" BOOLEAN NOT NULL DEFAULT false;
EOF
```

Apply it to `dev.db` directly (SQLite `ADD COLUMN ... DEFAULT` backfills existing rows automatically — no separate data step needed):

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.\$executeRawUnsafe('ALTER TABLE \"OnboardingTask\" ADD COLUMN \"requiresUpload\" BOOLEAN NOT NULL DEFAULT false');
  await prisma.\$disconnect();
})();
"
MIGDIR=\$(ls -td prisma/migrations/*/ | head -1)
npx prisma migrate resolve --applied "\$(basename \$MIGDIR)"
npx prisma generate
npm run migrate-test-db
```

If `prisma generate` fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`, the running `nest start --watch` dev server is holding the file open: find and kill it first (`netstat -ano | grep ":3000" | grep LISTENING`, then `taskkill //PID <pid> //F`), retry `prisma generate`, then restart the dev server afterward (`npm run start:dev &`, disowned).

Expected: `npm run migrate-test-db` prints "All migrations have been successfully applied." with your new migration name in the list.

- [ ] **Step 3: Update the seed so an existing `dev.db` also gets the flag**

In `apps/api/prisma/seed.ts`, find the `"Enviar documentos"` entry inside `seedOnboarding`'s `createMany` call and add `requiresUpload: true`:

```typescript
{
  icon: 'cloud-upload-outline',
  title: 'Enviar documentos',
  description: 'RG, CPF, comprovante de residência e demais documentos admissionais.',
  order: 2,
  requiresUpload: true,
},
```

Then, immediately after the closing of `seedOnboarding`'s existing `if (existing) return;`-guarded `createMany` block (still inside `seedOnboarding`, but **outside** the `if (!existing)` short-circuit — this function currently returns early via `if (existing) return;` at the top, so add the idempotent update **before** that early return, unconditionally):

```typescript
async function seedOnboarding() {
  await prisma.onboardingTask.updateMany({
    where: { title: 'Enviar documentos' },
    data: { requiresUpload: true },
  });

  const existing = await prisma.onboardingTask.findFirst();
  if (existing) return;

  await prisma.onboardingTask.createMany({
    data: [ /* ...unchanged, now with requiresUpload: true on "Enviar documentos"... */ ],
  });
}
```

Run it against the real dev database to backfill the already-seeded row:

```bash
npx ts-node prisma/seed.ts
```

Expected: no errors. Verify with:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const t = await prisma.onboardingTask.findFirst({ where: { title: 'Enviar documentos' } });
  console.log(t.requiresUpload);
  await prisma.\$disconnect();
})();
"
```
Expected output: `true`.

- [ ] **Step 4: Write the failing tests for derived completion**

In `apps/api/src/onboarding/onboarding.service.spec.ts`, add (inside the existing `describe('OnboardingService', ...)` block, after the last `it(...)`):

```typescript
  describe('derived completion for requiresUpload tasks', () => {
    it('marks a requiresUpload task complete once the user has any admission document, without an OnboardingProgress row', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.admissionDocument.create({
        data: { userId: 'user-upload-a', kind: 'rg', title: 'RG', photoUri: 'data:image/jpeg;base64,Zm9v' },
      });

      const result = await service.getTasks('user-upload-a');

      expect(result.completedTaskIds).toContain(task.id);
    });

    it('does not mark a requiresUpload task complete for a user with zero admission documents', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 2',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });

      const result = await service.getTasks('user-upload-b-no-docs');

      expect(result.completedTaskIds).not.toContain(task.id);
    });

    it('does not double-count when both an OnboardingProgress row and an admission document exist', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 3',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-upload-c', taskId: task.id } });
      await prisma.admissionDocument.create({
        data: { userId: 'user-upload-c', kind: 'cpf', title: 'CPF', photoUri: 'data:image/jpeg;base64,Zm9v' },
      });

      const result = await service.getTasks('user-upload-c');

      expect(result.completedTaskIds.filter((id) => id === task.id)).toHaveLength(1);
    });

    it('factors derived completion into listTeamProgress too', async () => {
      const task = await prisma.onboardingTask.create({
        data: {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos 4',
          description: 'RG, CPF...',
          order: 1,
          requiresUpload: true,
        },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-upload-d',
          name: 'Dara Onboarding',
          role: 'colaborador',
          hireDate: new Date('2024-03-15'),
        },
      });
      await prisma.admissionDocument.create({
        data: { userId: 'user-upload-d', kind: 'rg', title: 'RG', photoUri: 'data:image/jpeg;base64,Zm9v' },
      });

      const results = await service.listTeamProgress();

      const dara = results.find((r) => r.userId === 'user-upload-d');
      expect(dara?.completedTaskIds).toContain(task.id);
    });
  });
```

Also extend `afterAll` to clean up the new fixtures:

```typescript
  afterAll(async () => {
    await prisma.admissionDocument.deleteMany({
      where: { userId: { in: ['user-upload-a', 'user-upload-b-no-docs', 'user-upload-c', 'user-upload-d'] } },
    });
    await prisma.onboardingProgress.deleteMany();
    await prisma.onboardingTask.deleteMany();
    await prisma.employee.deleteMany({
      where: { userId: { in: ['user-c', 'user-d', 'onboarding-trash-e', 'user-upload-d'] } },
    });
    await prisma.onModuleDestroy();
  });
```

- [ ] **Step 5: Run the tests to verify they fail**

```bash
cd apps/api
npx jest onboarding.service.spec.ts
```

Expected: the 4 new tests fail (derived completion doesn't exist yet); the pre-existing tests still pass.

- [ ] **Step 6: Implement derived completion in `OnboardingService`**

Replace the full contents of `apps/api/src/onboarding/onboarding.service.ts` with:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(userId: string) {
    const [tasks, progress, admissionDocumentCount] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.count({ where: { userId } }),
    ]);
    return {
      tasks,
      completedTaskIds: this.mergeDerivedCompletion(tasks, progress.map((p) => p.taskId), admissionDocumentCount),
    };
  }

  async listTeamProgress() {
    const [tasks, employees, progress] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
      this.prisma.onboardingProgress.findMany(),
    ]);
    const completedByUser = new Map<string, string[]>();
    for (const entry of progress) {
      const completed = completedByUser.get(entry.userId) ?? [];
      completed.push(entry.taskId);
      completedByUser.set(entry.userId, completed);
    }
    const admissionDocumentCounts = await this.prisma.admissionDocument.groupBy({
      by: ['userId'],
      _count: { userId: true },
      where: { userId: { in: employees.map((e) => e.userId) } },
    });
    const admissionDocumentCountByUser = new Map(
      admissionDocumentCounts.map((row) => [row.userId, row._count.userId]),
    );
    return employees.map((employee) => {
      const rawCompletedTaskIds = completedByUser.get(employee.userId) ?? [];
      const completedTaskIds = this.mergeDerivedCompletion(
        tasks,
        rawCompletedTaskIds,
        admissionDocumentCountByUser.get(employee.userId) ?? 0,
      );
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
      };
    });
  }

  // A task flagged requiresUpload (today, always "Enviar documentos") is
  // never toggled by hand — it's derived from whether the colaborador has
  // sent at least one admission document, from anywhere (the Documentos
  // tab or the Onboarding task embedding the same upload boxes). This is
  // additive to (never a replacement for) the OnboardingProgress-backed
  // completion the other 4 tasks still use.
  private mergeDerivedCompletion(
    tasks: { id: string; requiresUpload: boolean }[],
    progressTaskIds: string[],
    admissionDocumentCount: number,
  ): string[] {
    if (admissionDocumentCount === 0) return progressTaskIds;
    const uploadTask = tasks.find((t) => t.requiresUpload);
    if (!uploadTask || progressTaskIds.includes(uploadTask.id)) return progressTaskIds;
    return [...progressTaskIds, uploadTask.id];
  }

  async toggleTask(userId: string, taskId: string) {
    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (existing) {
      await this.prisma.onboardingProgress.delete({
        where: { id: existing.id },
      });
      return { completed: false };
    }
    await this.prisma.onboardingProgress.create({ data: { userId, taskId } });
    return { completed: true };
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npx jest onboarding.service.spec.ts
```

Expected: all tests pass (pre-existing + 4 new).

- [ ] **Step 8: Run the full API suite and commit**

```bash
npx jest
```

Expected: same baseline as before this task (9 pre-existing unrelated `auth.service.spec.ts` failures, everything else passing — confirm the count matches what it was before this task; do not proceed if any *other* suite starts failing).

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/prisma/seed.ts apps/api/src/onboarding/onboarding.service.ts apps/api/src/onboarding/onboarding.service.spec.ts
git commit -m "feat(api): derive onboarding upload-task completion from admission documents"
```

---

### Task 2: Web — colaborador Onboarding page with embedded upload

**Files:**
- Modify: `apps/web/src/app/(app)/onboarding/page.tsx`
- Modify: `apps/web/src/app/(app)/onboarding/onboarding.module.css`
- Create: `apps/web/src/app/(app)/onboarding/actions.ts`
- Create: `apps/web/src/app/(app)/onboarding/colaborador-onboarding.tsx`
- Modify: `apps/web/src/lib/nav-sections.ts`
- Test: `apps/web/e2e/onboarding.spec.ts` (new)

**Interfaces:**
- Consumes: `GET /onboarding/tarefas` (existing, now returns `requiresUpload` per task — Task 1), `POST /onboarding/tarefas/:taskId/toggle` (existing, unchanged), `GET /documentos/admissionais` (existing), `AdmissionDocumentBox` component — `apps/web/src/app/(app)/documentos/admission-document-box.tsx`, already built: `{ kind: string; label: string; existing: { status; reviewNote; submittedAtLabel } | null }`, self-contained (own fetch/submit/refresh, posts to `/api/documentos/admissionais`).
- Produces: nothing new consumed by other tasks — this is the web leaf.

- [ ] **Step 1: Add a Route Handler dependency check (none needed) and read the current page**

No new Route Handler is needed — `AdmissionDocumentBox` already posts through the existing `apps/web/src/app/api/documentos/admissionais/route.ts`. Just confirm it's still there:

```bash
cat apps/web/src/app/api/documentos/admissionais/route.ts
```

Expected: the file exists (built earlier today), forwarding `POST` to `/documentos/admissionais`.

- [ ] **Step 2: Add the toggle Server Action**

Create `apps/web/src/app/(app)/onboarding/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleOnboardingTask(taskId: string): Promise<{ completed: boolean }> {
  const res = await apiFetch(`/onboarding/tarefas/${taskId}/toggle`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/onboarding/tarefas/${taskId}/toggle responded with ${res.status}`);
  }
  const data = (await res.json()) as { completed: boolean };
  revalidatePath("/onboarding");
  return data;
}
```

- [ ] **Step 3: Build the colaborador view component**

Create `apps/web/src/app/(app)/onboarding/colaborador-onboarding.tsx`:

```typescript
"use client";

import { useState } from "react";

import { AdmissionDocumentBox } from "../documentos/admission-document-box";
import { toggleOnboardingTask } from "./actions";
import styles from "./onboarding.module.css";

const ADMISSION_DOCUMENT_KINDS = [
  "rg",
  "cpf",
  "comprovante_endereco",
  "certidao_casamento",
  "certidao_nascimento_filhos",
] as const;

const ADMISSION_DOCUMENT_KIND_LABELS: Record<(typeof ADMISSION_DOCUMENT_KINDS)[number], string> = {
  rg: "RG",
  cpf: "CPF",
  comprovante_endereco: "Comprovante de endereço",
  certidao_casamento: "Certidão de casamento",
  certidao_nascimento_filhos: "Certidão de nascimento dos filhos",
};

type Task = {
  id: string;
  title: string;
  description: string;
  requiresUpload: boolean;
};

type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  reviewNote: string | null;
  submittedAt: string;
};

export function ColaboradorOnboarding({
  tasks,
  completedTaskIds,
  admissionDocuments,
}: {
  tasks: Task[];
  completedTaskIds: string[];
  admissionDocuments: AdmissionDocumentRecord[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  // Derived fresh from props every render (never copied into local state) —
  // both the toggle action and AdmissionDocumentBox's router.refresh() cause
  // this Server Component's props to update, and a stale local copy would
  // silently stop matching the server's actual completion state.
  const done = new Set(completedTaskIds);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  async function handleToggle(taskId: string) {
    setPendingTaskId(taskId);
    try {
      await toggleOnboardingTask(taskId);
    } finally {
      setPendingTaskId(null);
    }
  }

  const percent = tasks.length === 0 ? 0 : Math.round((done.size / tasks.length) * 100);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <p className={styles.itemDetail}>Complete os passos abaixo.</p>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.itemDetail}>
        {done.size} de {tasks.length} concluídos
      </p>

      <ul className={styles.list}>
        {tasks.map((task) => {
          const isDone = done.has(task.id);
          const expanded = expandedTaskId === task.id;
          return (
            <li key={task.id} className={styles.item}>
              <button
                type="button"
                className={styles.itemButton}
                disabled={pendingTaskId === task.id}
                onClick={() =>
                  task.requiresUpload
                    ? setExpandedTaskId(expanded ? null : task.id)
                    : handleToggle(task.id)
                }
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{task.title}</span>
                  <span className={styles.itemDetail}>{task.description}</span>
                </div>
                <span className={isDone ? styles.statusComplete : styles.statusPending}>
                  {isDone
                    ? "Concluído"
                    : task.requiresUpload
                      ? expanded
                        ? "Fechar"
                        : "Enviar"
                      : "Marcar"}
                </span>
              </button>

              {task.requiresUpload && expanded ? (
                <ul className={styles.list}>
                  {ADMISSION_DOCUMENT_KINDS.map((kind) => {
                    const existingDoc = byKind.get(kind);
                    return (
                      <li key={kind}>
                        <AdmissionDocumentBox
                          kind={kind}
                          label={ADMISSION_DOCUMENT_KIND_LABELS[kind]}
                          existing={
                            existingDoc
                              ? {
                                  status: existingDoc.status,
                                  reviewNote: existingDoc.reviewNote,
                                  submittedAtLabel: new Date(existingDoc.submittedAt).toLocaleDateString(
                                    "pt-BR",
                                    { timeZone: "UTC" },
                                  ),
                                }
                              : null
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Wire the colaborador branch into `page.tsx`**

Replace the full contents of `apps/web/src/app/(app)/onboarding/page.tsx` with:

```typescript
import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { ColaboradorOnboarding } from "./colaborador-onboarding";
import { OnboardingRow } from "./onboarding-row";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
  requiresUpload: boolean;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
};

type AdmissionDocumentRecord = {
  id: string;
  kind: string | null;
  title: string;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  reviewNote: string | null;
  submittedAt: string;
};

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }

  if (session.role === "colaborador") {
    const [{ tasks, completedTaskIds }, admissionDocuments] = await Promise.all([
      apiFetchJson<{ tasks: Task[]; completedTaskIds: string[] }>("/onboarding/tarefas"),
      apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
    ]);
    return (
      <ColaboradorOnboarding
        tasks={tasks}
        completedTaskIds={completedTaskIds}
        admissionDocuments={admissionDocuments}
      />
    );
  }

  const progress = await apiFetchJson<TeamProgress[]>("/onboarding/equipe");

  if (progress.length === 0) {
    return (
      <EmptyState
        title="Onboarding"
        description="O progresso de integração dos colaboradores vai aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <ul className={styles.list}>
        {progress.map((entry) => (
          <OnboardingRow key={entry.userId} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Fix the same translucent-dialog bug in this file's dialog (drive-by, same class already fixed today in colaboradores/documentos)**

In `apps/web/src/app/(app)/onboarding/onboarding.module.css`, find:

```css
.dialog {
  margin: auto;
  border: none;
  border-radius: 12px;
  padding: 24px;
  width: min(480px, calc(100vw - 48px));
  background: var(--color-background);
  color: var(--color-text);
}
```

Replace `background: var(--color-background);` with `background: var(--color-modal-background);` (the solid token added to `globals.css` earlier today specifically so dialogs stop inheriting `.main`'s translucent "glass over photo" override):

```css
.dialog {
  margin: auto;
  border: none;
  border-radius: 12px;
  padding: 24px;
  width: min(480px, calc(100vw - 48px));
  background: var(--color-modal-background);
  color: var(--color-text);
}
```

- [ ] **Step 6: Add colaborador to the nav**

In `apps/web/src/lib/nav-sections.ts`, change:

```typescript
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh"] },
```

to:

```typescript
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh", "colaborador"] },
```

Then add an entry to `COLABORADOR_SIDEBAR` (after `/mural`, before `/notificacoes`):

```typescript
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    href: "/",
    label: "Colaborador",
    children: [
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
      { href: "/holerites", label: "Holerites" },
    ],
  },
  { href: "/banco-de-horas", label: "Banco de Horas" },
  { href: "/ferias", label: "Férias" },
  { href: "/documentos", label: "Documentos" },
  { href: "/mural", label: "Mural" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/notificacoes", label: "Notificações" },
];
```

- [ ] **Step 7: Type-check**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Write the e2e test**

Create `apps/web/e2e/onboarding.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador sees the onboarding checklist with a progress bar", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false },
        { id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true },
      ],
      completedTaskIds: ["task-1"],
    },
  });
  await mockApi(request, { myAdmissionDocuments: [] });

  await page.goto("/onboarding");

  await expect(page.getByText("1 de 2 concluídos")).toBeVisible();
  await expect(page.getByText("Assinar o contrato")).toBeVisible();
  await expect(page.getByText("Enviar documentos")).toBeVisible();
});

test("the Enviar documentos task shows the 5 fixed document boxes when expanded, not a toggle", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
    },
  });
  await mockApi(request, { myAdmissionDocuments: [] });

  await page.goto("/onboarding");
  await page.getByText("Enviar documentos").click();

  await expect(page.getByText("RG", { exact: true })).toBeVisible();
  await expect(page.getByText("CPF", { exact: true })).toBeVisible();
  await expect(page.getByText("Comprovante de endereço", { exact: true })).toBeVisible();
  await expect(page.getByText("Certidão de casamento", { exact: true })).toBeVisible();
  await expect(page.getByText("Certidão de nascimento dos filhos", { exact: true })).toBeVisible();
});

test("submitting a document box from Onboarding posts to the same admissionais endpoint used by Documentos", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
    },
  });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", kind: "rg", title: "RG", status: "enviado", submittedAt: "2026-09-05T12:00:00.000Z" },
  });

  await page.goto("/onboarding");
  await page.getByText("Enviar documentos").click();
  const rgBox = page.locator("li").filter({ has: page.getByText("RG", { exact: true }) });
  await rgBox.locator('input[type="file"]').setInputFiles({
    name: "rg.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });
  await rgBox.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/admissionais")?.body;
    })
    .toEqual({ kind: "rg", photos: [expect.stringMatching(/^data:image\/jpeg;base64,/)] });
});

test("toggling a non-upload task calls the toggle endpoint", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: [],
    },
  });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await page.getByText("Assinar o contrato").click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-1/toggle");
    })
    .toBe(true);
});
```

Check `apps/web/e2e/test-session.ts` for whether `mockApi`'s `myAdmissionDocuments` key already seeds `GET /documentos/admissionais` (it does — reused from the Documentos suite built earlier today); if the key name differs, match whatever `mockApi` actually accepts there instead of guessing.

- [ ] **Step 9: Run the new e2e tests**

The real API dev server on port 3000 conflicts with the fake test server. Free the port first:

```bash
netstat -ano | grep ":3000" | grep LISTENING
taskkill //PID <pid-from-above> //F
```

```bash
cd apps/web
npx playwright test onboarding.spec.ts
```

Expected: all 4 tests pass.

Restart the API dev server afterward so the live app keeps working:

```bash
cd apps/api
nohup npm run start:dev > /tmp/api-dev.log 2>&1 &
disown
sleep 8
curl -s -o /dev/null -w "api:%{http_code}\n" http://localhost:3000/
```

Expected: `api:200`.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/\(app\)/onboarding apps/web/src/lib/nav-sections.ts apps/web/e2e/onboarding.spec.ts
git commit -m "feat(web): colaborador onboarding checklist with embedded document upload"
```

---

### Task 3: Mobile — extract shared box components, embed upload in Onboarding

**Files:**
- Create: `apps/mobile/src/components/status-badge.tsx`
- Create: `apps/mobile/src/components/admission-document-box.tsx`
- Modify: `apps/mobile/src/app/(tabs)/documentos.tsx`
- Modify: `apps/mobile/src/lib/onboarding-api.ts`
- Modify: `apps/mobile/src/app/onboarding.tsx`
- Test: `apps/mobile/src/__tests__/app/onboarding.test.tsx` (new)

**Interfaces:**
- Consumes: `submitAdmissionDocument`, `fetchAdmissionDocuments`, `ADMISSION_DOCUMENT_KINDS`, `ADMISSION_DOCUMENT_KIND_LABELS`, `ADMISSION_DOCUMENT_MAX_PHOTOS`, `type AdmissionDocumentKind`, `type AdmissionDocumentRecord` — all already exported from `apps/mobile/src/lib/documentos-api.ts`. `DOCUMENT_STATUS_LABEL`, `type DocumentStatus` from `apps/mobile/src/lib/documentos.ts`.
- Produces: `StatusBadge({ status: DocumentStatus })` and `AdmissionDocumentBox({ kind: AdmissionDocumentKind; label: string; existing: AdmissionDocumentRecord | null; onSubmitted: (doc: AdmissionDocumentRecord) => void })` — both importable from `@/components/status-badge` and `@/components/admission-document-box`.

- [ ] **Step 1: Extract `StatusBadge` into its own component**

Create `apps/mobile/src/components/status-badge.tsx`:

```typescript
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { DOCUMENT_STATUS_LABEL, type DocumentStatus } from "@/lib/documentos";

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const theme = useTheme();
  const color: Record<DocumentStatus, string> = {
    enviado: theme.secondary,
    em_analise: theme.secondary,
    aprovado: theme.success,
    recusado: theme.accent,
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: color[status] }]}>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {DOCUMENT_STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
});
```

In `apps/mobile/src/app/(tabs)/documentos.tsx`:
- Delete the local `function StatusBadge({ status }: { status: DocumentStatus }) { ... }` definition.
- Delete the now-unused `statusBadge` entry from the file's `StyleSheet.create({...})` (only the local `StatusBadge` used it).
- Add `import { StatusBadge } from "@/components/status-badge";` near the other `@/components/*` imports.

- [ ] **Step 2: Extract `AdmissionDocumentBox` into its own component**

Create `apps/mobile/src/components/admission-document-box.tsx`:

```typescript
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { StatusBadge } from "@/components/status-badge";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Spacing } from "@/constants/theme";
import { pickPhoto } from "@/lib/photo-picker";
import { readPhotoAsDataUrl } from "@/lib/photo-data-url";
import { getSessionToken } from "@/lib/session";
import {
  ADMISSION_DOCUMENT_MAX_PHOTOS,
  submitAdmissionDocument,
  type AdmissionDocumentKind,
  type AdmissionDocumentRecord,
} from "@/lib/documentos-api";
import type { DocumentStatus } from "@/lib/documentos";

// One fixed document type (RG, CPF, ...) — upload + current status live in
// the same box; resubmitting replaces the whole photo set and puts the
// document back to "enviado" (see DocumentosService.createAdmissionDocument).
// Shared by the Documentos "Admissionais" tab and the Onboarding "Enviar
// documentos" task, which post to the exact same endpoint.
export function AdmissionDocumentBox({
  kind,
  label,
  existing,
  onSubmitted,
}: {
  kind: AdmissionDocumentKind;
  label: string;
  existing: AdmissionDocumentRecord | null;
  onSubmitted: (doc: AdmissionDocumentRecord) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const atMax = photoUris.length >= ADMISSION_DOCUMENT_MAX_PHOTOS;

  function resetPhotos() {
    setPhotoUris([]);
  }

  async function handlePickPhoto(source: "camera" | "library") {
    if (atMax) return;
    const uri = await pickPhoto(source);
    if (!uri) return;
    setPhotoUris((current) => [...current, uri]);
  }

  function removePhoto(index: number) {
    setPhotoUris((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (photoUris.length === 0) {
      Alert.alert("Foto obrigatória", "Tire ao menos uma foto antes de enviar.");
      return;
    }
    const token = await getSessionToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const photos = await Promise.all(photoUris.map((uri) => readPhotoAsDataUrl(uri)));
      const created = await submitAdmissionDocument(token, { kind, photos });
      if (created) {
        onSubmitted(created);
        resetPhotos();
        setExpanded(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      testID={`admission-box-${kind}`}
      style={[styles.form, { backgroundColor: theme.backgroundElement }, Elevation.card]}
    >
      <View style={styles.boxHeader}>
        <View style={styles.rowContent}>
          <ThemedText type="smallBold">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {existing
              ? `Enviado em ${new Date(existing.submittedAt).toLocaleDateString("pt-BR")}`
              : "Nenhum documento enviado ainda."}
          </ThemedText>
        </View>
        {existing ? <StatusBadge status={existing.status as DocumentStatus} /> : null}
      </View>

      <ThemedButton
        title={expanded ? "Cancelar" : existing ? "Reenviar" : "Enviar"}
        onPress={() => {
          if (expanded) resetPhotos();
          setExpanded((value) => !value);
        }}
      />

      {expanded ? (
        <View style={styles.list}>
          <ThemedText type="small" themeColor="textSecondary">
            {`Fotos (até ${ADMISSION_DOCUMENT_MAX_PHOTOS}) — ${photoUris.length}/${ADMISSION_DOCUMENT_MAX_PHOTOS}`}
          </ThemedText>
          <View style={styles.photoButtons}>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background, opacity: atMax ? 0.5 : 1 }]}
              disabled={atMax}
              onPress={() => handlePickPhoto("camera")}
            >
              <Ionicons name="camera-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Tirar foto</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.photoButton, { backgroundColor: theme.background, opacity: atMax ? 0.5 : 1 }]}
              disabled={atMax}
              onPress={() => handlePickPhoto("library")}
            >
              <Ionicons name="image-outline" size={20} color={theme.secondary} />
              <ThemedText type="small">Escolher da galeria</ThemedText>
            </Pressable>
          </View>
          {photoUris.length > 0 ? (
            <View style={styles.photoPreviewRow}>
              {photoUris.map((uri, index) => (
                <Pressable key={index} onPress={() => removePhoto(index)}>
                  <Image source={{ uri }} style={styles.previewSmall} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
          <ThemedButton
            title={submitting ? "Enviando..." : "Enviar"}
            onPress={submitting ? () => {} : handleSubmit}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  boxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  list: {
    gap: Spacing.two,
  },
  photoButtons: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  photoPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  previewSmall: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
});
```

In `apps/mobile/src/app/(tabs)/documentos.tsx`:
- Delete the local `function AdmissionDocumentBox({ ... }) { ... }` definition entirely (the whole function, including its own `handlePickPhoto`/`handleSubmit`/etc. — it's being replaced by the import).
- Delete the now-unused `boxHeader`, `photoPreviewRow`, `previewSmall` entries from this file's `StyleSheet.create({...})` (only the removed local `AdmissionDocumentBox` used them — `form`, `rowContent`, `list`, `photoButtons`, `photoButton` stay, `AtestadosSection` and others in this file still use them).
- Add `import { AdmissionDocumentBox } from "@/components/admission-document-box";`.
- Remove `ADMISSION_DOCUMENT_MAX_PHOTOS` and `type AdmissionDocumentKind` from this file's `@/lib/documentos-api` import list if nothing else in the file still uses them (check first — `ADMISSION_DOCUMENT_KINDS` and `ADMISSION_DOCUMENT_KIND_LABELS` **are** still used directly by `AdmissionaisSection` in this file and must stay imported).
- `AdmissionaisSection`'s JSX referencing `<AdmissionDocumentBox kind={...} label={...} existing={...} onSubmitted={...} />` needs no changes — same props, now resolved via the import instead of a local function.

- [ ] **Step 3: Type-check mobile after the extraction, before touching onboarding**

```bash
cd apps/mobile
npx tsc --noEmit
```

Expected: no errors. If there are unused-import errors, remove exactly those imports (don't guess — the compiler tells you which).

- [ ] **Step 4: Add `requiresUpload` to the mobile onboarding types**

In `apps/mobile/src/lib/onboarding-api.ts`, change:

```typescript
export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
};
```

to:

```typescript
export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
};
```

- [ ] **Step 5: Write the failing test for the onboarding screen**

Create `apps/mobile/src/__tests__/app/onboarding.test.tsx`:

```typescript
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import { saveSessionToken } from "@/lib/session";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

globalThis.fetch = jest.fn();

describe("onboarding screen", () => {
  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-rg.jpg" }],
    });

    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/tarefas")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tasks: [
              { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "Revise.", order: 1, requiresUpload: false },
              { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "RG, CPF...", order: 2, requiresUpload: true },
            ],
            completedTaskIds: [],
          }),
        });
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
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    await saveSessionToken("test-token");
  });

  it("shows the checklist with the upload task alongside plain toggle tasks", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Assinar o contrato")).toBeTruthy();
    });
    expect(screen.getByText("Enviar documentos")).toBeTruthy();
  });

  it("expanding the upload task shows the 5 fixed document boxes instead of toggling", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Enviar documentos"));

    expect(screen.getByText("RG")).toBeTruthy();
    expect(screen.getByText("CPF")).toBeTruthy();
    expect(screen.getByText("Comprovante de endereço")).toBeTruthy();
    expect(screen.getByText("Certidão de casamento")).toBeTruthy();
    expect(screen.getByText("Certidão de nascimento dos filhos")).toBeTruthy();
  });

  it("submitting a document from the onboarding task posts to /documentos/admissionais", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Enviar documentos"));

    const rgBox = within(screen.getByTestId("admission-box-rg"));
    fireEvent.press(rgBox.getByText("Enviar"));
    fireEvent.press(rgBox.getAllByText("Tirar foto")[0]);
    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
    fireEvent.press(rgBox.getByText("Enviar"));

    await waitFor(() => {
      const submitCall = (globalThis.fetch as jest.Mock).mock.calls.find(
        ([url, options]: [string, RequestInit | undefined]) =>
          url.endsWith("/documentos/admissionais") && options?.method === "POST",
      );
      expect(submitCall).toBeTruthy();
      const body = JSON.parse(submitCall![1].body as string) as Record<string, unknown>;
      expect(body).toEqual({ kind: "rg", photos: ["data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh"] });
    });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
cd apps/mobile
npx jest onboarding.test.tsx
```

Expected: fails — `onboarding.tsx` doesn't yet render the upload boxes for `requiresUpload` tasks (still shows a toggle `Pressable` for every task).

- [ ] **Step 7: Implement the onboarding screen change**

Replace the full contents of `apps/mobile/src/app/onboarding.tsx` with:

```typescript
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { AdmissionDocumentBox } from "@/components/admission-document-box";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  ADMISSION_DOCUMENT_KIND_LABELS,
  ADMISSION_DOCUMENT_KINDS,
  fetchAdmissionDocuments,
  type AdmissionDocumentRecord,
} from "@/lib/documentos-api";
import { fetchOnboardingTasks, toggleOnboardingTask, type OnboardingTaskRecord } from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

export default function OnboardingScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<OnboardingTaskRecord[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const [tasksResult, documentsResult] = await Promise.all([
          fetchOnboardingTasks(token),
          fetchAdmissionDocuments(token),
        ]);
        if (cancelled) return;
        if (tasksResult) {
          setTasks(tasksResult.tasks);
          setDone(new Set(tasksResult.completedTaskIds));
        }
        if (documentsResult) setAdmissionDocuments(documentsResult);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
  }

  const uploadTask = tasks.find((task) => task.requiresUpload);
  const byKind = new Map(
    admissionDocuments.filter((doc) => doc.kind).map((doc) => [doc.kind as string, doc]),
  );

  const progress = tasks.length > 0 ? done.size / tasks.length : 0;

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Boas-vindas" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="default" themeColor="textSecondary">
          Complete os passos abaixo antes do seu primeiro dia.
        </ThemedText>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.secondary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done.size} de {tasks.length} concluídos
        </ThemedText>

        <View style={styles.list}>
          {tasks.map((task) => {
            const checked = done.has(task.id);
            const expanded = expandedTaskId === task.id;
            return (
              <View key={task.id} style={styles.taskGroup}>
                <Pressable
                  onPress={() =>
                    task.requiresUpload
                      ? setExpandedTaskId(expanded ? null : task.id)
                      : toggle(task.id)
                  }
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
                          setAdmissionDocuments((current) => [
                            created,
                            ...current.filter((d) => d.kind !== kind),
                          ]);
                          if (uploadTask) setDone((current) => new Set(current).add(uploadTask.id));
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
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

- [ ] **Step 8: Run the test to verify it passes**

```bash
npx jest onboarding.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 9: Type-check and run the full mobile suite**

```bash
npx tsc --noEmit
npx jest
```

Expected: `tsc` clean. `jest` shows the same baseline as before this task plus the 3 new passing tests (there is one known pre-existing unrelated failure in `ferias.test.tsx`, a date-sensitive calendar test — confirm it's still the *only* failure, nothing new).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/components/status-badge.tsx apps/mobile/src/components/admission-document-box.tsx apps/mobile/src/app/\(tabs\)/documentos.tsx apps/mobile/src/lib/onboarding-api.ts apps/mobile/src/app/onboarding.tsx apps/mobile/src/__tests__/app/onboarding.test.tsx
git commit -m "feat(mobile): embed document upload boxes in the Onboarding upload task"
```

---

### Task 4: Full verification, live smoke test, push

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything built in Tasks 1–3.
- Produces: nothing — this is the final gate before push.

- [ ] **Step 1: Full API suite**

```bash
cd apps/api
npx jest
```

Expected: same 9 pre-existing unrelated `auth.service.spec.ts` failures as the session's established baseline, everything else passing.

- [ ] **Step 2: Full web type-check and e2e suite**

```bash
cd apps/web
npx tsc --noEmit
npx playwright test
```

Free port 3000 first if the real API dev server is running (see Task 2 Step 9). Expected: `tsc` clean, all e2e tests passing.

- [ ] **Step 3: Full mobile suite**

```bash
cd apps/mobile
npx tsc --noEmit
npx jest
```

Expected: `tsc` clean, same baseline as Task 3 Step 9.

- [ ] **Step 4: Live smoke test — web**

Log in as `colaborador@dev.local` / `dev12345`, go to `/onboarding`, confirm:
- The checklist renders with a progress bar.
- Clicking "Enviar documentos" expands the 5 boxes.
- Submitting a photo in the RG box succeeds and, after the page refresh, the "Enviar documentos" task now shows "Concluído".
- Going to `/documentos?categoria=admissionais` shows that same RG submission.

Clean up any test data created (delete the test `AdmissionDocument` row via the same `node -e "..."` pattern used throughout this session) before finishing.

- [ ] **Step 5: Live smoke test — mobile (if a running Android/iOS environment is available; otherwise skip and note it in the final report)**

Same flow as Step 4, in the Expo app: Onboarding tab → expand "Enviar documentos" → submit an RG photo → confirm the task shows as done.

- [ ] **Step 6: Restart both dev servers for normal use**

```bash
cd apps/api && nohup npm run start:dev > /tmp/api-dev.log 2>&1 & disown
cd apps/web && nohup npm run dev > /tmp/web-dev.log 2>&1 & disown
sleep 8
curl -s -o /dev/null -w "api:%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "web:%{http_code}\n" http://localhost:3001/
```

Expected: both `200`/`307`.

- [ ] **Step 7: Push**

```bash
git log --oneline -5
git push
```

Confirm the 3 commits from Tasks 1–3 are present and pushed to the remote's current branch.
