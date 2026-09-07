# Onboarding Access Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A colaborador with incomplete onboarding is confined to `/onboarding` (sidebar shows only that item, every other route redirects there); completing all tasks auto-unlocks the full portal with a congratulations modal, and gestor/rh keep a manual "exception" button to unlock someone early.

**Architecture:** Backend derives "unlocked" from a single `OnboardingAccessGrant` row per user (now carrying `source: 'auto' | 'manual'`), auto-created the moment every task completes (from any of the four completion paths) or manually created by gestor/rh via an always-clickable exception button. A new `apps/web/src/middleware.ts` is the single enforcement point on the web side — no new guard on the API.

**Tech Stack:** NestJS + Prisma (SQLite) on the API; Next.js App Router (Server Components + Server Actions) on the web; Playwright for e2e; Jest for unit/integration tests.

**Spec:** [`docs/superpowers/specs/2026-09-07-onboarding-access-gating-design.md`](../specs/2026-09-07-onboarding-access-gating-design.md)

## Global Constraints

- Bloqueio só na camada web — nenhum guard novo na API além do endpoint de leitura `myStatus`.
- Só `colaborador` passa pelo gate — `gestor`/`rh` nunca são restringidos.
- O botão manual do RH nunca fica desabilitado por "trilha incompleta" — só desabilita quando já existe um grant (`fullAccessGrantedAt`).
- Falha ao consultar `/onboarding/meu-status` no middleware é fail-open (`unlocked: true`), nunca trava a navegação inteira.
- Nenhuma mudança na API ganha um novo `@Roles` restritivo além do que a spec pede (`myStatus` é aberto a qualquer usuário autenticado, sem `RolesGuard`).

---

## Task 1: Schema — `OnboardingAccessGrant.source` / `grantedByName`

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `OnboardingAccessGrant`, currently 3 fields: `id`, `userId`, `grantedAt`)
- Create: `apps/api/prisma/migrations/20260907160000_add_onboarding_access_grant_source/migration.sql`

**Interfaces:**
- Produces: `OnboardingAccessGrant.source: string` (default `"auto"`), `OnboardingAccessGrant.grantedByName: string | null` — every later task's Prisma calls against this model use these two fields.

- [ ] **Step 1: Edit the schema**

In `apps/api/prisma/schema.prisma`, find:

```prisma
model OnboardingAccessGrant {
  id        String   @id @default(uuid())
  userId    String   @unique
  grantedAt DateTime @default(now())
}
```

Replace with:

```prisma
model OnboardingAccessGrant {
  id            String   @id @default(uuid())
  userId        String   @unique
  grantedAt     DateTime @default(now())
  source        String   @default("auto") // "auto" | "manual"
  grantedByName String?  // set only when source = "manual"
}
```

- [ ] **Step 2: Write the migration by hand**

`npx prisma migrate dev` fails non-interactively in this environment — migrations are hand-written then applied via `migrate deploy`, matching every other migration already in `apps/api/prisma/migrations/`.

Create `apps/api/prisma/migrations/20260907160000_add_onboarding_access_grant_source/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "OnboardingAccessGrant" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "OnboardingAccessGrant" ADD COLUMN "grantedByName" TEXT;
```

- [ ] **Step 3: Apply the migration to dev.db and test.db, regenerate the client**

Before running this, check for and kill any running `nest start --watch` process — it holds the Prisma query-engine DLL open on Windows and `prisma generate` fails with `EPERM` otherwise:

```bash
cd apps/api
npx prisma migrate deploy
npm run migrate-test-db
npx prisma generate
```

Expected: all three commands print success (`All migrations have been successfully applied.` / `✔ Generated Prisma Client`). If `prisma generate` fails with `EPERM: operation not permitted, rename ...query_engine-windows.dll.node...`, find and stop the process holding it (`Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` in PowerShell, filter by `CommandLine` containing `nest` or `dist\src\main`), then retry `npx prisma generate` alone.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260907160000_add_onboarding_access_grant_source/
git commit -m "feat(api): add source/grantedByName to OnboardingAccessGrant"
```

---

## Task 2: `OnboardingService.checkAutoUnlock` + `isUnlocked`, wired into the two toggles

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Test: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (already injected), `NotificationsService.sendFullAccessGranted(userId: string): Promise<void>` (already exists, unchanged).
- Produces: `OnboardingService.checkAutoUnlock(userId: string): Promise<void>`, `OnboardingService.isUnlocked(userId: string): Promise<boolean>` — Task 5 (controller) and Task 6 (DocumentosService) call these by these exact names.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `apps/api/src/onboarding/onboarding.service.spec.ts`, right after the existing `describe('grantFullAccess', ...)` block (before the file's final closing `});`):

```typescript
  describe('checkAutoUnlock and isUnlocked', () => {
    // Same per-case reset reasoning as the describe blocks above:
    // getTasks/isUnlocked see every OnboardingTask row system-wide.
    beforeEach(async () => {
      await prisma.onboardingTask.deleteMany();
    });

    afterEach(async () => {
      await prisma.onboardingAccessGrant.deleteMany({
        where: { userId: { in: ['user-auto-a', 'user-auto-b', 'user-auto-c'] } },
      });
    });

    it('isUnlocked is false with no grant and an incomplete track', async () => {
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });

      expect(await service.isUnlocked('user-auto-a')).toBe(false);
    });

    it('checkAutoUnlock does nothing while the track is incomplete', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Enviar documentos', description: '...', order: 2 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-auto-a', taskId: task.id } });

      await service.checkAutoUnlock('user-auto-a');

      expect(await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-auto-a' } })).toBeNull();
      expect(await service.isUnlocked('user-auto-a')).toBe(false);
    });

    it('checkAutoUnlock creates an auto grant and notifies once the track is complete', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-auto-b', taskId: task.id } });

      await service.checkAutoUnlock('user-auto-b');

      const grant = await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-auto-b' } });
      expect(grant).toMatchObject({ source: 'auto', grantedByName: null });
      expect(notificationsMock.sendFullAccessGranted).toHaveBeenCalledWith('user-auto-b');
      expect(await service.isUnlocked('user-auto-b')).toBe(true);
    });

    it('checkAutoUnlock is a no-op if a grant already exists (does not re-notify or overwrite it)', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-auto-c', taskId: task.id } });
      await prisma.onboardingAccessGrant.create({
        data: { userId: 'user-auto-c', source: 'manual', grantedByName: 'Carla RH' },
      });

      await service.checkAutoUnlock('user-auto-c');

      const grant = await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-auto-c' } });
      expect(grant).toMatchObject({ source: 'manual', grantedByName: 'Carla RH' });
      expect(notificationsMock.sendFullAccessGranted).not.toHaveBeenCalled();
    });

    it('isUnlocked is true once a grant exists, even before checkAutoUnlock is called', async () => {
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });
      await prisma.onboardingAccessGrant.create({ data: { userId: 'user-auto-a', source: 'manual' } });

      expect(await service.isUnlocked('user-auto-a')).toBe(true);
    });
  });
```

Also add cleanup for the pre-existing test that now has a side effect: in the `describe('derived completion for requiresAccessChecklist tasks, and toggleAccessItem', ...)` block, the test `'marks requiresAccessChecklist complete once every fixed item is checked'` completes the *only* task in the table for `user-access-c` via `toggleAccessItem` — once Step 3 below wires `checkAutoUnlock` into `toggleAccessItem`, this test will incidentally create a real auto-grant row. Add an assertion for that (turning the side effect into intentional coverage) and clean it up. Find:

```typescript
      // Unchecking any single item must flip the derived task back to incomplete.
      await service.toggleAccessItem('user-access-c', ONBOARDING_ACCESS_ITEMS[0]);
      const afterUncheck = await service.getTasks('user-access-c');
      expect(afterUncheck.completedTaskIds).not.toContain(task.id);
    });
  });
```

Replace with:

```typescript
      // Completing the only task in the table also fires the new
      // auto-unlock side effect (Task 2 of the access-gating plan) — assert
      // it here since this is the one existing test that exercises "last
      // task just completed" through the toggle path.
      expect(await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-access-c' } })).toMatchObject({
        source: 'auto',
      });

      // Unchecking any single item must flip the derived task back to incomplete.
      await service.toggleAccessItem('user-access-c', ONBOARDING_ACCESS_ITEMS[0]);
      const afterUncheck = await service.getTasks('user-access-c');
      expect(afterUncheck.completedTaskIds).not.toContain(task.id);

      await prisma.onboardingAccessGrant.deleteMany({ where: { userId: 'user-access-c' } });
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api
npx jest onboarding.service --runInBand
```

Expected: FAIL — `service.checkAutoUnlock is not a function` and `service.isUnlocked is not a function`.

- [ ] **Step 3: Implement `checkAutoUnlock` and `isUnlocked`, wire into the two toggles**

In `apps/api/src/onboarding/onboarding.service.ts`, add these two methods right after `grantFullAccess` (before the `mergeDerivedCompletion` private method):

```typescript
  // Called after any mutation that could complete the track (the two
  // toggles below, plus DocumentosService's admission-document and
  // signed-contract writes — see Task 6). Idempotent: does nothing if a
  // grant already exists (auto or manual) or the track isn't complete yet.
  async checkAutoUnlock(userId: string): Promise<void> {
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    if (tasks.length === 0 || completedTaskIds.length < tasks.length) return;

    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) return;

    await this.prisma.onboardingAccessGrant.create({ data: { userId, source: 'auto' } });
    await this.notifications.sendFullAccessGranted(userId);
  }

  // Checks both signals rather than trusting the grant row alone — same
  // defensive-derivation spirit as mergeDerivedCompletion treating
  // completion as a fact to recompute, not just stored state.
  async isUnlocked(userId: string): Promise<boolean> {
    const grant = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (grant) return true;
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    return tasks.length > 0 && completedTaskIds.length === tasks.length;
  }
```

Then wire `checkAutoUnlock` into both toggles. In `toggleTask`, find:

```typescript
    await this.prisma.onboardingProgress.create({ data: { userId, taskId } });
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (task) {
      await this.notifications.sendOnboardingTaskCompleted(task.title, userId, userName);
    }
    return { completed: true };
```

Replace with:

```typescript
    await this.prisma.onboardingProgress.create({ data: { userId, taskId } });
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (task) {
      await this.notifications.sendOnboardingTaskCompleted(task.title, userId, userName);
    }
    await this.checkAutoUnlock(userId);
    return { completed: true };
```

In `toggleAccessItem`, find:

```typescript
    await this.prisma.onboardingAccessItem.create({ data: { userId, itemKey } });
    return { completed: true };
```

Replace with:

```typescript
    await this.prisma.onboardingAccessItem.create({ data: { userId, itemKey } });
    await this.checkAutoUnlock(userId);
    return { completed: true };
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest onboarding.service --runInBand
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/onboarding/onboarding.service.ts apps/api/src/onboarding/onboarding.service.spec.ts
git commit -m "feat(api): auto-unlock full access once every onboarding task is complete"
```

---

## Task 3: `grantFullAccess` becomes an always-available exception

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Test: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `OnboardingService.grantFullAccess(userId: string, granterName: string): Promise<{ grantedAt: Date; source: string; grantedByName: string | null }>` — Task 5 (controller) calls this with the new second argument.

- [ ] **Step 1: Write the failing tests**

In the existing `describe('grantFullAccess', ...)` block of `apps/api/src/onboarding/onboarding.service.spec.ts`, replace the whole block (it currently requires the track to be complete — that's exactly the behavior being removed) with:

```typescript
  describe('grantFullAccess', () => {
    // Same per-case reset reasoning as the describe blocks above.
    beforeEach(async () => {
      await prisma.onboardingTask.deleteMany();
    });

    it('grants access even with pending tasks, recording who granted it', async () => {
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assinar o contrato', description: '...', order: 1 },
      });

      const result = await service.grantFullAccess('user-grant-a', 'Carla RH');

      expect(result).toMatchObject({ source: 'manual', grantedByName: 'Carla RH' });
      expect(notificationsMock.sendFullAccessGranted).toHaveBeenCalledWith('user-grant-a');

      const stored = await prisma.onboardingAccessGrant.findUnique({ where: { userId: 'user-grant-a' } });
      expect(stored).toMatchObject({ source: 'manual', grantedByName: 'Carla RH' });
    });

    it('is idempotent — calling it again returns the existing grant without re-notifying or overwriting it', async () => {
      const first = await service.grantFullAccess('user-grant-b', 'Carla RH');

      const second = await service.grantFullAccess('user-grant-b', 'Bruno Gestor');

      expect(second).toEqual(first);
      expect(notificationsMock.sendFullAccessGranted).toHaveBeenCalledTimes(1);
    });

    it('does not overwrite an existing auto grant with a manual one', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assistir ao vídeo', description: '...', order: 1 },
      });
      await prisma.onboardingProgress.create({ data: { userId: 'user-grant-c', taskId: task.id } });
      await service.checkAutoUnlock('user-grant-c');

      const result = await service.grantFullAccess('user-grant-c', 'Carla RH');

      expect(result).toMatchObject({ source: 'auto', grantedByName: null });
    });

    it('reflects fullAccessGrantedAt (null, then set) in listTeamProgress', async () => {
      await prisma.onboardingTask.create({
        data: { icon: 'key-outline', title: 'Assistir ao vídeo', description: '...', order: 1 },
      });
      await prisma.employee.create({
        data: {
          userId: 'user-grant-d',
          name: 'Grant Colaborador',
          role: 'colaborador',
          hireDate: new Date('2024-03-15'),
        },
      });

      const beforeGrant = await service.listTeamProgress();
      expect(beforeGrant.find((r) => r.userId === 'user-grant-d')?.fullAccessGrantedAt).toBeNull();

      await service.grantFullAccess('user-grant-d', 'Carla RH');

      const afterGrant = await service.listTeamProgress();
      expect(afterGrant.find((r) => r.userId === 'user-grant-d')?.fullAccessGrantedAt).not.toBeNull();
    });
  });
```

This replaces the old `it('rejects with pending tasks, without notifying', ...)` test entirely — that behavior no longer exists by design (§1 of the spec: the button is now the exception path, so it must work precisely *while* tasks are pending).

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest onboarding.service --runInBand
```

Expected: FAIL — `grantFullAccess` still throws `BadRequestException` for an incomplete track, and its signature doesn't accept a second argument yet.

- [ ] **Step 3: Implement**

In `apps/api/src/onboarding/onboarding.service.ts`, find:

```typescript
  // Manual, one-time action gestor/rh takes after every onboarding task is
  // done — not derived like the two tasks above, and not reversible: once
  // granted, re-calling this is a no-op (returns the existing grant) rather
  // than re-notifying the colaborador.
  async grantFullAccess(userId: string) {
    const { tasks, completedTaskIds } = await this.getTasks(userId);
    if (tasks.length === 0 || completedTaskIds.length < tasks.length) {
      throw new BadRequestException('Ainda há tarefas de onboarding pendentes.');
    }

    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) {
      return { grantedAt: existing.grantedAt };
    }

    const grant = await this.prisma.onboardingAccessGrant.create({ data: { userId } });
    await this.notifications.sendFullAccessGranted(userId);
    return { grantedAt: grant.grantedAt };
  }
```

Replace with:

```typescript
  // Manual exception gestor/rh can trigger at any time, complete or not —
  // checkAutoUnlock already covers the "finished everything" case on its
  // own, so every call that reaches here that actually creates a row is,
  // by definition, unlocking someone early. Idempotent either way: once a
  // grant exists (auto or manual), re-calling this returns it unchanged
  // rather than re-notifying or overwriting its source.
  async grantFullAccess(userId: string, granterName: string) {
    const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
    if (existing) {
      return { grantedAt: existing.grantedAt, source: existing.source, grantedByName: existing.grantedByName };
    }

    const grant = await this.prisma.onboardingAccessGrant.create({
      data: { userId, source: 'manual', grantedByName: granterName },
    });
    await this.notifications.sendFullAccessGranted(userId);
    return { grantedAt: grant.grantedAt, source: grant.source, grantedByName: grant.grantedByName };
  }
```

`BadRequestException` is still used elsewhere in this file? Check: search `apps/api/src/onboarding/onboarding.service.ts` for `BadRequestException` — it's only used in the code just removed, so also remove the now-unused import. Find:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
```

Replace with:

```typescript
import { Injectable } from '@nestjs/common';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest onboarding.service --runInBand
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/onboarding/onboarding.service.ts apps/api/src/onboarding/onboarding.service.spec.ts
git commit -m "feat(api): grantFullAccess becomes an always-available RH exception"
```

---

## Task 4: `getTasks`/`listTeamProgress` expose grant details

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Test: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Produces: `getTasks()` return type gains `fullAccessGrantedAt: Date | null`. `listTeamProgress()` entries gain `fullAccessGrantSource: string | null` and `fullAccessGrantedByName: string | null` (alongside the `fullAccessGrantedAt` already there). Task 9 (web `onboarding-row.tsx`) and Task 10 (web `colaborador-onboarding.tsx`) consume these exact field names.

- [ ] **Step 1: Write the failing tests**

Add to the top-level `it('returns tasks ordered and marks completed ones for the user', ...)` test's neighborhood — add a new test right after it in `apps/api/src/onboarding/onboarding.service.spec.ts`:

```typescript
  it("getTasks includes the user's own fullAccessGrantedAt", async () => {
    await prisma.onboardingTask.create({
      data: { icon: 'document-outline', title: 'Solo task', description: '...', order: 100 },
    });

    const before = await service.getTasks('user-gettasks-grant');
    expect(before.fullAccessGrantedAt).toBeNull();

    await prisma.onboardingAccessGrant.create({ data: { userId: 'user-gettasks-grant', source: 'manual' } });

    const after = await service.getTasks('user-gettasks-grant');
    expect(after.fullAccessGrantedAt).toBeInstanceOf(Date);

    await prisma.onboardingAccessGrant.deleteMany({ where: { userId: 'user-gettasks-grant' } });
  });
```

And extend the existing `it("summarizes each employee's onboarding progress against the total task count", ...)` test — find its final line:

```typescript
    expect(carla?.tasks.map((t) => t.id)).toContain(task.id);
  });
```

Replace with:

```typescript
    expect(carla?.tasks.map((t) => t.id)).toContain(task.id);
    expect(carla?.fullAccessGrantSource).toBeNull();
    expect(carla?.fullAccessGrantedByName).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest onboarding.service --runInBand
```

Expected: FAIL — `before.fullAccessGrantedAt`/`carla?.fullAccessGrantSource` are `undefined`, not matching the assertions.

- [ ] **Step 3: Implement**

In `apps/api/src/onboarding/onboarding.service.ts`, find `getTasks`:

```typescript
  async getTasks(userId: string) {
    const [tasks, progress, admissionDocuments, accessItems] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.findMany({ where: { userId }, select: { kind: true } }),
      this.prisma.onboardingAccessItem.findMany({ where: { userId } }),
    ]);
    const submittedKinds = admissionDocuments.map((d) => d.kind);
    const completedAccessItems = accessItems.map((item) => item.itemKey);
    return {
      tasks,
      completedTaskIds: this.mergeDerivedCompletion(
        tasks,
        progress.map((p) => p.taskId),
        submittedKinds,
        completedAccessItems,
      ),
      completedAccessItems,
    };
  }
```

Replace with:

```typescript
  async getTasks(userId: string) {
    const [tasks, progress, admissionDocuments, accessItems, grant] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.onboardingProgress.findMany({ where: { userId } }),
      this.prisma.admissionDocument.findMany({ where: { userId }, select: { kind: true } }),
      this.prisma.onboardingAccessItem.findMany({ where: { userId } }),
      this.prisma.onboardingAccessGrant.findUnique({ where: { userId } }),
    ]);
    const submittedKinds = admissionDocuments.map((d) => d.kind);
    const completedAccessItems = accessItems.map((item) => item.itemKey);
    return {
      tasks,
      completedTaskIds: this.mergeDerivedCompletion(
        tasks,
        progress.map((p) => p.taskId),
        submittedKinds,
        completedAccessItems,
      ),
      completedAccessItems,
      fullAccessGrantedAt: grant?.grantedAt ?? null,
    };
  }
```

Then find `listTeamProgress`:

```typescript
  async listTeamProgress() {
    const [tasks, employees, progress, accessItems, accessGrants] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
      this.prisma.onboardingProgress.findMany(),
      this.prisma.onboardingAccessItem.findMany(),
      this.prisma.onboardingAccessGrant.findMany(),
    ]);
    const grantedAtByUser = new Map(accessGrants.map((g) => [g.userId, g.grantedAt]));
```

Replace with:

```typescript
  async listTeamProgress() {
    const [tasks, employees, progress, accessItems, accessGrants] = await Promise.all([
      this.prisma.onboardingTask.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
      this.prisma.onboardingProgress.findMany(),
      this.prisma.onboardingAccessItem.findMany(),
      this.prisma.onboardingAccessGrant.findMany(),
    ]);
    const grantByUser = new Map(accessGrants.map((g) => [g.userId, g]));
```

Then, further down in the same method, find:

```typescript
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
        fullAccessGrantedAt: grantedAtByUser.get(employee.userId) ?? null,
      };
    });
  }
```

Replace with:

```typescript
      const grant = grantByUser.get(employee.userId);
      return {
        userId: employee.userId,
        userName: employee.name,
        completedCount: completedTaskIds.length,
        totalCount: tasks.length,
        tasks,
        completedTaskIds,
        fullAccessGrantedAt: grant?.grantedAt ?? null,
        fullAccessGrantSource: grant?.source ?? null,
        fullAccessGrantedByName: grant?.grantedByName ?? null,
      };
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest onboarding.service --runInBand
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/onboarding/onboarding.service.ts apps/api/src/onboarding/onboarding.service.spec.ts
git commit -m "feat(api): expose grant source/granter through getTasks and listTeamProgress"
```

---

## Task 5: `OnboardingController` — `myStatus` endpoint, `grantFullAccess` passes the granter's name

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.controller.ts`
- Test: `apps/api/src/onboarding/onboarding.controller.spec.ts`

**Interfaces:**
- Consumes: `OnboardingService.isUnlocked(userId: string): Promise<boolean>` (Task 2), `OnboardingService.grantFullAccess(userId: string, granterName: string)` (Task 3).
- Produces: `GET /onboarding/meu-status` → `{ unlocked: boolean }`, guarded by `AuthGuard` only (no `RolesGuard`). Task 7 (web middleware) and Task 8 (web layout) call this exact path.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/onboarding/onboarding.controller.spec.ts`, add `'myStatus'` to `GUARDED_HANDLERS`:

```typescript
const GUARDED_HANDLERS = [
  'getTasks',
  'toggleTask',
  'listTeamProgress',
  'toggleAccessItem',
  'grantFullAccess',
  'myStatus',
] as const;
```

Add `isUnlocked: jest.fn()` to `serviceMock`:

```typescript
  const serviceMock = {
    getTasks: jest.fn(),
    toggleTask: jest.fn(),
    listTeamProgress: jest.fn(),
    toggleAccessItem: jest.fn(),
    grantFullAccess: jest.fn(),
    isUnlocked: jest.fn(),
  };
```

Add a new guard-metadata test right after the existing `'applies RolesGuard(gestor, rh) to grantFullAccess'` test, still inside `describe('OnboardingController guard metadata', ...)`:

```typescript
  it('does NOT apply RolesGuard to myStatus (any authenticated role checks their own)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      OnboardingController.prototype.myStatus,
    ) as unknown[] | undefined;

    expect(guards).not.toContain(RolesGuard);
  });
```

Update the existing `grantFullAccess` behavior test — find:

```typescript
  it('grants full access for the given userId', async () => {
    serviceMock.grantFullAccess.mockResolvedValue({ grantedAt: new Date('2026-09-07') });

    const result = await controller.grantFullAccess('user-2');

    expect(serviceMock.grantFullAccess).toHaveBeenCalledWith('user-2');
    expect(result).toEqual({ grantedAt: new Date('2026-09-07') });
  });
});
```

Replace with:

```typescript
  it('grants full access for the given userId, passing the granter name', async () => {
    serviceMock.grantFullAccess.mockResolvedValue({
      grantedAt: new Date('2026-09-07'),
      source: 'manual',
      grantedByName: 'Test User',
    });

    const result = await controller.grantFullAccess('user-2', requestAs('user-1'));

    expect(serviceMock.grantFullAccess).toHaveBeenCalledWith('user-2', 'Test User');
    expect(result).toEqual({ grantedAt: new Date('2026-09-07'), source: 'manual', grantedByName: 'Test User' });
  });

  it("gets the authenticated user's own onboarding unlock status", async () => {
    serviceMock.isUnlocked.mockResolvedValue(true);

    const result = await controller.myStatus(requestAs('user-1'));

    expect(serviceMock.isUnlocked).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ unlocked: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest onboarding.controller --runInBand
```

Expected: FAIL — `controller.myStatus is not a function`; `grantFullAccess` still takes only one argument.

- [ ] **Step 3: Implement**

In `apps/api/src/onboarding/onboarding.controller.ts`, find:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('equipe/:userId/liberar-acesso')
  @HttpCode(200)
  grantFullAccess(@Param('userId') userId: string) {
    return this.onboarding.grantFullAccess(userId);
  }
}
```

Replace with:

```typescript
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Post('equipe/:userId/liberar-acesso')
  @HttpCode(200)
  grantFullAccess(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    return this.onboarding.grantFullAccess(userId, req.user.name);
  }

  @UseGuards(AuthGuard)
  @Get('meu-status')
  async myStatus(@Req() req: AuthenticatedRequest) {
    const unlocked = await this.onboarding.isUnlocked(req.user.sub);
    return { unlocked };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest onboarding.controller --runInBand
```

Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/onboarding/onboarding.controller.ts apps/api/src/onboarding/onboarding.controller.spec.ts
git commit -m "feat(api): add GET /onboarding/meu-status, pass granter name to grantFullAccess"
```

---

## Task 6: `DocumentosService` calls `checkAutoUnlock` after admission-document and contract writes

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.module.ts`
- Modify: `apps/api/src/documentos/documentos.module.ts`
- Modify: `apps/api/src/documentos/documentos.service.ts`
- Test: `apps/api/src/documentos/documentos.service.spec.ts`

**Interfaces:**
- Consumes: `OnboardingService.checkAutoUnlock(userId: string): Promise<void>` (Task 2), now exported from `OnboardingModule`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/documentos/documentos.service.spec.ts`, add the mock and provider. Find:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';
```

Replace with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosService } from './documentos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OnboardingService } from '../onboarding/onboarding.service';
```

Find:

```typescript
  const notificationsMock = {
    sendDocumentSubmitted: jest.fn(),
    sendDocumentStatusChanged: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosService,
        PrismaService,
        { provide: ExpoPushService, useValue: pushMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();
```

Replace with:

```typescript
  const notificationsMock = {
    sendDocumentSubmitted: jest.fn(),
    sendDocumentStatusChanged: jest.fn(),
  };
  const onboardingMock = { checkAutoUnlock: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosService,
        PrismaService,
        { provide: ExpoPushService, useValue: pushMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: OnboardingService, useValue: onboardingMock },
      ],
    }).compile();
```

Add `jest.clearAllMocks()` isn't present in this file today (it uses fresh mocks per describe implicitly) — instead, add explicit assertions right where `createAdmissionDocument`/`submitSignedContract` are already tested. Find the admission-document creation test (search for `"creates and lists admission documents scoped to the user, deriving the title from kind"`) and add, at its end, right before the test's closing `});`:

```typescript
    expect(onboardingMock.checkAutoUnlock).toHaveBeenCalledWith('user-c');
```

Inside `describe('signed contract', ...)`, find its first test, which calls:

```typescript
      const first = await service.submitSignedContract('user-contract-a', 'Ana Contrato', PDF_DATA_URL);
```

Add, right after that line:

```typescript
      expect(onboardingMock.checkAutoUnlock).toHaveBeenCalledWith('user-contract-a');
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api
npx jest documentos.service --runInBand
```

Expected: FAIL — `Nest can't resolve dependencies of DocumentosService (..., ?)` (no `OnboardingService` provider yet in the real module wiring — but since the test module explicitly lists all providers, it fails instead with `onboardingMock.checkAutoUnlock` never called, once the mock module compiles; if `DocumentosService`'s constructor doesn't yet accept a 4th argument, TypeScript compilation itself fails first, which `ts-jest` reports as a test failure).

- [ ] **Step 3: Implement**

`apps/api/src/onboarding/onboarding.module.ts` — find:

```typescript
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
```

Replace with:

```typescript
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
```

`apps/api/src/documentos/documentos.module.ts` — find:

```typescript
import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PushModule, NotificationsModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
```

Replace with:

```typescript
import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [AuthModule, PushModule, NotificationsModule, OnboardingModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
```

`apps/api/src/documentos/documentos.service.ts` — find:

```typescript
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildPayslipPdf } from './payslip-pdf';
```

Replace with:

```typescript
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../push/expo-push.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { buildPayslipPdf } from './payslip-pdf';
```

Find the constructor:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
    private readonly notifications: NotificationsService,
  ) {}
```

Replace with:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
    private readonly notifications: NotificationsService,
    private readonly onboarding: OnboardingService,
  ) {}
```

Find `createAdmissionDocument`'s end:

```typescript
    await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
    return document;
  }
```

Replace with:

```typescript
    await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
    await this.onboarding.checkAutoUnlock(userId);
    return document;
  }
```

Find `submitSignedContract`'s end:

```typescript
    await this.notifications.sendDocumentSubmitted('contrato', userId, userName);
    return { submittedAt: contract.submittedAt };
  }
```

Replace with:

```typescript
    await this.notifications.sendDocumentSubmitted('contrato', userId, userName);
    await this.onboarding.checkAutoUnlock(userId);
    return { submittedAt: contract.submittedAt };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest documentos.service onboarding --runInBand
```

Expected: PASS, all tests in both files (no regressions in `onboarding.controller.spec.ts`/`onboarding.service.spec.ts` from the module changes).

- [ ] **Step 5: Run the full API suite to check for regressions**

```bash
npx jest --runInBand
```

Expected: only the pre-existing, unrelated `auth.service.spec.ts` DI failure (documented as out-of-scope in this repo's history) — no new failures.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/onboarding/onboarding.module.ts apps/api/src/documentos/documentos.module.ts apps/api/src/documentos/documentos.service.ts apps/api/src/documentos/documentos.service.spec.ts
git commit -m "feat(api): auto-unlock check after admission-document and contract submission"
```

---

## Task 7: `apps/web/src/middleware.ts` — the enforcement point

**Files:**
- Create: `apps/web/src/middleware.ts`

**Interfaces:**
- Consumes: `GET /onboarding/meu-status` (Task 5) → `{ unlocked: boolean }`, `API_URL` from `apps/web/src/constants/api.ts` (already exists, plain string constant, no `server-only` marker).

There is no existing test infrastructure for Next.js middleware in this repo (Playwright drives the whole running app; middleware behavior is exercised end-to-end in Task 11, not unit-tested in isolation here — this task is implementation-only, verified manually and then by the e2e suite in Task 11).

- [ ] **Step 1: Create the file**

Create `apps/web/src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";

import { API_URL } from "@/constants/api";

// Duplicated from apps/web/src/lib/session.ts's SESSION_COOKIE — not
// imported because that module is marked "server-only" and middleware is a
// separate build target from both server components and the client bundle.
const SESSION_COOKIE = "ponto_session";
const ALWAYS_ALLOWED = ["/onboarding", "/login"];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next(); // no session: the shared layout's requireSession() redirects to /login

  const payload = token.split(".")[1];
  if (!payload) return NextResponse.next();

  let session: { role?: string };
  try {
    session = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return NextResponse.next();
  }

  if (session.role !== "colaborador") return NextResponse.next();
  if (ALWAYS_ALLOWED.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  let unlocked = true; // fail-open: an API hiccup must never lock everyone out
  try {
    const res = await fetch(`${API_URL}/onboarding/meu-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      unlocked = ((await res.json()) as { unlocked: boolean }).unlocked;
    }
  } catch {
    // network error reaching the API — stay fail-open
  }

  if (!unlocked) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|documents|sgp-icon.png).*)"],
};
```

- [ ] **Step 2: Manual smoke test**

Restart the web dev server (kill any stray `next dev`/`start-server.js` processes on port 3001 first — Windows can leave orphaned children the same way `nest start --watch` does), then:

```bash
cd apps/web
npm run dev
```

With the API also running, log in as `colaborador@dev.local` / `dev12345` (an account whose onboarding is incomplete — check via a quick Prisma query against `dev.db` if unsure which dev account currently has pending tasks) and confirm:
- Navigating to `http://localhost:3001/` redirects to `/onboarding`.
- Navigating to `http://localhost:3001/onboarding` directly loads normally (no redirect loop).
- Logging in as `gestor@dev.local` and visiting `/` loads normally (role isn't colaborador, middleware no-ops).

This step has no automated assertion — it's a manual checkpoint before Task 8 builds the sidebar UI on top of it. Task 11 adds the automated Playwright coverage.

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add src/middleware.ts
git commit -m "feat(web): add onboarding-gating middleware"
```

---

## Task 8: Restricted sidebar (layout → AppShell → SidebarShell → NavLinks)

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/components/sidebar-shell.tsx`
- Modify: `apps/web/src/components/nav-links.tsx`

**Interfaces:**
- Consumes: `GET /onboarding/meu-status` via `apiFetchJson` (already used elsewhere in this codebase, e.g. `apps/web/src/app/(app)/onboarding/page.tsx`).
- Produces: `AppShell`, `SidebarShell`, `NavLinks` all gain an optional `restricted?: boolean` prop.

No unit-test infrastructure exists for these components today (no `*.test.tsx` files in `apps/web/src/components/`) — this task is covered by Task 11's Playwright test, same as the rest of the sidebar/nav code already is.

- [ ] **Step 1: `apps/web/src/app/(app)/layout.tsx`**

Find:

```typescript
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Best-effort: a failure here can't take down the layout every page in
  // the portal renders through — worst case the bell opens empty until
  // the next successful navigation refetches it.
  const notifications = await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
```

Replace with:

```typescript
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Best-effort: a failure here can't take down the layout every page in
  // the portal renders through — worst case the bell opens empty until
  // the next successful navigation refetches it.
  const notifications = await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  // middleware.ts already redirects a restricted colaborador to /onboarding
  // for every other route — this second check (same endpoint) only decides
  // what the sidebar itself renders on the page middleware just let through.
  const restricted =
    user.role === "colaborador" &&
    !(await apiFetchJson<{ unlocked: boolean }>("/onboarding/meu-status").catch(() => ({ unlocked: true })))
      .unlocked;
  return (
    <AppShell user={user} notifications={notifications} restricted={restricted}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 2: `apps/web/src/components/app-shell.tsx`**

Find:

```typescript
export function AppShell({
  children,
  user,
  notifications,
}: {
  children: ReactNode;
  user: Session;
  notifications: NotificationRecord[];
}) {
  return (
    <NotificationProvider notifications={notifications}>
      <div className={styles.shell}>
        <SidebarShell role={user.role} />
```

Replace with:

```typescript
export function AppShell({
  children,
  user,
  notifications,
  restricted,
}: {
  children: ReactNode;
  user: Session;
  notifications: NotificationRecord[];
  restricted?: boolean;
}) {
  return (
    <NotificationProvider notifications={notifications}>
      <div className={styles.shell}>
        <SidebarShell role={user.role} restricted={restricted} />
```

- [ ] **Step 3: `apps/web/src/components/sidebar-shell.tsx`**

Find:

```typescript
export function SidebarShell({ role }: { role: NavRole }) {
```

Replace with:

```typescript
export function SidebarShell({ role, restricted }: { role: NavRole; restricted?: boolean }) {
```

Find:

```typescript
      <NavLinks role={role} collapsed={collapsed} />
```

Replace with:

```typescript
      <NavLinks role={role} collapsed={collapsed} restricted={restricted} />
```

- [ ] **Step 4: `apps/web/src/components/nav-links.tsx`**

Find:

```typescript
export function NavLinks({ role, collapsed }: { role: NavRole; collapsed?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (role === "colaborador") {
```

Replace with:

```typescript
export function NavLinks({
  role,
  collapsed,
  restricted,
}: {
  role: NavRole;
  collapsed?: boolean;
  restricted?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (restricted) {
    return (
      <nav className={styles.navSections}>
        <ul className={styles.nav}>
          <NavLinkItem
            link={{ href: "/onboarding", label: "Onboarding" }}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={collapsed}
          />
        </ul>
      </nav>
    );
  }

  if (role === "colaborador") {
```

- [ ] **Step 5: Manual smoke test**

With the dev server still running from Task 7:
- Log in as `colaborador@dev.local` (incomplete onboarding) — sidebar shows only "Onboarding".
- Log in as `gestor@dev.local` — sidebar unchanged (full menu).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/'(app)'/layout.tsx apps/web/src/components/app-shell.tsx apps/web/src/components/sidebar-shell.tsx apps/web/src/components/nav-links.tsx
git commit -m "feat(web): restrict sidebar to Onboarding while access is locked"
```

---

## Task 9: Gestor/rh UI — always-clickable exception button with confirmation and origin label

**Files:**
- Modify: `apps/web/src/app/(app)/onboarding/page.tsx`
- Modify: `apps/web/src/app/(app)/onboarding/onboarding-row.tsx`
- Test: `apps/web/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `fullAccessGrantSource: string | null`, `fullAccessGrantedByName: string | null` (Task 4), `grantOnboardingFullAccess(userId: string)` server action (already exists, unchanged signature).

- [ ] **Step 1: Write the failing e2e tests**

In `apps/web/e2e/onboarding.spec.ts`, find the existing test `"the 'Liberar acesso total ao SGP Portal' button is disabled while tasks are pending"` and the one right after it (`"...is enabled once every task is done, and calls the API"`) — both describe behavior that no longer exists (the button used to be disabled until complete; now it's an always-available exception). Replace both tests, plus the `"shows 'Acesso liberado' (disabled) once full access has already been granted"` test right after them, with:

```typescript
test("the 'Liberar acesso total ao SGP Portal' button is clickable even with pending tasks, and asks for confirmation", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1"],
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
    ],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/equipe/user-1/liberar-acesso",
    response: { grantedAt: "2026-09-07T12:00:00.000Z", source: "manual", grantedByName: "Bruno Gestor" },
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  const grantButton = page.getByRole("button", { name: "Liberar acesso total ao SGP Portal" });
  await expect(grantButton).toBeEnabled();
  await grantButton.click();

  await expect(page.getByText(/ainda não completou o onboarding/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar liberação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some(
        (r) => r.method === "POST" && r.path === "/onboarding/equipe/user-1/liberar-acesso",
      );
    })
    .toBe(true);
});

test("shows the grant origin once full access has already been granted, and the button is gone", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 2,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1", "task-2"],
        fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
        fullAccessGrantSource: "auto",
        fullAccessGrantedByName: null,
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByRole("button", { name: "Acesso liberado automaticamente" })).toBeDisabled();
});

test("shows who manually granted early access", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1"],
        fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
        fullAccessGrantSource: "manual",
        fullAccessGrantedByName: "Carla RH",
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByRole("button", { name: "Liberado manualmente por Carla RH" })).toBeDisabled();
});
```

Also update the fixtures in the two other tests earlier in the file that already carry `fullAccessGrantedAt: null` — `"shows each employee's onboarding progress for a gestor"` (two `onboardingProgress` entries) and `"clicking an employee opens the task list with done/pending status"` (one entry). After deleting the three tests in the step above, search the file for every remaining occurrence of:

```typescript
        fullAccessGrantedAt: null,
      },
```

and add the two new fields right after each one found:

```typescript
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
```

- [ ] **Step 2: Run the e2e test to verify it fails**

```bash
cd apps/web
npx playwright test e2e/onboarding.spec.ts
```

Expected: FAIL on the three new/changed tests — the button is still `disabled` while incomplete, there's no confirmation dialog, and there's no origin label.

- [ ] **Step 3: Implement — `page.tsx` type**

In `apps/web/src/app/(app)/onboarding/page.tsx`, find:

```typescript
type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
};
```

Replace with:

```typescript
type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};
```

- [ ] **Step 4: Implement — `onboarding-row.tsx`**

Full replacement of `apps/web/src/app/(app)/onboarding/onboarding-row.tsx`:

```typescript
"use client";

import { useRef, useState } from "react";

import { grantOnboardingFullAccess } from "./actions";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  title: string;
  description: string;
};

type TeamProgress = {
  userId: string;
  userName: string;
  completedCount: number;
  totalCount: number;
  tasks: Task[];
  completedTaskIds: string[];
  fullAccessGrantedAt: string | null;
  fullAccessGrantSource: string | null;
  fullAccessGrantedByName: string | null;
};

function grantLabel(entry: TeamProgress): string {
  if (!entry.fullAccessGrantedAt) return "Liberar acesso total ao SGP Portal";
  if (entry.fullAccessGrantSource === "manual") {
    return `Liberado manualmente por ${entry.fullAccessGrantedByName}`;
  }
  return "Acesso liberado automaticamente";
}

export function OnboardingRow({ entry }: { entry: TeamProgress }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [granting, setGranting] = useState(false);
  const percent =
    entry.totalCount === 0 ? 0 : Math.round((entry.completedCount / entry.totalCount) * 100);
  const complete = entry.totalCount > 0 && entry.completedCount === entry.totalCount;
  const completedSet = new Set(entry.completedTaskIds);

  async function handleGrantFullAccess() {
    setGranting(true);
    try {
      await grantOnboardingFullAccess(entry.userId);
    } finally {
      setGranting(false);
      confirmDialogRef.current?.close();
    }
  }

  return (
    <>
      <li className={styles.item}>
        <button
          type="button"
          className={styles.itemButton}
          onClick={() => dialogRef.current?.showModal()}
        >
          <div className={styles.itemInfo}>
            <span className={styles.itemName}>{entry.userName}</span>
            <span className={styles.itemDetail}>
              {entry.completedCount} de {entry.totalCount} tarefas concluídas
            </span>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${percent}%` }} />
            </div>
          </div>
          <span className={complete ? styles.statusComplete : styles.statusPending}>
            {complete ? "Concluído" : `${percent}%`}
          </span>
        </button>
      </li>

      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Tarefas de {entry.userName}</p>
        <ul className={styles.taskList}>
          {entry.tasks.map((task) => {
            const done = completedSet.has(task.id);
            return (
              <li key={task.id} className={styles.taskItem}>
                <span className={done ? styles.taskDone : styles.taskPending}>
                  {done ? "Concluída" : "Pendente"}
                </span>
                <div className={styles.taskInfo}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={styles.taskDescription}>{task.description}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={styles.grantAccessButton}
          disabled={granting || Boolean(entry.fullAccessGrantedAt)}
          onClick={() => confirmDialogRef.current?.showModal()}
        >
          {grantLabel(entry)}
        </button>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => dialogRef.current?.close()}
          >
            Fechar
          </button>
        </div>
      </dialog>

      <dialog ref={confirmDialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>Liberar acesso total ao SGP Portal para {entry.userName}?</p>
        <p className={styles.itemDetail}>
          {entry.userName} ainda não completou o onboarding ({entry.completedCount} de{" "}
          {entry.totalCount}). Essa é uma exceção manual — o colaborador ganha acesso completo ao
          portal mesmo assim.
        </p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={() => confirmDialogRef.current?.close()}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.grantAccessButton}
            disabled={granting}
            onClick={handleGrantFullAccess}
          >
            Confirmar liberação
          </button>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 5: Run the e2e tests to verify they pass**

```bash
npx playwright test e2e/onboarding.spec.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/'(app)'/onboarding/page.tsx apps/web/src/app/'(app)'/onboarding/onboarding-row.tsx apps/web/e2e/onboarding.spec.ts
git commit -m "feat(web): full-access-grant button becomes an always-available exception with confirmation"
```

---

## Task 10: Colaborador congrats modal

**Files:**
- Modify: `apps/web/src/app/(app)/onboarding/page.tsx`
- Modify: `apps/web/src/app/(app)/onboarding/colaborador-onboarding.tsx`
- Test: `apps/web/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `fullAccessGrantedAt: string | null` from `GET /onboarding/tarefas` (Task 4 added this to `getTasks`'s response).

- [ ] **Step 1: Write the failing e2e test**

In `apps/web/e2e/onboarding.spec.ts`, add a new test (anywhere among the colaborador-facing tests, e.g. right after `"toggling a non-upload task calls the toggle endpoint"`):

```typescript
test("completing the last task shows a congratulations modal with a link to the dashboard", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: [],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Parabéns", { exact: false })).toHaveCount(0);

  // Re-seed the GET *before* clicking — same ordering reasoning as the
  // existing "after uploading a document, the task flips to Concluído"
  // test: the click's revalidatePath races an already-seeded response.
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: "2026-09-07T12:00:00.000Z",
    },
  });

  const taskItem = page.locator("li", { hasText: "Assinar o contrato" });
  await taskItem.click();

  await expect(page.getByText("Parabéns! Onboarding concluído")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o Dashboard" })).toHaveAttribute("href", "/");
});

test("does not show the congratulations modal on a fresh load that is already unlocked", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
    },
  });

  await page.goto("/onboarding");

  await expect(page.getByText("Parabéns", { exact: false })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

```bash
cd apps/web
npx playwright test e2e/onboarding.spec.ts
```

Expected: FAIL on both new tests — no modal exists yet, and `getTasks`'s response doesn't feed `fullAccessGrantedAt` into `ColaboradorOnboarding` yet.

- [ ] **Step 3: Implement — `page.tsx` wiring**

In `apps/web/src/app/(app)/onboarding/page.tsx`, find:

```typescript
  if (session.role === "colaborador") {
    const [{ tasks, completedTaskIds, completedAccessItems }, admissionDocuments, signedContract] = await Promise.all([
      apiFetchJson<{ tasks: Task[]; completedTaskIds: string[]; completedAccessItems: string[] }>(
        "/onboarding/tarefas",
      ),
      apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
      apiFetchJson<{ submittedAt: string | null }>("/documentos/contrato"),
    ]);
    return (
      <ColaboradorOnboarding
        tasks={tasks}
        completedTaskIds={completedTaskIds}
        admissionDocuments={admissionDocuments}
        signedContract={signedContract}
        completedAccessItems={completedAccessItems}
      />
    );
  }
```

Replace with:

```typescript
  if (session.role === "colaborador") {
    const [{ tasks, completedTaskIds, completedAccessItems, fullAccessGrantedAt }, admissionDocuments, signedContract] =
      await Promise.all([
        apiFetchJson<{
          tasks: Task[];
          completedTaskIds: string[];
          completedAccessItems: string[];
          fullAccessGrantedAt: string | null;
        }>("/onboarding/tarefas"),
        apiFetchJson<AdmissionDocumentRecord[]>("/documentos/admissionais"),
        apiFetchJson<{ submittedAt: string | null }>("/documentos/contrato"),
      ]);
    return (
      <ColaboradorOnboarding
        tasks={tasks}
        completedTaskIds={completedTaskIds}
        admissionDocuments={admissionDocuments}
        signedContract={signedContract}
        completedAccessItems={completedAccessItems}
        fullAccessGrantedAt={fullAccessGrantedAt}
      />
    );
  }
```

- [ ] **Step 4: Implement — `colaborador-onboarding.tsx`**

In `apps/web/src/app/(app)/onboarding/colaborador-onboarding.tsx`, find:

```typescript
"use client";

import { useState } from "react";
```

Replace with:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
```

Find:

```typescript
export function ColaboradorOnboarding({
  tasks,
  completedTaskIds,
  admissionDocuments,
  signedContract,
  completedAccessItems,
}: {
  tasks: Task[];
  completedTaskIds: string[];
  admissionDocuments: AdmissionDocumentRecord[];
  signedContract: { submittedAt: string | null };
  completedAccessItems: string[];
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAccessItem, setPendingAccessItem] = useState<string | null>(null);
```

Replace with:

```typescript
export function ColaboradorOnboarding({
  tasks,
  completedTaskIds,
  admissionDocuments,
  signedContract,
  completedAccessItems,
  fullAccessGrantedAt,
}: {
  tasks: Task[];
  completedTaskIds: string[];
  admissionDocuments: AdmissionDocumentRecord[];
  signedContract: { submittedAt: string | null };
  completedAccessItems: string[];
  fullAccessGrantedAt: string | null;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAccessItem, setPendingAccessItem] = useState<string | null>(null);
  const congratsDialogRef = useRef<HTMLDialogElement>(null);
  // Tracks the prop across renders, not local UI state — the transition
  // null -> a value is what means "just unlocked", so this must reflect
  // what the server told us last render, not a value the modal itself set.
  const previousGrantedAt = useRef(fullAccessGrantedAt);

  useEffect(() => {
    if (!previousGrantedAt.current && fullAccessGrantedAt) {
      congratsDialogRef.current?.showModal();
    }
    previousGrantedAt.current = fullAccessGrantedAt;
  }, [fullAccessGrantedAt]);
```

Find the component's closing (the very end of the file):

```typescript
      </ul>
    </div>
  );
}
```

Replace with:

```typescript
      </ul>

      <dialog ref={congratsDialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>🎉 Parabéns! Onboarding concluído</p>
        <p className={styles.itemDetail}>Seu acesso total ao SGP Portal foi liberado.</p>
        <div className={styles.dialogActions}>
          <a href="/" className={styles.grantAccessButton}>
            Ir para o Dashboard
          </a>
        </div>
      </dialog>
    </div>
  );
}
```

`<a href="/">` is a full navigation (not `<Link>`), deliberately — it re-runs the middleware from Task 7 with a fresh request, so the now-unlocked colaborador gets the full sidebar immediately, without needing a second manual reload.

- [ ] **Step 5: Run the e2e tests to verify they pass**

```bash
npx playwright test e2e/onboarding.spec.ts
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Run the full onboarding + documentos e2e files together to check for regressions**

```bash
npx playwright test e2e/onboarding.spec.ts e2e/documentos.spec.ts e2e/holerites.spec.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/'(app)'/onboarding/page.tsx apps/web/src/app/'(app)'/onboarding/colaborador-onboarding.tsx apps/web/e2e/onboarding.spec.ts
git commit -m "feat(web): congratulations modal when the last onboarding task auto-unlocks access"
```

---

## Task 11: e2e coverage for the gating middleware itself

**Files:**
- Create: `apps/web/e2e/onboarding-gating.spec.ts`
- Modify: `apps/web/e2e/fake-api-server.mjs`
- Modify: `apps/web/e2e/test-session.ts`

**Interfaces:**
- Consumes: everything built in Tasks 1–10.

- [ ] **Step 1: Add a fake-server default and a `mockApi` seed key for `/onboarding/meu-status`**

In `apps/web/e2e/fake-api-server.mjs`, find:

```javascript
  if (req.method === "POST" && /^\/onboarding\/acessos\/[^/]+\/toggle$/.test(url.pathname)) {
    return sendJson(res, 200, { completed: true });
  }
```

Add right after it:

```javascript
  if (req.method === "GET" && url.pathname === "/onboarding/meu-status") {
    return sendJson(res, 200, { unlocked: true });
  }
```

(Default is `unlocked: true` — most e2e tests are not about the gate itself and shouldn't have to seed this to avoid being redirected away from whatever page they're testing. Tests that specifically need `unlocked: false` seed it explicitly, per below.)

In `apps/web/e2e/test-session.ts`, find:

```typescript
    myContract?: unknown;
    teamContracts?: unknown[];
  } = {}
) {
```

Replace with:

```typescript
    myContract?: unknown;
    teamContracts?: unknown[];
    onboardingUnlocked?: boolean;
  } = {}
) {
```

Find the end of the function body, right before its closing `}`:

```typescript
  if (data.teamContracts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/contrato/equipe", response: data.teamContracts },
    });
  }
}
```

Replace with:

```typescript
  if (data.teamContracts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/contrato/equipe", response: data.teamContracts },
    });
  }
  if (data.onboardingUnlocked !== undefined) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/onboarding/meu-status", response: { unlocked: data.onboardingUnlocked } },
    });
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/e2e/onboarding-gating.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("a restricted colaborador is redirected to /onboarding from any other route", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false });

  await page.goto("/mural");

  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a restricted colaborador can load /onboarding directly, no redirect loop", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false, myAdmissionDocuments: [] });

  await page.goto("/onboarding");

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Complete os passos abaixo.")).toBeVisible();
});

test("a restricted colaborador's sidebar shows only Onboarding", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false, myAdmissionDocuments: [] });

  await page.goto("/onboarding");

  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Documentos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Férias" })).toHaveCount(0);
});

test("an unlocked colaborador is not redirected, and sees the full sidebar", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: true });

  await page.goto("/mural");

  await expect(page).toHaveURL(/\/mural$/);
  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
});

test("gestor is never gated, regardless of onboarding status", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, { onboardingUnlocked: false, team: [] });

  await page.goto("/");

  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.getByRole("link", { name: "Colaboradores", exact: true })).toBeVisible();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd apps/web
npx playwright test e2e/onboarding-gating.spec.ts
```

Expected: FAIL if `middleware.ts` (Task 7) or the sidebar restriction (Task 8) aren't both in place yet. If Tasks 7–10 were already completed in order, these should already PASS at this point — this task is primarily about *codifying* that behavior into an automated, repeatable suite rather than the manual smoke tests those tasks relied on. If any test fails, it points at a gap between the manual verification done earlier and what's actually wired — fix the implementation, not the test.

- [ ] **Step 4: Run the full e2e suite to check for regressions**

```bash
npx playwright test
```

Expected: same pre-existing failures as the rest of this session's history (`auth.spec.ts`'s SSO test, two `esqueci-senha.spec.ts` tests, `login.spec.ts`'s wrong-credentials test — all pre-existing and unrelated to this feature, caused by shared seeded-state leaking across test files in the fake API server) — no *new* failures.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/onboarding-gating.spec.ts apps/web/e2e/fake-api-server.mjs apps/web/e2e/test-session.ts
git commit -m "test(web): e2e coverage for the onboarding-gating middleware and restricted sidebar"
```

---

## Final check

After Task 11, run both full suites one more time from the repo root:

```bash
cd apps/api && npx jest --runInBand
cd ../web && npx playwright test
```

Confirm no failures beyond the pre-existing, unrelated ones already called out in Tasks 6 and 11. Then let the user know the feature is complete and ask whether to commit-and-push the batch (this repo's established convention: commits happen per-task above, but pushing to `origin/master` is a separate, explicit step the user asks for).
