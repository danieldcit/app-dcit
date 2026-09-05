# Revisão de Documentos + Upload no Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestor/RH conseguem ver o que um colaborador enviou (atestado ou documento admissional) antes de decidir, decidir com Em Análise/Aprovado/Reprovado (Reprovado com justificativa), e ambos os lados recebem notificação no sino; o colaborador ganha uma tela de Onboarding no web com upload embutido na tarefa "Enviar documentos", espelhada no mobile.

**Architecture:** Backend: `NotificationsService` ganha 2 métodos novos (upload/status), reaproveitados por `AtestadosService` e um `DocumentosService` estendido (novo endpoint de status + foto pra admissionais); `OnboardingService` ganha um endpoint que cria o documento e marca a tarefa concluída num só passo. Frontend web: a fila de Aprovações (`/aprovacoes`) ganha um botão "Visualizar" que abre um diálogo com o conteúdo completo + decisão, e um novo grupo "Documentos admissionais"; Onboarding ganha uma tela pro colaborador. Mobile: mesmos rótulos/upload, só a parte do colaborador.

**Tech Stack:** NestJS + Prisma (SQLite) + Zod (`apps/api`), Next.js 16 App Router + Server Components/Route Handlers (`apps/web`), Expo Router + React Native (`apps/mobile`), Jest (api/mobile), Playwright (web e2e).

**Spec:** `docs/superpowers/specs/2026-09-05-document-review-onboarding-upload-design.md`

## Global Constraints

- Nenhuma mudança na restrição de LGPD do atestado — CID/CRM/médico/foto continuam RH-only; a única abertura nova é o próprio dono poder ver a própria foto.
- Documento admissional: foto visível a gestor **e** RH (diferente do atestado).
- Toda notificação nova: criação da(s) linha(s) `Notification` **awaited**, push sempre `void` (fire-and-forget) — nunca aguardado.
- Nenhuma tela de gestor/RH nova no mobile — aprovação de admissionais é só web.
- `/aprovacoes` decide; `/documentos` consulta — nenhuma ação de aprovar/reprovar é duplicada em `/documentos`.
- Onboarding do colaborador não introduz um novo conceito de "status de tarefa" além do `completedTaskIds` que já existe.
- **`packages/shared-types` tem um passo de build (`npm run build`, gera `dist/`) que `apps/api`, `apps/web` e `apps/mobile` consomem via `node_modules` — qualquer mudança em `packages/shared-types/src/**` só tem efeito depois de rodar `npm run build` dentro de `packages/shared-types`.** Rodar `cd apps/api && npx jest` direto (sem passar pelo `turbo run test` da raiz) NÃO reconstrói `shared-types` sozinho — descoberto ao vivo nesta mesma sessão (o schema de foto obrigatória ficou "sem efeito" por horas porque o `dist/` nunca foi reconstruído). Toda task abaixo que mexe em `packages/shared-types` já inclui o passo de build explícito — não pule.
- Depois de reconstruir `shared-types`, os dev servers de `apps/api`/`apps/web` já rodando podem estar com o pacote em cache — reinicie-os antes de testar manualmente.

---

## Task 1: Schema Prisma + seed (status default, `requiresUpload`, `reviewNote`)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`
- Test: manual (migration + seed rodados localmente; sem teste automatizado de schema)

**Interfaces:**
- Produces: `Atestado.status` (default `"em_analise"`), `AdmissionDocument.status` (default `"em_analise"`), `AdmissionDocument.reviewNote: String?`, `OnboardingTask.requiresUpload: Boolean` (default `false`) — todas as tasks seguintes dependem desses campos existirem.

- [ ] **Step 1: Editar o schema**

Em `apps/api/prisma/schema.prisma`, no `model Atestado`, trocar:
```prisma
status        String   @default("enviado")
```
por:
```prisma
status        String   @default("em_analise")
```

No `model AdmissionDocument`, trocar:
```prisma
status      String   @default("enviado")
```
por:
```prisma
status      String   @default("em_analise")
reviewNote  String?
```
(adicionar `reviewNote` logo abaixo de `status`).

No `model OnboardingTask`, adicionar ao final:
```prisma
requiresUpload Boolean @default(false)
```

- [ ] **Step 2: Editar o seed**

Em `apps/api/prisma/seed.ts`, a função `seedOnboarding` marca `requiresUpload: true` na tarefa "Enviar documentos" dentro do `createMany` (para bancos novos) **e** com um `updateMany` fora do guard (para bancos já semeados):

```typescript
async function seedOnboarding() {
  const existing = await prisma.onboardingTask.findFirst();
  if (!existing) {
    await prisma.onboardingTask.createMany({
      data: [
        {
          icon: 'document-text-outline',
          title: 'Assinar o contrato',
          description: 'Revise e assine seu contrato de trabalho digitalmente.',
          order: 1,
        },
        {
          icon: 'cloud-upload-outline',
          title: 'Enviar documentos',
          description: 'RG, CPF, comprovante de residência e demais documentos admissionais.',
          order: 2,
          requiresUpload: true,
        },
        {
          icon: 'play-circle-outline',
          title: 'Assistir ao vídeo de boas-vindas',
          description: 'Conheça a cultura e os valores da DCIT Tecnologia.',
          order: 3,
        },
        {
          icon: 'people-outline',
          title: 'Conhecer o time',
          description: 'Veja quem são as pessoas com quem você vai trabalhar.',
          order: 4,
        },
        {
          icon: 'key-outline',
          title: 'Configurar seus acessos',
          description: 'E-mail corporativo, ferramentas internas e este app.',
          order: 5,
        },
      ],
    });
  }
  await prisma.onboardingTask.updateMany({
    where: { title: 'Enviar documentos' },
    data: { requiresUpload: true },
  });
}
```

- [ ] **Step 3: Gerar e rodar a migration**

```bash
cd apps/api
npx prisma migrate dev --name document_status_em_analise_and_onboarding_upload
```

Confirme que a migration só altera `@default` de duas colunas e adiciona `reviewNote`/`requiresUpload` — sem passo de backfill de dados (linhas antigas continuam com `status: "enviado"`, que é um valor legado válido, ver Task 3/8).

- [ ] **Step 4: Rodar o seed contra o dev.db local e conferir**

```bash
npx prisma db seed
```

Confira no `dev.db` (ex.: `npx prisma studio`, ou uma query rápida) que a tarefa "Enviar documentos" tem `requiresUpload = true` e as outras 4 têm `false`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/seed.ts apps/api/prisma/migrations
git commit -m "feat(api): add em_analise default status, reviewNote and requiresUpload to schema"
```

---

## Task 2: `packages/shared-types` — `AdmissionDocumentStatusUpdateSchema`

**Files:**
- Modify: `packages/shared-types/src/documentos.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/documentos.test.ts`

**Interfaces:**
- Consumes: `statusUpdateSchema` de `./status-update` (já existe).
- Produces: `AdmissionDocumentStatusUpdateSchema` (Zod schema), `AdmissionDocumentStatusUpdate` (tipo) — Task 5 (`DocumentosController`) importa os dois.

- [ ] **Step 1: Escrever o teste primeiro**

Em `packages/shared-types/src/documentos.test.ts`, adicionar:

```typescript
import { AdmissionDocumentInputSchema, AdmissionDocumentStatusUpdateSchema, CertificationInputSchema } from "./documentos";
```

(troca o import existente para incluir o novo schema) e um novo `describe`:

```typescript
describe("AdmissionDocumentStatusUpdateSchema", () => {
  it("accepts aprovado", () => {
    expect(AdmissionDocumentStatusUpdateSchema.safeParse({ status: "aprovado" }).success).toBe(true);
  });

  it("accepts recusado with a reviewNote", () => {
    expect(
      AdmissionDocumentStatusUpdateSchema.safeParse({ status: "recusado", reviewNote: "Foto ilegível" })
        .success,
    ).toBe(true);
  });

  it("rejects recusado without a reviewNote", () => {
    expect(AdmissionDocumentStatusUpdateSchema.safeParse({ status: "recusado" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd packages/shared-types
npm test -- documentos.test.ts
```

Esperado: FAIL com `AdmissionDocumentStatusUpdateSchema` undefined.

- [ ] **Step 3: Implementar**

Em `packages/shared-types/src/documentos.ts`, adicionar:

```typescript
import { statusUpdateSchema } from "./status-update";

export const AdmissionDocumentStatusUpdateSchema = statusUpdateSchema();
export type AdmissionDocumentStatusUpdate = z.infer<typeof AdmissionDocumentStatusUpdateSchema>;
```

Em `packages/shared-types/src/index.ts`, no bloco que já exporta `AdmissionDocumentInputSchema`/`CertificationInputSchema`, adicionar `AdmissionDocumentStatusUpdateSchema`/`AdmissionDocumentStatusUpdate`:

```typescript
export {
  AdmissionDocumentInputSchema,
  AdmissionDocumentStatusUpdateSchema,
  CertificationInputSchema,
} from "./documentos";
export type {
  AdmissionDocumentInput,
  AdmissionDocumentStatusUpdate,
  CertificationInput,
} from "./documentos";
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
npm test -- documentos.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Rebuild do pacote (obrigatório — ver Global Constraints)**

```bash
npm run build
```

Confirme que `dist/documentos.js` agora contém `AdmissionDocumentStatusUpdateSchema`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/documentos.ts packages/shared-types/src/documentos.test.ts packages/shared-types/src/index.ts packages/shared-types/dist
git commit -m "feat(shared-types): add AdmissionDocumentStatusUpdateSchema"
```

---

## Task 3: `NotificationsService` — `sendDocumentSubmitted` + `sendDocumentStatusChanged`

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Test: `apps/api/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ExpoPushService` (já injetados no construtor existente).
- Produces: `sendDocumentSubmitted(kind: 'atestado' | 'admissional', submitterUserId: string, submitterName: string): Promise<void>`, `sendDocumentStatusChanged(kind: 'atestado' | 'admissional', userId: string, status: 'aprovado' | 'recusado'): Promise<void>` — Tasks 4 e 5 chamam os dois.

- [ ] **Step 1: Escrever os testes primeiro**

Em `apps/api/src/notifications/notifications.service.spec.ts`, adicionar (mesmo padrão de `sendMural`/`sendPontoPerdido` já no arquivo):

```typescript
  describe('sendDocumentSubmitted', () => {
    afterEach(async () => {
      await prisma.employee.deleteMany({ where: { userId: { startsWith: 'user-doc-sub-' } } });
    });

    it('notifies every active gestor/rh, not the colaborador role', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-gestor', name: 'Gustavo Gestor', role: 'gestor', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-colaborador', name: 'Carla Colaboradora', role: 'colaborador', hireDate: new Date('2024-01-01') },
      });
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-gestor-inativo', name: 'Inativo', role: 'gestor', hireDate: new Date('2024-01-01'), deletedAt: new Date('2026-01-01') },
      });

      await service.sendDocumentSubmitted('atestado', 'user-doc-sub-colaborador', 'Carla Colaboradora');

      const notifications = await prisma.notification.findMany({ where: { type: 'documento_enviado' } });
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        ['user-doc-sub-gestor', 'user-doc-sub-rh'].sort(),
      );
      expect(notifications[0]).toMatchObject({
        type: 'documento_enviado',
        category: 'atestado',
        message: 'Carla Colaboradora enviou um atestado.',
        link: '/aprovacoes',
      });
    });

    it('uses the admissional wording for kind admissional', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh2', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });

      await service.sendDocumentSubmitted('admissional', 'user-doc-sub-colaborador-2', 'Davi Colaborador');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_enviado', userId: 'user-doc-sub-rh2' },
      });
      expect(notification.message).toBe('Davi Colaborador enviou um documento admissional.');
    });

    it('sends a push to every recipient with the notification id and link', async () => {
      await prisma.employee.create({
        data: { userId: 'user-doc-sub-rh3', name: 'Rita RH', role: 'rh', hireDate: new Date('2024-01-01') },
      });

      await service.sendDocumentSubmitted('atestado', 'user-doc-sub-colaborador-3', 'Elis Colaboradora');
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_enviado', userId: 'user-doc-sub-rh3' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-doc-sub-rh3', {
        title: 'Ponto DCIT',
        body: notification.message,
        data: { notificationId: notification.id, link: '/aprovacoes' },
      });
    });
  });

  describe('sendDocumentStatusChanged', () => {
    it('notifies only the given user, aprovado wording', async () => {
      await service.sendDocumentStatusChanged('atestado', 'user-doc-status-1', 'aprovado');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-1' },
      });
      expect(notification).toMatchObject({
        category: 'atestado',
        message: 'Seu atestado foi aprovado.',
        link: '/documentos?categoria=atestados',
      });
    });

    it('notifies with the recusado wording and the admissional link', async () => {
      await service.sendDocumentStatusChanged('admissional', 'user-doc-status-2', 'recusado');

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-2' },
      });
      expect(notification).toMatchObject({
        category: 'admissional',
        message: 'Seu documento admissional foi reprovado.',
        link: '/documentos?categoria=admissionais',
      });
    });

    it('sends a push with the notification id and link', async () => {
      await service.sendDocumentStatusChanged('atestado', 'user-doc-status-3', 'aprovado');
      await new Promise((resolve) => setImmediate(resolve));

      const notification = await prisma.notification.findFirstOrThrow({
        where: { type: 'documento_status', userId: 'user-doc-status-3' },
      });
      expect(sendToUser).toHaveBeenCalledWith('user-doc-status-3', {
        title: 'Ponto DCIT',
        body: 'Seu atestado foi aprovado.',
        data: { notificationId: notification.id, link: '/documentos?categoria=atestados' },
      });
    });
  });
```

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
cd apps/api
npx jest notifications.service.spec.ts
```

Esperado: FAIL — `sendDocumentSubmitted`/`sendDocumentStatusChanged` não existem.

- [ ] **Step 3: Implementar**

Em `apps/api/src/notifications/notifications.service.ts`, adicionar (fora da classe, junto dos outros `const ..Message = ...` já existentes):

```typescript
const DOCUMENT_LABEL: Record<'atestado' | 'admissional', string> = {
  atestado: 'um atestado',
  admissional: 'um documento admissional',
};

const documentStatusMessage = (kind: 'atestado' | 'admissional', status: 'aprovado' | 'recusado') => {
  const noun = kind === 'atestado' ? 'atestado' : 'documento admissional';
  return status === 'aprovado' ? `Seu ${noun} foi aprovado.` : `Seu ${noun} foi reprovado.`;
};
```

E dentro da classe `NotificationsService`, ao final:

```typescript
  async sendDocumentSubmitted(
    kind: 'atestado' | 'admissional',
    submitterUserId: string,
    submitterName: string,
  ): Promise<void> {
    const recipients = await this.prisma.employee.findMany({
      where: { role: { in: ['gestor', 'rh'] }, deletedAt: null },
      select: { userId: true },
    });

    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: 'documento_enviado',
        category: kind,
        message: `${submitterName} enviou ${DOCUMENT_LABEL[kind]}.`,
        link: '/aprovacoes',
      })),
    });

    void Promise.all(
      created.map((n) =>
        this.expoPush.sendToUser(n.userId, {
          title: 'Ponto DCIT',
          body: n.message,
          data: { notificationId: n.id, link: n.link },
        }),
      ),
    );
  }

  async sendDocumentStatusChanged(
    kind: 'atestado' | 'admissional',
    userId: string,
    status: 'aprovado' | 'recusado',
  ): Promise<void> {
    const message = documentStatusMessage(kind, status);
    const created = await this.prisma.notification.create({
      data: {
        userId,
        type: 'documento_status',
        category: kind,
        message,
        link: kind === 'atestado' ? '/documentos?categoria=atestados' : '/documentos?categoria=admissionais',
      },
    });

    void this.expoPush.sendToUser(created.userId, {
      title: 'Ponto DCIT',
      body: created.message,
      data: { notificationId: created.id, link: created.link },
    });
  }
```

- [ ] **Step 4: Rodar os testes e ver passar**

```bash
npx jest notifications.service.spec.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.service.spec.ts
git commit -m "feat(api): add sendDocumentSubmitted and sendDocumentStatusChanged"
```

---

## Task 4: `AtestadosService`/`Controller`/`Module` — usa `NotificationsService`, libera dono da própria foto

**Files:**
- Modify: `apps/api/src/atestados/atestados.service.ts`
- Modify: `apps/api/src/atestados/atestados.controller.ts`
- Modify: `apps/api/src/atestados/atestados.module.ts`
- Test: `apps/api/src/atestados/atestados.service.spec.ts`
- Test: `apps/api/src/atestados/atestados.controller.spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.sendDocumentSubmitted`/`sendDocumentStatusChanged` (Task 3).
- Produces: `AtestadosService.getPhoto(id, viewerRole, viewerUserId)` (assinatura mudou — Task 9/8 web consomem via `getAtestadoPhoto` action, que já passa esses 3 argumentos depois desta task).

- [ ] **Step 1: Escrever/ajustar os testes de serviço primeiro**

Abrir `apps/api/src/atestados/atestados.service.spec.ts`. Trocar o setup do módulo de teste para injetar `NotificationsService` em vez de usar só `ExpoPushService` cru:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

No `beforeAll`, adicionar um mock de `NotificationsService` junto do `pushMock` já existente:

```typescript
  const notificationsMock = {
    sendDocumentSubmitted: jest.fn(),
    sendDocumentStatusChanged: jest.fn(),
  };
```

e no array de `providers`, junto de `{ provide: ExpoPushService, useValue: pushMock }`, adicionar:

```typescript
        { provide: NotificationsService, useValue: notificationsMock },
```

Adicionar/ajustar os testes de `create` e `updateStatus` (localizar os testes existentes desses métodos e ajustar as asserções — se não houver teste de `create` ainda, adicionar):

```typescript
  describe('create', () => {
    it('notifies gestor/rh after creating the atestado', async () => {
      const created = await service.create('user-notify-1', 'Nina Notify', {
        cid: 'J06.9',
        crm: 'CRM-MG 1',
        medico: 'Dr. Teste',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      expect(notificationsMock.sendDocumentSubmitted).toHaveBeenCalledWith(
        'atestado',
        'user-notify-1',
        'Nina Notify',
      );
      expect(created.userId).toBe('user-notify-1');
    });
  });
```

E localizar o teste existente de `updateStatus` (procurar por `pushMock.sendToUser` nesse arquivo) — trocar a asserção de push direto por `notificationsMock.sendDocumentStatusChanged`:

```typescript
  describe('updateStatus', () => {
    it('notifies the colaborador via NotificationsService, not push directly', async () => {
      const created = await service.create('user-notify-2', 'Nino Notify', {
        cid: 'J06.9',
        crm: 'CRM-MG 1',
        medico: 'Dr. Teste',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      await service.updateStatus(created.id, 'aprovado');

      expect(notificationsMock.sendDocumentStatusChanged).toHaveBeenCalledWith(
        'atestado',
        'user-notify-2',
        'aprovado',
      );
      expect(pushMock.sendToUser).not.toHaveBeenCalled();
    });
  });
```

E um teste novo para `getPhoto` liberando o dono:

```typescript
  describe('getPhoto', () => {
    it('lets the atestado owner see their own photo even as colaborador', async () => {
      const created = await service.create('user-notify-3', 'Nara Notify', {
        cid: 'J06.9',
        crm: 'CRM-MG 1',
        medico: 'Dr. Teste',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getPhoto(created.id, 'colaborador', 'user-notify-3');

      expect(photo).toBe('data:image/jpeg;base64,ZmFrZQ==');
    });

    it('blocks a gestor who is not the owner', async () => {
      const created = await service.create('user-notify-4', 'Nico Notify', {
        cid: 'J06.9',
        crm: 'CRM-MG 1',
        medico: 'Dr. Teste',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getPhoto(created.id, 'gestor', 'someone-else');

      expect(photo).toBeNull();
    });

    it('still lets rh see anyone\'s photo', async () => {
      const created = await service.create('user-notify-5', 'Nelson Notify', {
        cid: 'J06.9',
        crm: 'CRM-MG 1',
        medico: 'Dr. Teste',
        dias: 2,
        photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getPhoto(created.id, 'rh', 'someone-else');

      expect(photo).toBe('data:image/jpeg;base64,ZmFrZQ==');
    });
  });
```

Adicionar limpeza no `afterAll`/`afterEach` já existente para os `userId`s novos (`user-notify-1` a `user-notify-5`) — seguir o padrão de limpeza já usado nesse arquivo (ex.: `deleteMany` por prefixo ou lista de ids).

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
npx jest atestados.service.spec.ts
```

Esperado: FAIL — `NotificationsService` não injetada, `getPhoto` ainda com assinatura antiga.

- [ ] **Step 3: Implementar `AtestadosService`**

Em `apps/api/src/atestados/atestados.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

(remove o import de `ExpoPushService` — não é mais usado diretamente aqui). Trocar o construtor:

```typescript
  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
```

Trocar `create`:

```typescript
  async create(userId: string, userName: string, input: AtestadoInput) {
    const atestado = await this.prisma.atestado.create({
      data: {
        userId,
        userName,
        cid: input.cid,
        crm: input.crm,
        medico: input.medico,
        dias: input.dias,
        photoDataUrl: input.photoDataUrl,
      },
    });
    await this.notifications.sendDocumentSubmitted('atestado', userId, userName);
    return atestado;
  }
```

Trocar `getPhoto`:

```typescript
  async getPhoto(id: string, viewerRole: Role, viewerUserId: string): Promise<string | null> {
    const atestado = await this.prisma.atestado.findUnique({
      where: { id },
      select: { photoDataUrl: true, userId: true },
    });
    if (!atestado) return null;
    if (viewerRole !== 'rh' && atestado.userId !== viewerUserId) return null;
    return atestado.photoDataUrl;
  }
```

Trocar `updateStatus`:

```typescript
  async updateStatus(id: string, status: 'aprovado' | 'recusado', reviewNote?: string) {
    const updated = await this.prisma.atestado.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    await this.notifications.sendDocumentStatusChanged('atestado', updated.userId, status);
    return updated;
  }
```

- [ ] **Step 4: Atualizar `AtestadosController`**

Em `apps/api/src/atestados/atestados.controller.ts`, o handler `getPhoto` perde `@Roles('rh')` (a checagem de "é o dono?" agora mora no service) e passa `req.user.sub`:

```typescript
  @UseGuards(AuthGuard)
  @Get(':id/photo')
  async getPhoto(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const photoDataUrl = await this.atestados.getPhoto(id, req.user.role, req.user.sub);
    return { photoDataUrl };
  }
```

Se `RolesGuard`/`Roles` ainda forem usados em outros handlers do arquivo (`listTeam`, `updateStatus`), **não remover os imports** — só o decorator `@Roles('rh')` deste handler específico.

- [ ] **Step 5: Atualizar `AtestadosModule`**

Em `apps/api/src/atestados/atestados.module.ts`, trocar `PushModule` por `NotificationsModule`:

```typescript
import { Module } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AtestadosController } from './atestados.controller';
import { AtestadosService } from './atestados.service';
import { ANTHROPIC_CLIENT } from './anthropic-client.token';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AtestadosController],
  providers: [
    AtestadosService,
    {
      provide: ANTHROPIC_CLIENT,
      useFactory: () => new Anthropic(),
    },
  ],
})
export class AtestadosModule {}
```

- [ ] **Step 6: Atualizar `atestados.controller.spec.ts` para a nova assinatura de `getPhoto`**

Localizar o teste existente de `getPhoto` no controller spec (procurar por `.getPhoto(`) e garantir que a chamada de asserção espera 3 argumentos:

```typescript
    expect(serviceMock.getPhoto).toHaveBeenCalledWith('at-1', 'rh', 'user-1');
```

(ajustar conforme o `role`/`sub` já usados no `requestAs(...)` helper daquele arquivo).

- [ ] **Step 7: Rodar os testes e ver passar**

```bash
npx jest atestados
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/atestados
git commit -m "feat(api): atestados use NotificationsService; owner can view own photo"
```

---

## Task 5: `DocumentosService`/`Controller`/`Module` — status, foto, notificações pra admissionais

**Files:**
- Modify: `apps/api/src/documentos/documentos.service.ts`
- Modify: `apps/api/src/documentos/documentos.controller.ts`
- Modify: `apps/api/src/documentos/documentos.module.ts`
- Test: `apps/api/src/documentos/documentos.service.spec.ts`
- Test: `apps/api/src/documentos/documentos.controller.spec.ts`

**Interfaces:**
- Consumes: `NotificationsService` (Task 3).
- Produces: `DocumentosService.createAdmissionDocument(userId, userName, input)` (assinatura mudou — Task 6 usa), `getAdmissionDocumentPhoto(id, viewerRole, viewerUserId)`, `updateAdmissionDocumentStatus(id, status, reviewNote?)`. `DocumentosModule` passa a `exports: [DocumentosService]` (Task 6 depende disso).

- [ ] **Step 1: Escrever/ajustar os testes de serviço primeiro**

Em `apps/api/src/documentos/documentos.service.spec.ts`, adicionar o import e mock de `NotificationsService` (mesmo padrão da Task 4):

```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

No `beforeAll`, adicionar ao array de `providers`:

```typescript
        { provide: NotificationsService, useValue: notificationsMock },
```

com `notificationsMock` declarado junto de `pushMock`:

```typescript
  const notificationsMock = {
    sendDocumentSubmitted: jest.fn(),
    sendDocumentStatusChanged: jest.fn(),
  };
```

Ajustar a chamada existente de `createAdmissionDocument` no arquivo (procurar por `.createAdmissionDocument(`) para incluir `userName` como segundo argumento — ex., se o teste hoje for:

```typescript
const created = await service.createAdmissionDocument('user-x', { title: 'RG', photoUri: '...' });
```

vira:

```typescript
const created = await service.createAdmissionDocument('user-x', 'Xavier Colaborador', { title: 'RG', photoUri: 'data:image/jpeg;base64,ZmFrZQ==' });
```

Adicionar um teste novo garantindo a notificação:

```typescript
  it('notifies gestor/rh after creating an admission document', async () => {
    await service.createAdmissionDocument('user-notify-doc', 'Diana Documentos', {
      title: 'RG',
      photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
    });

    expect(notificationsMock.sendDocumentSubmitted).toHaveBeenCalledWith(
      'admissional',
      'user-notify-doc',
      'Diana Documentos',
    );
  });

  describe('updateAdmissionDocumentStatus', () => {
    it('sets status/reviewNote and notifies the owner', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-2', 'Diego Documentos', {
        title: 'CNH',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const updated = await service.updateAdmissionDocumentStatus(created.id, 'recusado', 'Foto ilegível');

      expect(updated.status).toBe('recusado');
      expect(updated.reviewNote).toBe('Foto ilegível');
      expect(notificationsMock.sendDocumentStatusChanged).toHaveBeenCalledWith(
        'admissional',
        'user-notify-doc-2',
        'recusado',
      );
    });
  });

  describe('getAdmissionDocumentPhoto', () => {
    it('lets a gestor (not just rh) view the photo', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-3', 'Duda Documentos', {
        title: 'RG',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getAdmissionDocumentPhoto(created.id, 'gestor', 'someone-else');

      expect(photo).toBe('data:image/jpeg;base64,ZmFrZQ==');
    });

    it('lets the owner view their own photo', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-4', 'Dora Documentos', {
        title: 'RG',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getAdmissionDocumentPhoto(created.id, 'colaborador', 'user-notify-doc-4');

      expect(photo).toBe('data:image/jpeg;base64,ZmFrZQ==');
    });

    it('blocks a third-party colaborador', async () => {
      const created = await service.createAdmissionDocument('user-notify-doc-5', 'Duarte Documentos', {
        title: 'RG',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const photo = await service.getAdmissionDocumentPhoto(created.id, 'colaborador', 'someone-else');

      expect(photo).toBeNull();
    });
  });

  it('never includes photoUri in listAdmissionDocuments or listAllAdmissionDocuments', async () => {
    await service.createAdmissionDocument('user-notify-doc-6', 'Diana Lista', {
      title: 'RG',
      photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
    });

    const mine = await service.listAdmissionDocuments('user-notify-doc-6');
    const all = await service.listAllAdmissionDocuments();

    expect(mine[0]).not.toHaveProperty('photoUri');
    expect(all.find((d) => d.userId === 'user-notify-doc-6')).not.toHaveProperty('photoUri');
  });
```

Adicionar limpeza para os novos `userId`s de teste no `afterAll` já existente (seguir o padrão do arquivo).

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
cd apps/api
npx jest documentos.service.spec.ts
```

Esperado: FAIL — assinatura de `createAdmissionDocument` não bate, `updateAdmissionDocumentStatus`/`getAdmissionDocumentPhoto` não existem.

- [ ] **Step 3: Implementar `DocumentosService`**

Em `apps/api/src/documentos/documentos.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
```

Trocar o construtor (já tem `ExpoPushService` da Task de holerites — mantém, `createPayslip` continua usando push direto por enquanto, fora de escopo desta spec):

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
    private readonly notifications: NotificationsService,
  ) {}
```

Trocar `createAdmissionDocument`:

```typescript
  async createAdmissionDocument(userId: string, userName: string, input: AdmissionDocumentInput) {
    const document = await this.prisma.admissionDocument.create({
      data: { userId, title: input.title, photoUri: input.photoUri },
    });
    await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
    return document;
  }
```

Trocar `listAdmissionDocuments`/`listAllAdmissionDocuments` (exclui `photoUri`):

```typescript
  listAdmissionDocuments(userId: string) {
    return this.prisma.admissionDocument.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, title: true, status: true, reviewNote: true, submittedAt: true },
    });
  }

  async listAllAdmissionDocuments() {
    const documents = await this.prisma.admissionDocument.findMany({
      orderBy: { submittedAt: 'desc' },
      select: { id: true, userId: true, title: true, status: true, reviewNote: true, submittedAt: true },
    });
    return this.withRequesterNames(documents);
  }
```

Adicionar `getAdmissionDocumentPhoto` e `updateAdmissionDocumentStatus` (perto de `createAdmissionDocument`):

```typescript
  async getAdmissionDocumentPhoto(id: string, viewerRole: Role, viewerUserId: string): Promise<string | null> {
    const document = await this.prisma.admissionDocument.findUnique({
      where: { id },
      select: { photoUri: true, userId: true },
    });
    if (!document) return null;
    const isReviewer = viewerRole === 'gestor' || viewerRole === 'rh';
    if (!isReviewer && document.userId !== viewerUserId) return null;
    return document.photoUri;
  }

  async updateAdmissionDocumentStatus(id: string, status: 'aprovado' | 'recusado', reviewNote?: string) {
    const updated = await this.prisma.admissionDocument.update({
      where: { id },
      data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
    });
    await this.notifications.sendDocumentStatusChanged('admissional', updated.userId, status);
    return updated;
  }
```

Adicionar o import de `Role`:

```typescript
import type {
  AdmissionDocumentInput,
  CertificationInput,
  PayslipInput,
  PayslipUpdate,
  Role,
} from '@ponto-dcit/shared-types';
```

- [ ] **Step 4: Atualizar `DocumentosController`**

Em `apps/api/src/documentos/documentos.controller.ts`:

```typescript
import {
  AdmissionDocumentInputSchema,
  AdmissionDocumentStatusUpdateSchema,
  CertificationInputSchema,
  PayslipInputSchema,
  PayslipUpdateSchema,
} from '@ponto-dcit/shared-types';
```

Trocar `createAdmissionDocument` (passa `req.user.name`):

```typescript
  @UseGuards(AuthGuard)
  @Post('admissionais')
  @HttpCode(201)
  async createAdmissionDocument(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = AdmissionDocumentInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.createAdmissionDocument(req.user.sub, req.user.name, result.data);
  }
```

Adicionar dois handlers novos (perto de `listAllAdmissionDocuments`):

```typescript
  @UseGuards(AuthGuard)
  @Get('admissionais/:id/photo')
  async getAdmissionDocumentPhoto(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const photoDataUrl = await this.documentos.getAdmissionDocumentPhoto(id, req.user.role, req.user.sub);
    return { photoDataUrl };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Patch('admissionais/:id/status')
  async updateAdmissionDocumentStatus(@Param('id') id: string, @Body() body: unknown) {
    const result = AdmissionDocumentStatusUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.documentos.updateAdmissionDocumentStatus(id, result.data.status, result.data.reviewNote);
  }
```

- [ ] **Step 5: Atualizar `DocumentosModule`**

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

- [ ] **Step 6: Atualizar `documentos.controller.spec.ts`**

Ajustar a asserção de `createAdmissionDocument` (já feita parcialmente antes desta plan — confirmar que o `requestAs` helper do arquivo tem `.name`, ex. `'Test User'`) para:

```typescript
    expect(serviceMock.createAdmissionDocument).toHaveBeenCalledWith('user-1', 'Test User', {
      title: 'Comprovante',
      photoUri: PHOTO_DATA_URL,
    });
```

Adicionar `getAdmissionDocumentPhoto`/`updateAdmissionDocumentStatus` ao `serviceMock` do describe principal, e um teste rápido de cada:

```typescript
  it('fetches an admission document photo for the authenticated user', async () => {
    serviceMock.getAdmissionDocumentPhoto.mockResolvedValue('data:image/jpeg;base64,ZmFrZQ==');

    const result = await controller.getAdmissionDocumentPhoto('adm-1', requestAs('user-1'));

    expect(result).toEqual({ photoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==' });
    expect(serviceMock.getAdmissionDocumentPhoto).toHaveBeenCalledWith('adm-1', 'colaborador', 'user-1');
  });

  it('updates an admission document status with a valid payload', async () => {
    serviceMock.updateAdmissionDocumentStatus.mockResolvedValue({ id: 'adm-1', status: 'aprovado' });

    await controller.updateAdmissionDocumentStatus('adm-1', { status: 'aprovado' });

    expect(serviceMock.updateAdmissionDocumentStatus).toHaveBeenCalledWith('adm-1', 'aprovado', undefined);
  });

  it('rejects recusado without a reviewNote', async () => {
    await expect(
      controller.updateAdmissionDocumentStatus('adm-1', { status: 'recusado' }),
    ).rejects.toThrow(BadRequestException);
    expect(serviceMock.updateAdmissionDocumentStatus).not.toHaveBeenCalled();
  });
```

- [ ] **Step 7: Rodar os testes e ver passar**

```bash
npx jest documentos
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/documentos
git commit -m "feat(api): admission document status/photo endpoints, notify on submit and decide"
```

---

## Task 6: `OnboardingService`/`Controller`/`Module` — upload embutido na tarefa

**Files:**
- Modify: `apps/api/src/onboarding/onboarding.service.ts`
- Modify: `apps/api/src/onboarding/onboarding.controller.ts`
- Modify: `apps/api/src/onboarding/onboarding.module.ts`
- Test: `apps/api/src/onboarding/onboarding.service.spec.ts`

**Interfaces:**
- Consumes: `DocumentosService.createAdmissionDocument(userId, userName, input)` (Task 5).
- Produces: `OnboardingService.submitTaskDocument(userId, userName, taskId, input)` — usado pelo controller; nenhuma outra task depende disso.

- [ ] **Step 1: Escrever os testes primeiro**

Em `apps/api/src/onboarding/onboarding.service.spec.ts`, adicionar o provider de `DocumentosService` real (é uma integração leve, mesmo padrão do resto do arquivo — sem mock, usa o Prisma de teste de verdade) e os testes:

```typescript
import { DocumentosService } from '../documentos/documentos.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpoPushService } from '../push/expo-push.service';
```

No `beforeAll`, trocar `providers: [OnboardingService, PrismaService]` por:

```typescript
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        DocumentosService,
        PrismaService,
        { provide: ExpoPushService, useValue: { sendToUser: jest.fn() } },
        { provide: NotificationsService, useValue: { sendDocumentSubmitted: jest.fn(), sendDocumentStatusChanged: jest.fn() } },
      ],
    }).compile();
```

Testes novos:

```typescript
  describe('submitTaskDocument', () => {
    it('rejects a task that does not require upload', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'i', title: 'Assinar contrato', description: 'd', order: 10, requiresUpload: false },
      });

      await expect(
        service.submitTaskDocument('user-upload-1', 'Uga Upload', task.id, {
          title: 'RG',
          photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
        }),
      ).rejects.toThrow('Esta tarefa não aceita envio de documento.');
    });

    it('creates the admission document and marks the task complete', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'i', title: 'Enviar documentos', description: 'd', order: 11, requiresUpload: true },
      });

      const document = await service.submitTaskDocument('user-upload-2', 'Uma Upload', task.id, {
        title: 'RG',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      expect(document).toHaveProperty('id');
      const progress = await prisma.onboardingProgress.findUnique({
        where: { userId_taskId: { userId: 'user-upload-2', taskId: task.id } },
      });
      expect(progress).not.toBeNull();
    });

    it('submitting a second document through the same task does not fail or duplicate progress', async () => {
      const task = await prisma.onboardingTask.create({
        data: { icon: 'i', title: 'Enviar documentos 2', description: 'd', order: 12, requiresUpload: true },
      });

      await service.submitTaskDocument('user-upload-3', 'Uba Upload', task.id, {
        title: 'RG',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });
      await service.submitTaskDocument('user-upload-3', 'Uba Upload', task.id, {
        title: 'CPF',
        photoUri: 'data:image/jpeg;base64,ZmFrZQ==',
      });

      const progressCount = await prisma.onboardingProgress.count({
        where: { userId: 'user-upload-3', taskId: task.id },
      });
      expect(progressCount).toBe(1);
    });
  });
```

Adicionar limpeza no `afterAll` já existente: `await prisma.admissionDocument.deleteMany({ where: { userId: { startsWith: 'user-upload-' } } });` antes do `deleteMany` de `onboardingProgress`.

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
cd apps/api
npx jest onboarding.service.spec.ts
```

Esperado: FAIL — `submitTaskDocument` não existe.

- [ ] **Step 3: Implementar `OnboardingService`**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentosService } from '../documentos/documentos.service';
import type { AdmissionDocumentInput } from '@ponto-dcit/shared-types';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosService,
  ) {}

  // ... getTasks, listTeamProgress, toggleTask continuam iguais ...

  async submitTaskDocument(
    userId: string,
    userName: string,
    taskId: string,
    input: AdmissionDocumentInput,
  ) {
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (!task?.requiresUpload) {
      throw new BadRequestException('Esta tarefa não aceita envio de documento.');
    }
    const document = await this.documentos.createAdmissionDocument(userId, userName, input);
    await this.prisma.onboardingProgress.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: { userId, taskId },
      update: {},
    });
    return document;
  }
}
```

(mantém os métodos `getTasks`/`listTeamProgress`/`toggleTask` já existentes intactos, só adiciona o import/construtor/método novo).

- [ ] **Step 4: Atualizar `OnboardingController`**

```typescript
import { AdmissionDocumentInputSchema } from '@ponto-dcit/shared-types';
import { BadRequestException, Controller, Get, Param, Post, Body, Req, UseGuards } from '@nestjs/common';
```

Adicionar handler:

```typescript
  @UseGuards(AuthGuard)
  @Post('tarefas/:taskId/documento')
  async submitTaskDocument(
    @Param('taskId') taskId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = AdmissionDocumentInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.onboarding.submitTaskDocument(req.user.sub, req.user.name, taskId, result.data);
  }
```

- [ ] **Step 5: Atualizar `OnboardingModule`**

```typescript
import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AuthModule } from '../auth/auth.module';
import { DocumentosModule } from '../documentos/documentos.module';

@Module({
  imports: [AuthModule, DocumentosModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
```

- [ ] **Step 6: Rodar os testes e ver passar**

```bash
npx jest onboarding
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/onboarding
git commit -m "feat(api): onboarding task document upload marks progress complete"
```

---

## Task 7: API — verificação completa antes de seguir pro frontend

**Files:** nenhum (task de checkpoint).

- [ ] **Step 1: Rodar a suíte inteira da API**

```bash
cd apps/api
npx jest 2>&1 | tail -20
```

Esperado: só as 9 falhas pré-existentes de `auth.service.spec.ts` (não relacionadas, confirmadas como pré-existentes mesmo na `master` sem nenhuma mudança desta feature). Qualquer outra falha precisa ser corrigida antes de prosseguir.

- [ ] **Step 2: Rebuild do shared-types (se qualquer task anterior mexeu nele) e reiniciar os dev servers**

```bash
cd packages/shared-types && npm run build
```

Reinicie `apps/api` (`npm run start:dev`) e `apps/web` (`npm run dev`) manualmente se estiverem rodando — ver Global Constraints.

---

## Task 8: Web — Aprovações: `viewer` opcional + `ViewAndDecideButton`, `rejectedLabel` no histórico

**Files:**
- Modify: `apps/web/src/app/(app)/aprovacoes/approval-section.tsx`
- Modify: `apps/web/src/app/(app)/aprovacoes/history-section.tsx`
- Modify: `apps/web/src/app/(app)/aprovacoes/aprovacoes.module.css`
- Test: `apps/web/e2e/aprovacoes.spec.ts` (novo)

**Interfaces:**
- Produces: `ApprovalItem.viewer?: ReactNode`, `HistorySection`'s `rejectedLabel?: string` prop — Task 9 (page.tsx) usa os dois ao montar os grupos de Atestados/Admissionais.

- [ ] **Step 1: Escrever o teste e2e primeiro**

Criar `apps/web/e2e/aprovacoes.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("an atestado with a viewer shows only Visualizar, not Aprovar/Recusar directly", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "em_analise",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();

  await expect(page.getByRole("button", { name: "Visualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Recusar" })).toHaveCount(0);
});

test("opening the atestado viewer shows dias and clinical detail for rh, then approves", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-2",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 3,
        status: "em_analise",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await page.getByRole("button", { name: "Visualizar" }).click();

  await expect(page.getByText("J11")).toBeVisible();
  await expect(page.getByText("Dr. Teste")).toBeVisible();

  await page.getByRole("button", { name: "Aprovar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/atestados/at-2/status")?.body;
    })
    .toEqual({ status: "aprovado" });
});

test("reproving an atestado from the viewer requires a justification", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-3",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 1,
        status: "em_analise",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await page.getByRole("button", { name: "Visualizar" }).click();
  await page.getByRole("button", { name: "Reprovar" }).click();

  await page.getByRole("button", { name: "Confirmar reprovação" }).click();
  // A textarea vazia bloqueia o submit nativamente (required) — nenhuma
  // request deveria sair ainda.
  expect(
    (await getRecordedRequests(request)).some(
      (r) => r.method === "PATCH" && r.path === "/atestados/at-3/status",
    ),
  ).toBe(false);

  await page.getByLabel("Motivo da reprovação").fill("Documento ilegível");
  await page.getByRole("button", { name: "Confirmar reprovação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/atestados/at-3/status")?.body;
    })
    .toEqual({ status: "recusado", reviewNote: "Documento ilegível" });
});

test("a gestor sees no Ver foto button for an atestado, an rh does", async ({
  page,
  context,
  request,
}) => {
  await mockApi(request, {
    atestados: [
      {
        id: "at-4",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 1,
        status: "em_analise",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await page.getByRole("button", { name: "Visualizar" }).click();
  await expect(page.getByRole("button", { name: "Ver foto" })).toHaveCount(0);

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-4",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 1",
        medico: "Dr. Teste",
        dias: 1,
        status: "em_analise",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Fila de aprovações" }).click();
  await page.getByRole("button", { name: "Visualizar" }).click();
  await expect(page.getByRole("button", { name: "Ver foto" })).toBeVisible();
});

test("Documentos admissionais group shows pending items with a Visualizar button, and a gestor can view the photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-1",
        userId: "user-diana",
        userName: "Diana Colaboradora",
        title: "RG",
        status: "em_analise",
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais/equipe",
    response: [
      {
        id: "adm-1",
        userId: "user-diana",
        userName: "Diana Colaboradora",
        title: "RG",
        status: "em_analise",
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais/adm-1/photo",
    response: { photoDataUrl: "data:image/jpeg;base64,ZmFrZQ==" },
  });

  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Documentos admissionais — Fila de aprovações" }).click();
  await expect(page.getByRole("button", { name: "Visualizar" })).toBeVisible();

  await page.getByRole("button", { name: "Visualizar" }).click();
  await expect(page.getByText("RG")).toBeVisible();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByAltText("Foto do documento")).toBeVisible();

  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/documentos/admissionais/adm-1/status")?.body;
    })
    .toEqual({ status: "aprovado" });
});

test("history shows Reprovado for atestados, not Recusado", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-5",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 1,
        status: "recusado",
        reviewNote: "Ilegível",
        createdAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/aprovacoes");
  await page.getByRole("button", { name: "Atestados — Histórico de aprovações" }).click();

  await expect(page.getByText("Reprovado", { exact: true })).toBeVisible();
  await expect(page.getByText("Recusado", { exact: true })).toHaveCount(0);
});
```

Nota: os nomes de `aria-label` usados (`"Atestados — Fila de aprovações"` etc.) já existem hoje em `aprovacoes-accordion.tsx` (`\`${item.label} — ${group.label}\``) — não precisam de mudança.

`mockApi`/`seedResponse` precisam suportar `admissionDocuments` seedando `/documentos/admissionais/equipe` (já existe — ver `documentos.spec.ts`, que usa exatamente essa chave hoje) e a rota `PATCH /documentos/admissionais/:id/status` no `fake-api-server.mjs` (checar se já existe um catch-all de PATCH para `/atestados|solicitacoes/.../status` — adicionar `documentos/admissionais` a esse regex se não bater):

Em `apps/web/e2e/fake-api-server.mjs`, localizar:
```javascript
  if (
    req.method === "PATCH" &&
    /^\/(atestados|solicitacoes\/(ferias|ajustes|compensacoes))\/[^/]+\/status$/.test(
      url.pathname
    )
  ) {
    return sendJson(res, 200, { ...body });
  }
```
e trocar o regex para incluir admissionais:
```javascript
  if (
    req.method === "PATCH" &&
    /^\/(atestados|documentos\/admissionais|solicitacoes\/(ferias|ajustes|compensacoes))\/[^/]+\/status$/.test(
      url.pathname
    )
  ) {
    return sendJson(res, 200, { ...body });
  }
```

E adicionar uma rota GET para `/documentos/admissionais/:id/photo` (mesmo padrão de `/atestados/:id/photo`, que já deve existir — copiar o handler):
```javascript
  if (req.method === "GET" && /^\/documentos\/admissionais\/[^/]+\/photo$/.test(url.pathname)) {
    return sendJson(res, 200, seededResponses.get(`/documentos/admissionais/${url.pathname.split("/")[3]}/photo`) ?? { photoDataUrl: null });
  }
```
(ajustar ao mecanismo real de `seededResponses`/`seedResponse` já usado pelo arquivo — inspecionar como `/atestados/:id/photo` é servido hoje e replicar o mesmo padrão exato em vez de inventar um novo).

- [ ] **Step 2: Rodar os testes e ver falhar**

```bash
cd apps/web
npx playwright test e2e/aprovacoes.spec.ts
```

Esperado: FAIL — nenhum `viewer`/"Visualizar" existe ainda, grupo "Documentos admissionais" não existe.

- [ ] **Step 3: Implementar `approval-section.tsx`**

Substituir o arquivo inteiro:

```typescript
"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "./aprovacoes.module.css";

type ApprovalItem = {
  id: string;
  name: string;
  detail: string;
  viewer?: ReactNode;
};

function RejectButton({
  id,
  onDecide,
}: {
  id: string;
  onDecide: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={styles.rejectButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Recusar
      </button>
      <dialog ref={dialogRef} className={styles.dialog}>
        <form action={onDecide}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="recusado" />
          <p className={styles.dialogTitle}>Justificar recusa</p>
          <label className={styles.dialogLabel} htmlFor={`reviewNote-${id}`}>
            Motivo da recusa
          </label>
          <textarea
            id={`reviewNote-${id}`}
            name="reviewNote"
            className={styles.dialogTextarea}
            rows={3}
            required
            minLength={1}
          />
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogCancel}
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.dialogConfirm}>
              Confirmar recusa
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function ViewAndDecideButton({
  id,
  name,
  viewer,
  onDecide,
}: {
  id: string;
  name: string;
  viewer: ReactNode;
  onDecide: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rejecting, setRejecting] = useState(false);

  function close() {
    dialogRef.current?.close();
    setRejecting(false);
  }

  return (
    <>
      <button
        type="button"
        className={styles.viewButton}
        onClick={() => dialogRef.current?.showModal()}
      >
        Visualizar
      </button>
      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>{name}</p>
        {viewer}
        {!rejecting ? (
          <div className={styles.dialogActions}>
            <button type="button" className={styles.dialogCancel} onClick={close}>
              Fechar
            </button>
            <form action={onDecide}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="aprovado" />
              <button type="submit" className={styles.approveButton}>
                Aprovar
              </button>
            </form>
            <button
              type="button"
              className={styles.rejectButton}
              onClick={() => setRejecting(true)}
            >
              Reprovar
            </button>
          </div>
        ) : (
          <form action={onDecide}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="recusado" />
            <label className={styles.dialogLabel} htmlFor={`reviewNote-view-${id}`}>
              Motivo da reprovação
            </label>
            <textarea
              id={`reviewNote-view-${id}`}
              name="reviewNote"
              className={styles.dialogTextarea}
              rows={3}
              required
              minLength={1}
            />
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => setRejecting(false)}
              >
                Voltar
              </button>
              <button type="submit" className={styles.dialogConfirm}>
                Confirmar reprovação
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

export function ApprovalSection({
  title,
  emptyLabel,
  items,
  onDecide,
}: {
  title?: string;
  emptyLabel: string;
  items: ApprovalItem[];
  onDecide: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className={styles.section}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {items.length === 0 ? (
        <p className={styles.sectionEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
              </div>
              <div className={styles.itemActions}>
                {item.viewer ? (
                  <ViewAndDecideButton
                    id={item.id}
                    name={item.name}
                    viewer={item.viewer}
                    onDecide={onDecide}
                  />
                ) : (
                  <>
                    <form action={onDecide}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="status" value="aprovado" />
                      <button type="submit" className={styles.approveButton}>
                        Aprovar
                      </button>
                    </form>
                    <RejectButton id={item.id} onDecide={onDecide} />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Implementar `history-section.tsx`**

```typescript
import styles from "./aprovacoes.module.css";

type HistoryItem = {
  id: string;
  name: string;
  detail: string;
  status: "aprovado" | "recusado";
  reviewNote?: string | null;
};

export function HistorySection({
  title,
  emptyLabel,
  items,
  rejectedLabel = "Recusado",
}: {
  title?: string;
  emptyLabel: string;
  items: HistoryItem[];
  rejectedLabel?: string;
}) {
  return (
    <section className={styles.section}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {items.length === 0 ? (
        <p className={styles.sectionEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
                {item.status === "recusado" && item.reviewNote && (
                  <span className={styles.itemNote}>Motivo: {item.reviewNote}</span>
                )}
              </div>
              <span
                className={
                  item.status === "aprovado" ? styles.statusApproved : styles.statusRejected
                }
              >
                {item.status === "aprovado" ? "Aprovado" : rejectedLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: CSS — `.viewButton`**

Em `apps/web/src/app/(app)/aprovacoes/aprovacoes.module.css`, adicionar perto de `.rejectButton`:

```css
.viewButton {
  appearance: none;
  border: 1px solid var(--color-background-selected);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}

.viewButton:hover {
  background: var(--color-background-selected);
}
```

- [ ] **Step 6: Ajustar o fake-api-server e `test-session.ts` (mockApi já tem `admissionDocuments`? conferir)**

Verificar em `apps/web/e2e/test-session.ts` se a chave `admissionDocuments` do `mockApi` já seeda `/documentos/admissionais/equipe` (usado por `documentos.spec.ts`) — se sim, o teste 5 da Step 1 já funciona sem mudança adicional em `test-session.ts`. Aplicar as mudanças de regex/rota do Step 1 em `fake-api-server.mjs`.

- [ ] **Step 7: Rodar os testes e ver passar**

```bash
npx playwright test e2e/aprovacoes.spec.ts
```

Esperado: PASS. (A implementação completa dos viewers/page.tsx é a Task 9 — se algum teste desta task ainda falhar por depender de `page.tsx`, é esperado; volte a rodar esta suíte no final da Task 9.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/\(app\)/aprovacoes/approval-section.tsx apps/web/src/app/\(app\)/aprovacoes/history-section.tsx apps/web/src/app/\(app\)/aprovacoes/aprovacoes.module.css apps/web/e2e/aprovacoes.spec.ts apps/web/e2e/fake-api-server.mjs
git commit -m "feat(web): ApprovalSection supports a Visualizar-first viewer; HistorySection rejectedLabel"
```

---

## Task 9: Web — `aprovacoes/page.tsx` + `actions.ts` + viewers (Atestado/Admissional)

**Files:**
- Modify: `apps/web/src/app/(app)/aprovacoes/page.tsx`
- Modify: `apps/web/src/app/(app)/aprovacoes/actions.ts`
- Modify: `apps/web/src/app/(app)/documentos/actions.ts`
- Create: `apps/web/src/app/(app)/aprovacoes/atestado-viewer.tsx`
- Create: `apps/web/src/app/(app)/aprovacoes/admission-document-viewer.tsx`
- Test: `apps/web/e2e/aprovacoes.spec.ts` (já escrito na Task 8 — só precisa passar agora)

**Interfaces:**
- Consumes: `ApprovalItem.viewer`/`HistorySection.rejectedLabel` (Task 8), `getAtestadoPhoto` (já existe em `documentos/actions.ts`), `GET /documentos/admissionais/:id/photo` e `PATCH /documentos/admissionais/:id/status` (Task 5).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: `documentos/actions.ts` — nova action `getAdmissionDocumentPhoto`**

Adicionar em `apps/web/src/app/(app)/documentos/actions.ts`:

```typescript
export async function getAdmissionDocumentPhoto(id: string): Promise<string | null> {
  const res = await apiFetch(`/documentos/admissionais/${id}/photo`);
  if (!res.ok) {
    throw new Error(`/documentos/admissionais/${id}/photo responded with ${res.status}`);
  }
  const data = (await res.json()) as { photoDataUrl: string | null };
  return data.photoDataUrl;
}
```

- [ ] **Step 2: `atestado-viewer.tsx` (novo)**

```typescript
"use client";

import { useRef, useState } from "react";

import { getAtestadoPhoto } from "../documentos/actions";
import styles from "./aprovacoes.module.css";

type PhotoStatus = "idle" | "loading" | "loaded" | "empty" | "error";

export function AtestadoViewer({
  id,
  dias,
  cid,
  crm,
  medico,
  canSeeClinicalDetails,
}: {
  id: string;
  dias: number | null;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  canSeeClinicalDetails: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<PhotoStatus>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  async function openPhoto() {
    dialogRef.current?.showModal();
    setStatus("loading");
    try {
      const url = await getAtestadoPhoto(id);
      setPhotoDataUrl(url);
      setStatus(url ? "loaded" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <p>{dias != null ? `${dias} dia(s)` : "Dias não informados"}</p>
      {canSeeClinicalDetails ? (
        <div className={styles.itemDetail}>
          {cid ? <p>CID: {cid}</p> : null}
          {medico ? <p>Médico: {medico}</p> : null}
          {crm ? <p>CRM: {crm}</p> : null}
        </div>
      ) : null}
      {canSeeClinicalDetails ? (
        <button type="button" className={styles.viewButton} onClick={openPhoto}>
          Ver foto
        </button>
      ) : null}

      <dialog ref={dialogRef} className={styles.dialog}>
        {status === "loading" ? <p>Carregando...</p> : null}
        {status === "loaded" && photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL
          <img src={photoDataUrl} alt="Foto do atestado" style={{ maxWidth: "100%" }} />
        ) : null}
        {status === "empty" ? <p>Este atestado não possui foto anexada.</p> : null}
        {status === "error" ? <p>Não foi possível carregar a foto.</p> : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </div>
      </dialog>
    </div>
  );
}
```

`canSeeClinicalDetails` é passado pela `page.tsx` como `session.role === "rh"` — mesma regra que `documentos/page.tsx` já usa (`hasClinicalDetail`).

- [ ] **Step 3: `admission-document-viewer.tsx` (novo)**

```typescript
"use client";

import { useRef, useState } from "react";

import { getAdmissionDocumentPhoto } from "../documentos/actions";
import styles from "./aprovacoes.module.css";

type PhotoStatus = "idle" | "loading" | "loaded" | "empty" | "error";

export function AdmissionDocumentViewer({ id, title }: { id: string; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<PhotoStatus>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  async function openPhoto() {
    dialogRef.current?.showModal();
    setStatus("loading");
    try {
      const url = await getAdmissionDocumentPhoto(id);
      setPhotoDataUrl(url);
      setStatus(url ? "loaded" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <p>{title}</p>
      <button type="button" className={styles.viewButton} onClick={openPhoto}>
        Ver foto
      </button>

      <dialog ref={dialogRef} className={styles.dialog}>
        {status === "loading" ? <p>Carregando...</p> : null}
        {status === "loaded" && photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL
          <img src={photoDataUrl} alt="Foto do documento" style={{ maxWidth: "100%" }} />
        ) : null}
        {status === "empty" ? <p>Este documento não possui foto anexada.</p> : null}
        {status === "error" ? <p>Não foi possível carregar a foto.</p> : null}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </div>
      </dialog>
    </div>
  );
}
```

- [ ] **Step 4: `actions.ts` — `decideAdmissionDocument`**

Em `apps/web/src/app/(app)/aprovacoes/actions.ts`, adicionar ao final:

```typescript
export async function decideAdmissionDocument(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/documentos/admissionais/${id}/status`, status, reviewNote);
}
```

- [ ] **Step 5: `page.tsx` — busca admissionais, monta os `viewer`s, novo grupo**

Em `apps/web/src/app/(app)/aprovacoes/page.tsx`:

```typescript
import { decideAdjustment, decideAdmissionDocument, decideAtestado, decideCompensation, decideVacation } from "./actions";
import { AdmissionDocumentViewer } from "./admission-document-viewer";
import { AtestadoViewer } from "./atestado-viewer";
```

Novo tipo, junto de `Atestado`/`Vacation`/`Request`:

```typescript
type AdmissionDocument = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
};
```

No `Promise.all`, adicionar a busca:

```typescript
  const [atestados, admissionDocuments, vacations, adjustments, compensations] = await Promise.all([
    apiFetchJson<Atestado[]>("/atestados/team"),
    apiFetchJson<AdmissionDocument[]>("/documentos/admissionais/equipe"),
    apiFetchJson<Vacation[]>("/solicitacoes/ferias/todas"),
    apiFetchJson<Request[]>("/solicitacoes/ajustes/todas"),
    apiFetchJson<Request[]>("/solicitacoes/compensacoes/todas"),
  ]);
```

Filtros de pendente/decidido (mesma função `isDecided` já existente):

```typescript
  const pendingAdmissionDocuments = admissionDocuments.filter((d) => !isDecided(d.status));
  const historyAdmissionDocuments = admissionDocuments.filter((d) => isDecided(d.status));
```

Incluir nos dois `nothingAtAll` (adicionar `pendingAdmissionDocuments.length === 0 && historyAdmissionDocuments.length === 0 &&`).

No item `atestados` do grupo `"fila"`, adicionar `viewer` a cada item:

```typescript
              {
                key: "atestados",
                label: "Atestados",
                content: (
                  <ApprovalSection
                    emptyLabel="Nenhum atestado pendente."
                    onDecide={decideAtestado}
                    items={pendingAtestados.map((atestado) => ({
                      id: atestado.id,
                      name: atestado.userName,
                      detail: `${
                        atestado.dias != null ? `${atestado.dias} dia(s)` : "Dias não informados"
                      } · enviado em ${formatTimestamp(atestado.createdAt)}`,
                      viewer: (
                        <AtestadoViewer
                          id={atestado.id}
                          dias={atestado.dias}
                          cid={(atestado as unknown as { cid: string | null }).cid ?? null}
                          crm={(atestado as unknown as { crm: string | null }).crm ?? null}
                          medico={(atestado as unknown as { medico: string | null }).medico ?? null}
                          canSeeClinicalDetails={session.role === "rh"}
                        />
                      ),
                    }))}
                  />
                ),
              },
```

Nota: o tipo `Atestado` local de `page.tsx` hoje não inclui `cid`/`crm`/`medico` (só `id`/`userName`/`dias`/`status`/`reviewNote`/`createdAt`) — **adicionar esses 3 campos ao tipo `Atestado`** (`cid: string | null; crm: string | null; medico: string | null;`) em vez do cast acima, que é só ilustrativo. Ajustar `apiFetchJson<Atestado[]>("/atestados/team")` para já vir tipado certo, e o `.map` acima para ler `atestado.cid`/`atestado.crm`/`atestado.medico` diretamente, sem cast.

`page.tsx` precisa de `session` (já disponível — checar se a função já captura `session` de `getSession()` no topo; se a página não guardou essa variável antes, adicionar `const session = await getSession();` — já deve existir dado o guard de permissão logo no início da função).

Adicionar o novo item "Documentos admissionais" ao grupo `"fila"` (logo depois de `"atestados"`):

```typescript
              {
                key: "admissionais",
                label: "Documentos admissionais",
                content: (
                  <ApprovalSection
                    emptyLabel="Nenhum documento admissional pendente."
                    onDecide={decideAdmissionDocument}
                    items={pendingAdmissionDocuments.map((document) => ({
                      id: document.id,
                      name: document.userName,
                      detail: `${document.title} · enviado em ${formatTimestamp(document.submittedAt)}`,
                      viewer: <AdmissionDocumentViewer id={document.id} title={document.title} />,
                    }))}
                  />
                ),
              },
```

E o item equivalente no grupo `"historico"`:

```typescript
              {
                key: "admissionais",
                label: "Documentos admissionais",
                content: (
                  <HistorySection
                    emptyLabel="Nenhum documento admissional decidido ainda."
                    rejectedLabel="Reprovado"
                    items={historyAdmissionDocuments.map((document) => ({
                      id: document.id,
                      name: document.userName,
                      detail: `${document.title} · enviado em ${formatTimestamp(document.submittedAt)}`,
                      status: document.status as "aprovado" | "recusado",
                      reviewNote: document.reviewNote,
                    }))}
                  />
                ),
              },
```

Adicionar `rejectedLabel="Reprovado"` também no `HistorySection` de `"atestados"` (que já existe no grupo `"historico"`).

- [ ] **Step 6: Rodar `e2e/aprovacoes.spec.ts` (Task 8) e `e2e/documentos.spec.ts` inteiros**

```bash
cd apps/web
npx playwright test e2e/aprovacoes.spec.ts e2e/documentos.spec.ts
```

Esperado: PASS em ambos (portas 3000/3001 livres antes de rodar — ver nota de processo no fim deste plano).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/aprovacoes apps/web/src/app/\(app\)/documentos/actions.ts
git commit -m "feat(web): aprovacoes shows Visualizar dialogs and an admissionais queue"
```

---

## Task 10: Web — Documentos: relabel + "Ver foto" pra admissionais

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/page.tsx`
- Create: `apps/web/src/app/(app)/documentos/admission-document-photo-button.tsx`
- Test: `apps/web/e2e/documentos.spec.ts`

- [ ] **Step 1: Escrever o teste primeiro**

Em `apps/web/e2e/documentos.spec.ts`, adicionar:

```typescript
test("gestor and rh both see Ver foto for an admissionais document, unlike the atestado's RH-only rule", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-photo-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        title: "RG",
        status: "em_analise",
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais/adm-photo-1/photo",
    response: { photoDataUrl: "data:image/jpeg;base64,ZmFrZQ==" },
  });

  await page.goto("/documentos");
  await page.getByText("Diana Colaboradora (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByAltText("Foto do documento")).toBeVisible();
});

test("shows Reprovado instead of Recusado for an admissionais document", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-rep-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        title: "RG",
        status: "recusado",
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await page.getByText("Diana Colaboradora (1)", { exact: true }).click();
  await expect(page.getByText("Reprovado", { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/web
npx playwright test e2e/documentos.spec.ts -g "Ver foto for an admissionais|Reprovado instead"
```

Esperado: FAIL.

- [ ] **Step 3: `admission-document-photo-button.tsx` (novo)**

```typescript
"use client";

import { useRef, useState } from "react";

import { getAdmissionDocumentPhoto } from "./actions";
import styles from "./documentos.module.css";

type PhotoStatus = "idle" | "loading" | "loaded" | "empty" | "error";

export function AdmissionDocumentPhotoButton({ id }: { id: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<PhotoStatus>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  async function open() {
    dialogRef.current?.showModal();
    setStatus("loading");
    try {
      const url = await getAdmissionDocumentPhoto(id);
      setPhotoDataUrl(url);
      setStatus(url ? "loaded" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" className={styles.photoButton} onClick={open}>
        Ver foto
      </button>

      <dialog ref={dialogRef} className={styles.photoDialog}>
        {status === "loading" ? <p>Carregando...</p> : null}
        {status === "loaded" && photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL
          <img src={photoDataUrl} alt="Foto do documento" className={styles.photoImage} />
        ) : null}
        {status === "empty" ? <p>Este documento não possui foto anexada.</p> : null}
        {status === "error" ? <p>Não foi possível carregar a foto.</p> : null}
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
    </>
  );
}
```

- [ ] **Step 4: `page.tsx` — usar o botão + relabel**

Trocar `STATUS_LABEL`:

```typescript
const STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado",
};
```

No import, adicionar `AdmissionDocumentPhotoButton`. Na seção "Documentos admissionais" de `TeamView`, dentro do `.map((document) => ...)`, adicionar o botão (mesma posição do `AtestadoPhotoButton` na seção de atestados, mas **sem** checar `session.role === "rh"` — visível pra gestor e rh):

```typescript
                      <div className={styles.itemHeader}>
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{document.userName}</span>
                          <span className={styles.itemDetail}>
                            {document.title} · enviado em {formatDate(document.submittedAt)}
                          </span>
                        </div>
                        <span className={styles.status}>{STATUS_LABEL[document.status]}</span>
                      </div>
                      <AdmissionDocumentPhotoButton id={document.id} />
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx playwright test e2e/documentos.spec.ts
```

Esperado: PASS (suíte inteira).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos
git commit -m "feat(web): admissionais get a Ver foto button in Documentos; relabel Reprovado"
```

---

## Task 11: Web — Onboarding do colaborador + sidebar

**Files:**
- Modify: `apps/web/src/app/(app)/onboarding/page.tsx`
- Create: `apps/web/src/app/(app)/onboarding/onboarding-task-list.tsx`
- Create: `apps/web/src/app/(app)/onboarding/task-document-form.tsx`
- Create: `apps/web/src/app/(app)/onboarding/actions.ts`
- Create: `apps/web/src/app/api/onboarding/tarefas/[taskId]/documento/route.ts`
- Modify: `apps/web/src/lib/nav-sections.ts`
- Test: `apps/web/e2e/onboarding.spec.ts` (novo)

**Interfaces:**
- Consumes: `NAV_SECTIONS`/`COLABORADOR_SIDEBAR` (já existem — Task 11 só adiciona uma entrada).

- [ ] **Step 1: Escrever o teste primeiro**

Criar `apps/web/e2e/onboarding.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

test("colaborador sees the onboarding checklist with progress", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "d1", order: 1, requiresUpload: false },
        { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "d2", order: 2, requiresUpload: true },
      ],
      completedTaskIds: ["t1"],
    },
  });

  await page.goto("/onboarding");

  await expect(page.getByText("1 de 2 concluídos")).toBeVisible();
  await expect(page.getByText("Assinar o contrato")).toBeVisible();
});

test("the flagged task shows an upload form instead of a toggle", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "d1", order: 1, requiresUpload: false },
        { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "d2", order: 2, requiresUpload: true },
      ],
      completedTaskIds: [],
    },
  });

  await page.goto("/onboarding");

  await expect(page.getByLabel("Título", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeVisible();
});

test("submitting a document for the flagged task marks it complete", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "d2", order: 1, requiresUpload: true },
      ],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/t2/documento",
    status: 201,
    response: { id: "adm-new", title: "RG", status: "em_analise" },
  });

  await page.goto("/onboarding");
  await page.getByLabel("Título", { exact: true }).fill("RG");
  await page.locator('input[type="file"]').setInputFiles({
    name: "rg.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
});
```

`mockApi`/`seedResponse` do `test-session.ts` já suportam `path`/`response` arbitrários via `seedResponse` (usado em vários outros specs) — não deve precisar de mudança em `test-session.ts` para este arquivo.

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/web
npx playwright test e2e/onboarding.spec.ts
```

Esperado: FAIL — `/onboarding` ainda bloqueia colaborador com "Sem permissão".

- [ ] **Step 3: Route Handler pro upload da tarefa (base64 — mesmo motivo das Tasks de bugfix já commitadas: Server Action quebra com foto grande)**

```typescript
// apps/web/src/app/api/onboarding/tarefas/[taskId]/documento/route.ts
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await request.text();
  const res = await apiFetch(`/onboarding/tarefas/${taskId}/documento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: `onboarding/actions.ts` (novo) — só o toggle, que não carrega foto**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function toggleOnboardingTask(taskId: string) {
  const res = await apiFetch(`/onboarding/tarefas/${taskId}/toggle`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`/onboarding/tarefas/${taskId}/toggle responded with ${res.status}`);
  }
  revalidatePath("/onboarding");
  return (await res.json()) as { completed: boolean };
}
```

- [ ] **Step 5: `task-document-form.tsx` (novo) — client component, mesmo padrão de `admission-document-form.tsx` (Route Handler, não Server Action)**

```typescript
"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { PhotoUploadField, type PickedPhoto } from "../documentos/photo-upload-field";
import styles from "./onboarding.module.css";

type SubmitStatus = "idle" | "pending" | "success" | "error";

export function TaskDocumentForm({ taskId, onSubmitted }: { taskId: string; onSubmitted: () => void }) {
  const [title, setTitle] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoResetToken, setPhotoResetToken] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoDataUrl) return;
    setStatus("pending");
    setError(null);

    const res = await fetch(`/api/onboarding/tarefas/${taskId}/documento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), photoUri: photoDataUrl }),
    });

    if (!res.ok) {
      setStatus("error");
      setError(`Não foi possível enviar (código ${res.status}).`);
      return;
    }

    setTitle("");
    setPhotoDataUrl(null);
    setPhotoResetToken((token) => token + 1);
    setStatus("success");
    onSubmitted();
  }

  function handlePhotoPicked(picked: PickedPhoto) {
    setPhotoDataUrl(picked.dataUrl);
  }

  return (
    <form className={styles.taskForm} onSubmit={handleSubmit}>
      <label htmlFor="onboarding-doc-title">Título</label>
      <input
        id="onboarding-doc-title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className={styles.taskFormInput}
        required
      />
      <PhotoUploadField key={photoResetToken} name="photo" label="Foto" required onPicked={handlePhotoPicked} />
      {error ? <p className={styles.error}>{error}</p> : null}
      {status === "success" ? <p className={styles.success}>Enviado!</p> : null}
      <button type="submit" className={styles.taskFormSubmit} disabled={status === "pending"}>
        {status === "pending" ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: `onboarding-task-list.tsx` (novo) — client component com o estado local de progresso**

```typescript
"use client";

import { useState } from "react";

import { toggleOnboardingTask } from "./actions";
import { TaskDocumentForm } from "./task-document-form";
import styles from "./onboarding.module.css";

type Task = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
};

export function OnboardingTaskList({
  tasks,
  initialCompletedTaskIds,
}: {
  tasks: Task[];
  initialCompletedTaskIds: string[];
}) {
  const [completed, setCompleted] = useState(new Set(initialCompletedTaskIds));

  async function handleToggle(taskId: string) {
    const result = await toggleOnboardingTask(taskId);
    setCompleted((current) => {
      const next = new Set(current);
      if (result.completed) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function markDone(taskId: string) {
    setCompleted((current) => new Set(current).add(taskId));
  }

  const percent = tasks.length > 0 ? Math.round((completed.size / tasks.length) * 100) : 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Onboarding</h1>
      <p className={styles.subheading}>Complete os passos abaixo antes do seu primeiro dia.</p>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.subheading}>
        {completed.size} de {tasks.length} concluídos
      </p>

      <ul className={styles.list}>
        {tasks.map((task) => {
          const done = completed.has(task.id);
          return (
            <li key={task.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.itemName}>{task.title}</span>
                <span className={done ? styles.statusAprovado : styles.status}>
                  {done ? "Enviado" : "Pendente"}
                </span>
              </div>
              <p className={styles.itemDetail}>{task.description}</p>
              {task.requiresUpload ? (
                done ? null : <TaskDocumentForm taskId={task.id} onSubmitted={() => markDone(task.id)} />
              ) : (
                <button type="button" className={styles.toggleButton} onClick={() => handleToggle(task.id)}>
                  {done ? "Marcar como pendente" : "Marcar como concluída"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

Nota: o label "Enviado"/"Pendente" é deliberado — a task flagada mostra só se já foi enviada ou não, nunca o status de aprovação (Em Análise/Aprovado/Reprovado), que só existe em `/documentos` (ver spec §1). As outras 4 tarefas usam "Enviado" também por simplicidade (o toggle já as marca "concluída" via o mesmo Set) — usar "Concluída"/"Pendente" para as tarefas de toggle simples se preferir um texto mais adequado a elas; manter os dois grupos com o texto que fizer mais sentido lendo o item é aceitável, contanto que a distinção upload-vs-toggle do parágrafo acima não se perca.

Vai precisar de `.taskForm`, `.taskFormInput`, `.taskFormSubmit`, `.toggleButton`, `.error`, `.success` novos em `onboarding.module.css` (seguir o estilo de `.form`/`.textInput`/`.submitButton` já usados em `documentos.module.css`, copiar as mesmas propriedades).

- [ ] **Step 7: `page.tsx` — branch pro colaborador**

Em `apps/web/src/app/(app)/onboarding/page.tsx`, trocar o guard e adicionar o branch:

```typescript
import { OnboardingTaskList } from "./onboarding-task-list";

// ... tipos Task/TeamProgress já existentes, adicionar requiresUpload a Task:
type Task = {
  id: string;
  icon: string;
  title: string;
  description: string;
  requiresUpload: boolean;
};

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }

  if (session.role === "colaborador") {
    const { tasks, completedTaskIds } = await apiFetchJson<{
      tasks: Task[];
      completedTaskIds: string[];
    }>("/onboarding/tarefas");
    return <OnboardingTaskList tasks={tasks} initialCompletedTaskIds={completedTaskIds} />;
  }

  // ... resto do arquivo (branch gestor/rh) permanece igual ...
}
```

- [ ] **Step 8: `nav-sections.ts`**

```typescript
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh", "colaborador"] },
```

(troca `roles: ["gestor", "rh"]` por incluir `"colaborador"`, na entrada já existente de `/onboarding` em `NAV_SECTIONS`).

Em `COLABORADOR_SIDEBAR`, adicionar como item de topo-nível (junto de Banco de Horas/Férias/Documentos/Mural):

```typescript
  { href: "/onboarding", label: "Onboarding" },
```

- [ ] **Step 9: Rodar e ver passar**

```bash
npx playwright test e2e/onboarding.spec.ts e2e/app-shell.spec.ts
```

Esperado: PASS (`app-shell.spec.ts` garante que a nova entrada de sidebar não quebrou o resto do menu do colaborador).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/\(app\)/onboarding apps/web/src/app/api/onboarding apps/web/src/lib/nav-sections.ts apps/web/e2e/onboarding.spec.ts
git commit -m "feat(web): colaborador onboarding checklist with embedded document upload"
```

---

## Task 12: Web — confirmação também em `submitCertification`

**Files:**
- Modify: `apps/web/src/app/(app)/documentos/actions.ts`
- Modify: `apps/web/src/app/(app)/documentos/page.tsx` (`CertificacoesSection`)
- Test: `apps/web/e2e/documentos.spec.ts`

Certificação não carrega foto — pode continuar Server Action normal, só ganha o mesmo feedback visual dos outros dois formulários (consistência, spec §4.1).

- [ ] **Step 1: Escrever o teste primeiro**

Em `apps/web/e2e/documentos.spec.ts`, no teste `"colaborador sees their own certifications and can submit a new one"` já existente, adicionar ao final (antes do fechamento do teste):

```typescript
  await expect(page.getByText("Certificação salva com sucesso!")).toBeVisible();
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/web
npx playwright test e2e/documentos.spec.ts -g "can submit a new one$"
```

- [ ] **Step 3: `actions.ts` — `submitCertification` vira `useActionState`-compatível**

```typescript
export type CertificationSubmitState = { error: string | null; success: boolean; successToken: number };

export async function submitCertification(
  _prevState: CertificationSubmitState,
  formData: FormData,
): Promise<CertificationSubmitState> {
  const name = formData.get("name");
  const institution = formData.get("institution");
  const validUntil = formData.get("validUntil");
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof institution !== "string" ||
    institution.trim().length === 0 ||
    typeof validUntil !== "string" ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(validUntil)
  ) {
    return {
      error: "Preencha nome, instituição e uma data válida (DD/MM/AAAA).",
      success: false,
      successToken: _prevState.successToken,
    };
  }
  const res = await apiFetch("/documentos/certificacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), institution: institution.trim(), validUntil }),
  });
  if (!res.ok) {
    return {
      error: `Não foi possível salvar (código ${res.status}).`,
      success: false,
      successToken: _prevState.successToken,
    };
  }
  revalidatePath("/documentos");
  return { error: null, success: true, successToken: Date.now() };
}
```

- [ ] **Step 4: `page.tsx` — `CertificacoesSection` vira client, usa `useActionState`**

`CertificacoesSection` precisa virar seu próprio arquivo `"use client"` (hoje é uma função de Server Component dentro de `page.tsx`) — extrair para `apps/web/src/app/(app)/documentos/certification-form.tsx`:

```typescript
"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitCertification } from "./actions";
import styles from "./documentos.module.css";

export function CertificationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(submitCertification, {
    error: null,
    success: false,
    successToken: 0,
  });

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.successToken]);

  return (
    <form ref={formRef} className={styles.form} action={formAction}>
      <label htmlFor="name">Nome</label>
      <input id="name" name="name" type="text" className={styles.textInput} required />
      <label htmlFor="institution">Instituição</label>
      <input id="institution" name="institution" type="text" className={styles.textInput} required />
      <label htmlFor="validUntil">Válida até (DD/MM/AAAA)</label>
      <input
        id="validUntil"
        name="validUntil"
        type="text"
        placeholder="DD/MM/AAAA"
        pattern="\d{2}/\d{2}/\d{4}"
        className={styles.textInput}
        required
      />
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>Certificação salva com sucesso!</p> : null}
      <button type="submit" className={styles.submitButton} disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
```

Em `page.tsx`, dentro de `CertificacoesSection`, trocar o `<form action={submitCertification}>...</form>` inteiro por `<CertificationForm />`, e trocar o import de `submitCertification` (que não é mais usado direto em `page.tsx`) por `CertificationForm`.

- [ ] **Step 5: Rodar e ver passar**

```bash
npx playwright test e2e/documentos.spec.ts
```

Esperado: PASS (suíte inteira).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/documentos
git commit -m "feat(web): certification form shows a success confirmation"
```

---

## Task 13: Mobile — relabel + `atestados-equipe` pending check robusto

**Files:**
- Modify: `apps/mobile/src/lib/documentos.ts`
- Modify: `apps/mobile/src/app/atestados-equipe.tsx`
- Test: `apps/mobile/src/__tests__/app/(tabs)/documentos.test.tsx`
- Test: `apps/mobile/src/__tests__/app/atestados-equipe.test.tsx` (novo, se não existir)

- [ ] **Step 1: Escrever/checar os testes primeiro**

Checar se já existe `apps/mobile/src/__tests__/app/atestados-equipe.test.tsx`. Se não existir, criar um mínimo cobrindo a regressão:

```typescript
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("atestados-equipe screen", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("shows Aprovar/Recusar for an atestado with status em_analise, not just enviado", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith("/atestados/team")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "at-1",
              userId: "user-1",
              userName: "Ana Colaboradora",
              status: "em_analise",
              cid: "J06.9",
              crm: "CRM-MG 1",
              medico: "Dr. Teste",
              dias: 2,
              createdAt: "2026-09-05T09:00:00.000Z",
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderRouter("src/app", { initialUrl: "/atestados-equipe" });

    await waitFor(() => {
      expect(screen.getByText("Aprovar")).toBeTruthy();
    });
    expect(screen.getByText("Recusar")).toBeTruthy();
  });
});
```

No arquivo `apps/mobile/src/__tests__/app/(tabs)/documentos.test.tsx`, localizar o teste que checa o rótulo de status "Recusado" (se existir — buscar por `"Recusado"` no arquivo) e trocar a expectativa para `"Reprovado"`. Se não houver teste desse rótulo ainda, adicionar um:

```typescript
  it("shows Reprovado for a recusado atestado", async () => {
    storedAtestados = [
      {
        id: "seed-3",
        userId: "seed-user",
        userName: "Ana Colaboradora",
        status: "recusado",
        cid: "J06.9",
        crm: "CRM-MG 1",
        medico: "Dr. Teste",
        dias: 1,
        photoUri: null,
        createdAt: "2026-09-01T09:00:00.000Z",
      },
    ];

    renderRouter("src/app", { initialUrl: "/documentos" });

    await waitFor(() => {
      expect(screen.getByText("Reprovado")).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/mobile
npx jest atestados-equipe documentos.test
```

- [ ] **Step 3: Implementar o relabel**

Em `apps/mobile/src/lib/documentos.ts`:

```typescript
export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado",
};
```

- [ ] **Step 4: Implementar o pending check robusto**

Em `apps/mobile/src/app/atestados-equipe.tsx`, localizar:

```typescript
            {atestado.status === "enviado" ? (
```

e trocar por:

```typescript
            {!["aprovado", "recusado"].includes(atestado.status) ? (
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx jest atestados-equipe documentos.test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/documentos.ts apps/mobile/src/app/atestados-equipe.tsx apps/mobile/src/__tests__
git commit -m "fix(mobile): relabel Reprovado, treat any non-decided status as pending"
```

---

## Task 14: Mobile — Onboarding com upload embutido

**Files:**
- Modify: `apps/mobile/src/lib/onboarding-api.ts`
- Modify: `apps/mobile/src/app/onboarding.tsx`
- Test: `apps/mobile/src/__tests__/app/onboarding.test.tsx` (novo, se não existir)

**Interfaces:**
- Consumes: `POST /onboarding/tarefas/:taskId/documento` (Task 6).

- [ ] **Step 1: Escrever o teste primeiro**

Checar se `apps/mobile/src/__tests__/app/onboarding.test.tsx` já existe — se sim, estender; se não, criar:

```typescript
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
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
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (globalThis.fetch as jest.Mock).mockReset();
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith("/onboarding/tarefas") && (!options || !options.method)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tasks: [
              { id: "t1", icon: "document-text-outline", title: "Assinar o contrato", description: "d1", order: 1, requiresUpload: false },
              { id: "t2", icon: "cloud-upload-outline", title: "Enviar documentos", description: "d2", order: 2, requiresUpload: true },
            ],
            completedTaskIds: [],
          }),
        });
      }
      if (url.endsWith("/onboarding/tarefas/t2/documento") && options?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "adm-new" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    await saveSessionToken("test-token");
  });

  it("shows an upload form for the flagged task instead of a checklist toggle", async () => {
    renderRouter("src/app", { initialUrl: "/onboarding" });

    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });
    expect(screen.getByPlaceholderText(/comprovante|título|documento/i)).toBeTruthy();
  });

  it("submitting a document for the flagged task marks it done", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });

    renderRouter("src/app", { initialUrl: "/onboarding" });
    await waitFor(() => {
      expect(screen.getByText("Enviar documentos")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Tirar foto"));
    fireEvent.changeText(screen.getByPlaceholderText(/comprovante|título|documento/i), "RG");
    fireEvent.press(screen.getByText("Enviar"));

    await waitFor(() => {
      const call = (globalThis.fetch as jest.Mock).mock.calls.find(
        ([url, options]: [string, RequestInit | undefined]) =>
          url.endsWith("/onboarding/tarefas/t2/documento") && options?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/mobile
npx jest onboarding.test
```

- [ ] **Step 3: `onboarding-api.ts` — nova função + `requiresUpload` no tipo**

```typescript
export type OnboardingTaskRecord = {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  requiresUpload: boolean;
};

// ... isOnboardingTasksResponse/authedFetch/fetchOnboardingTasks/toggleOnboardingTask continuam iguais ...

export async function submitOnboardingTaskDocument(
  token: string,
  taskId: string,
  input: { title: string; photoUri: string },
): Promise<{ id: string } | null> {
  try {
    const response = await authedFetch(token, `/onboarding/tarefas/${taskId}/documento`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as { id: string };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: `onboarding.tsx` — form embutido pra tarefa flagada**

```typescript
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { pickPhoto } from "@/lib/photo-picker";
import { readPhotoAsDataUrl } from "@/lib/photo-data-url";
import {
  fetchOnboardingTasks,
  submitOnboardingTaskDocument,
  toggleOnboardingTask,
  type OnboardingTaskRecord,
} from "@/lib/onboarding-api";
import { getSessionToken } from "@/lib/session";

export default function OnboardingScreen() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<OnboardingTaskRecord[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadPhotoUri, setUploadPhotoUri] = useState<string | null>(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const result = await fetchOnboardingTasks(token);
        if (cancelled || !result) return;
        setTasks(result.tasks);
        setDone(new Set(result.completedTaskIds));
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

  async function handlePickPhoto(source: "camera" | "library") {
    const uri = await pickPhoto(source);
    if (uri) setUploadPhotoUri(uri);
  }

  async function handleSubmitDocument(taskId: string) {
    if (!uploadTitle.trim() || !uploadPhotoUri) return;
    const token = await getSessionToken();
    if (!token) return;
    setUploadSubmitting(true);
    const photoDataUrl = await readPhotoAsDataUrl(uploadPhotoUri);
    const result = await submitOnboardingTaskDocument(token, taskId, {
      title: uploadTitle.trim(),
      photoUri: photoDataUrl,
    });
    setUploadSubmitting(false);
    if (!result) return;
    setDone((current) => new Set(current).add(taskId));
    setUploadTitle("");
    setUploadPhotoUri(null);
  }

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

            if (task.requiresUpload) {
              return (
                <View key={task.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.rowContent}>
                    <ThemedText type="smallBold">{task.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {task.description}
                    </ThemedText>
                  </View>
                  {checked ? (
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  ) : (
                    <View style={styles.uploadForm}>
                      <View style={styles.photoButtons}>
                        <Pressable
                          style={[styles.photoButton, { backgroundColor: theme.background }]}
                          onPress={() => handlePickPhoto("camera")}
                        >
                          <Ionicons name="camera-outline" size={20} color={theme.secondary} />
                          <ThemedText type="small">Tirar foto</ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.photoButton, { backgroundColor: theme.background }]}
                          onPress={() => handlePickPhoto("library")}
                        >
                          <Ionicons name="image-outline" size={20} color={theme.secondary} />
                          <ThemedText type="small">Escolher da galeria</ThemedText>
                        </Pressable>
                      </View>
                      <TextInput
                        value={uploadTitle}
                        onChangeText={setUploadTitle}
                        placeholder="Ex: RG, CPF, comprovante de residência"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                      />
                      <ThemedButton
                        title="Enviar"
                        onPress={() => handleSubmitDocument(task.id)}
                        disabled={uploadSubmitting}
                      />
                    </View>
                  )}
                </View>
              );
            }

            return (
              <Pressable
                key={task.id}
                onPress={() => toggle(task.id)}
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
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  list: { gap: Spacing.two, marginTop: Spacing.two },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: { flex: 1, gap: 2 },
  strikethrough: { textDecorationLine: "line-through" },
  uploadForm: { flex: 1, gap: Spacing.two },
  photoButtons: { flexDirection: "row", gap: Spacing.two },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    borderRadius: 12,
    paddingVertical: Spacing.two,
  },
  input: { borderRadius: 12, padding: Spacing.two, fontSize: 14 },
});
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx jest onboarding.test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/onboarding-api.ts apps/mobile/src/app/onboarding.tsx apps/mobile/src/__tests__
git commit -m "feat(mobile): onboarding embeds a document upload for the flagged task"
```

---

## Task 15: Verificação final — suítes completas + smoke manual

**Files:** nenhum (task de checkpoint final).

- [ ] **Step 1: Rebuild do shared-types (garantia — várias tasks acima tocaram nele)**

```bash
cd packages/shared-types && npm run build
```

- [ ] **Step 2: Suíte completa da API**

```bash
cd apps/api && npx jest 2>&1 | tail -20
```

Esperado: só as 9 falhas pré-existentes de `auth.service.spec.ts`.

- [ ] **Step 3: Suíte completa do mobile**

```bash
cd apps/mobile && npx jest 2>&1 | tail -20
```

Esperado: só a falha pré-existente de `ferias.test.tsx` (calendar testid, não relacionada).

- [ ] **Step 4: Suíte completa e2e do web**

Antes de rodar, garanta que nenhum processo esteja escutando nas portas 3000/3001 (o `webServer` do Playwright sobe os próprios: `fake-api-server.mjs` na 3000, `pnpm dev` na 3001) — se os dev servers reais estiverem rodando, pare-os primeiro.

```bash
cd apps/web && npx playwright test
```

Esperado: PASS em tudo, exceto a falha pré-existente e não relacionada em `auth.spec.ts` ("clicking Entrar com SSO completes login") — confirmada antes desta feature como pré-existente até na `master`.

- [ ] **Step 5: Smoke manual end-to-end contra os dev servers reais**

Reinicie `apps/api` (`npm run start:dev`) e `apps/web` (`npm run dev`). Como colaborador: enviar um atestado com foto real (>1MB) e um documento admissional, conferir a mensagem de sucesso em cada um, conferir Onboarding (tarefa "Enviar documentos" mostra upload). Como gestor: abrir Aprovações, ver "Visualizar" em Atestados e Documentos admissionais, aprovar um e reprovar outro com justificativa, conferir que o sino do colaborador recebeu a notificação de status. Como RH: repetir, conferir que RH também vê CID/CRM/médico do atestado (gestor não) e que ambos veem a foto do admissional. Conferir que o sino de gestor/RH recebeu notificação assim que os documentos foram enviados no início do teste.

- [ ] **Step 6: Commit final (se sobrar algo solto, ex. lockfile)**

```bash
git status
```

Se houver qualquer mudança não commitada de uma task anterior, revisar e commitar antes de encerrar.
