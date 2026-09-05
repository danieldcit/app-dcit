# Revisão de Documentos (Atestados + Admissionais) + Upload no Onboarding

**Status:** Proposto
**Specs relacionadas:** [`2026-09-02-notificacoes-web-design.md`](2026-09-02-notificacoes-web-design.md) / [`2026-09-02-notificacoes-mobile-design.md`](2026-09-02-notificacoes-mobile-design.md) (infraestrutura de sino/inbox), [`2026-09-04-mural-post-notifications-design.md`](2026-09-04-mural-post-notifications-design.md) (padrão mais recente de notificação, mesmo idioma de código)

## 1. Objetivo e escopo

Levantado numa sessão de testes ao vivo (2026-09-05), depois do lote de correções pontuais (limite de 1MB nas Server Actions, hidratação do tema, foto obrigatória, Ctrl+K, sidebar recolhível, holerites do colaborador — já implementados e fora desta spec). Os problemas reais encontrados:

1. **Nenhuma confirmação visível** ao enviar um atestado ou documento admissional — o formulário só recarrega a lista, sem feedback de sucesso.
2. **Nenhuma notificação no sino** para gestor/RH quando um colaborador envia um documento — hoje só existe push (mobile), e só para atestado; documento admissional nunca notifica ninguém.
3. **Documentos admissionais não têm fluxo de aprovação nenhum** — não aparecem na fila de Aprovações, não existe endpoint de status, gestor/RH não conseguem decidir nada sobre eles.
4. **A fila de Aprovações deixa aprovar/recusar um atestado sem antes ver o que foi enviado** — hoje mostra só nome + dias + data, com botões "Aprovar"/"Recusar" direto na lista (ver captura de tela `Fila de aprovações`, 2026-09-05). Pedido explícito: primeiro um botão "Visualizar", só depois disso as opções de status (Em Análise / Aprovado / Reprovado — Reprovado exige justificativa).
5. **Colaborador não tem Onboarding no web** — a tela existe em `/onboarding` só para gestor/rh (progresso da equipe); o mobile já tem uma tela própria de onboarding para o colaborador (`apps/mobile/src/app/onboarding.tsx`, checklist com toggle), mas o web não tem nada equivalente.
6. **A tarefa "Enviar documentos" do onboarding não envia documento nenhum** — é só mais um toggle manual, mas seu texto diz "RG, CPF, comprovante de residência e demais documentos admissionais" (decidido em conversa: só essa tarefa ganha upload embutido; as outras 4 continuam toggle simples).

**Decidido em conversa:**

- Documento admissional não tem o mesmo sigilo clínico do atestado (LGPD) — **gestor e RH** podem ver a foto de um admissional (diferente do atestado, onde só RH vê CID/CRM/médico/foto — essa restrição **não muda**).
- Onboarding no colaborador é só a checklist + upload embutido na tarefa "Enviar documentos" — **sem** conceito de aprovação dentro do onboarding em si. Ver o status de cada documento enviado (Em Análise/Aprovado/Reprovado) é sempre em Documentos, nunca dentro da tela de Onboarding.
- Renomear "Ponto" → "Colaborador" foi só na sidebar do próprio colaborador (já implementado, fora desta spec).
- No mobile, só a parte do colaborador é tocada (checklist de onboarding + upload da tarefa, rótulos de status). **Nenhuma tela nova de gestor/RH no mobile** — aprovação de admissionais fica só no web, mesmo padrão de Colaboradores/Escala/Aprovações/Pagamentos/Onboarding-equipe, que já são só-web hoje.
- A fila de Aprovações (`/aprovacoes`) é o lugar certo para decidir — **não** duplicar essa ação dentro de `/documentos` (que continua sendo a tela de navegar/consultar, papel que já cumpre para férias/ajustes/compensações vs. a própria Aprovações).

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model Atestado {
  ...
  status        String   @default("em_analise") // era "enviado"
  ...
}

model AdmissionDocument {
  ...
  status      String   @default("em_analise") // era "enviado"
  reviewNote  String?  // novo — mesmo papel do reviewNote de Atestado
  ...
}

model OnboardingTask {
  id          String  @id @default(uuid())
  icon        String
  title       String
  description String
  order       Int
  requiresUpload Boolean @default(false) // novo
}
```

`"enviado"` continua um valor válido em linhas antigas (nunca migradas) — todo código que checa "ainda pendente" deve tratar como pendente **qualquer status que não seja `aprovado` nem `recusado`**, nunca comparar contra `"enviado"` especificamente (ver §3.3 e §5.2, que hoje fazem exatamente essa comparação frágil).

Migration: `npx prisma migrate dev --name document_status_em_analise_and_onboarding_upload` dentro de `apps/api`. Só altera o `@default` de duas colunas (não afeta linhas existentes) e adiciona uma coluna boolean nova — sem necessidade de backfill de dados.

`apps/api/prisma/seed.ts` (`seedOnboarding`, modificado) — o guard `if (existing) return` no topo da função impede o `createMany` de rodar de novo em bancos já semeados, então a tarefa "Enviar documentos" de um `dev.db` existente nunca ganharia `requiresUpload: true` sozinha. Adicionar, **fora** do guard, um update idempotente que roda sempre:

```typescript
async function seedOnboarding() {
  const existing = await prisma.onboardingTask.findFirst();
  if (!existing) {
    await prisma.onboardingTask.createMany({ data: [ /* ... como já é hoje, incluindo requiresUpload: true na tarefa "Enviar documentos" ... */ ] });
  }
  await prisma.onboardingTask.updateMany({
    where: { title: 'Enviar documentos' },
    data: { requiresUpload: true },
  });
}
```

## 3. Backend (`apps/api`)

### 3.1 `packages/shared-types/src/documentos.ts` (modificado)

```typescript
import { statusUpdateSchema } from "./status-update";

export const AdmissionDocumentStatusUpdateSchema = statusUpdateSchema();
export type AdmissionDocumentStatusUpdate = z.infer<typeof AdmissionDocumentStatusUpdateSchema>;
```

Mesma fábrica que `AtestadoStatusUpdateSchema` já usa (`status-update.ts`) — `aprovado` sem `reviewNote`, `recusado` com `reviewNote` obrigatório (não-vazio). `packages/shared-types/src/index.ts` exporta o novo schema/tipo junto dos outros de `documentos.ts`.

O endpoint de upload de documento pela tarefa de onboarding (§3.5) reaproveita `AdmissionDocumentInputSchema` — sem schema novo.

### 3.2 `NotificationsService` (modificado, `apps/api/src/notifications/notifications.service.ts`)

Dois métodos novos, mesmo padrão de `sendMural`/`sendPontoPerdido` (`createManyAndReturn` awaited, push em `void Promise.all(...)`):

```typescript
const DOCUMENT_LABEL: Record<'atestado' | 'admissional', string> = {
  atestado: 'um atestado',
  admissional: 'um documento admissional',
};

const documentStatusMessage = (kind: 'atestado' | 'admissional', status: 'aprovado' | 'recusado') => {
  const noun = kind === 'atestado' ? 'atestado' : 'documento admissional';
  return status === 'aprovado' ? `Seu ${noun} foi aprovado.` : `Seu ${noun} foi reprovado.`;
};

async sendDocumentSubmitted(kind: 'atestado' | 'admissional', submitterUserId: string, submitterName: string): Promise<void> {
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

Não filtra o submissor em `sendDocumentSubmitted` porque quem envia é sempre `colaborador` e os destinatários são sempre `gestor`/`rh` — não há sobreposição possível (diferente de `sendMural`, que precisa excluir o autor porque todo mundo, de qualquer role, pode postar e receber).

### 3.3 `AtestadosService` (modificado, `apps/api/src/atestados/atestados.service.ts`)

Injeta `NotificationsService` no lugar do `ExpoPushService` (que deixa de ser usado diretamente neste service — toda notificação passa a sair por `NotificationsService`, que já embute o próprio push):

```typescript
constructor(
  @Inject(ANTHROPIC_CLIENT) private readonly anthropic: Anthropic,
  private readonly prisma: PrismaService,
  private readonly notifications: NotificationsService,
) {}
```

`create()` (modificado) — dispara a notificação de envio depois de gravar:

```typescript
async create(userId: string, userName: string, input: AtestadoInput) {
  const atestado = await this.prisma.atestado.create({ data: { userId, userName, ...input } });
  await this.notifications.sendDocumentSubmitted('atestado', userId, userName);
  return atestado;
}
```

`updateStatus()` (modificado) — troca o `void this.push.sendToUser(...)` direto por `sendDocumentStatusChanged` (que já cobre bell + push):

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

`AtestadosModule` troca `PushModule` por `NotificationsModule` nos imports (nada mais no módulo usa `ExpoPushService` diretamente).

`getPhoto()` (modificado) — abre exceção para o próprio dono ver a própria foto, mantendo gestor de fora (LGPD não muda):

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

`AtestadosController.getPhoto` (modificado) — remove `@Roles('rh')` (a checagem de permissão passa a viver dentro do service, porque agora depende também de "é o dono?", não só do role) e passa `req.user.sub`:

```typescript
@UseGuards(AuthGuard)
@Get(':id/photo')
async getPhoto(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
  const photoDataUrl = await this.atestados.getPhoto(id, req.user.role, req.user.sub);
  return { photoDataUrl };
}
```

### 3.4 `DocumentosService` (modificado, `apps/api/src/documentos/documentos.service.ts`)

Injeta `NotificationsService` também (além do `ExpoPushService` já adicionado para holerites):

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly push: ExpoPushService,
  private readonly notifications: NotificationsService,
) {}
```

`createAdmissionDocument()` (modificado):

```typescript
async createAdmissionDocument(userId: string, userName: string, input: AdmissionDocumentInput) {
  const document = await this.prisma.admissionDocument.create({
    data: { userId, title: input.title, photoUri: input.photoUri },
  });
  await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
  return document;
}
```

Precisa de `userName` — hoje `createAdmissionDocument` só recebe `userId`. `DocumentosController.createAdmissionDocument` (modificado) passa `req.user.name` (mesmo campo que `AtestadosController.create` já usa) — checar `AuthenticatedUser` já expõe `.name` (usado em `atestados.controller.ts`), então é só adicionar o argumento.

`listAllAdmissionDocuments()` e `listAdmissionDocuments()` (modificados) — excluem `photoUri` da resposta em lista, mesmo motivo/padrão do atestado (nunca botar um data: URL de foto numa resposta de lista):

```typescript
listAdmissionDocuments(userId: string) {
  return this.prisma.admissionDocument.findMany({
    where: { userId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, title: true, status: true, submittedAt: true },
  });
}

async listAllAdmissionDocuments() {
  const documents = await this.prisma.admissionDocument.findMany({
    orderBy: { submittedAt: 'desc' },
    select: { id: true, userId: true, title: true, status: true, submittedAt: true },
  });
  return this.withRequesterNames(documents);
}
```

`getAdmissionDocumentPhoto()` (novo) — aberto a gestor/rh OU ao próprio dono (diferente do atestado: aqui não há sigilo clínico, então gestor também vê, não só rh):

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
```

`updateAdmissionDocumentStatus()` (novo) — mesmo formato de `AtestadosService.updateStatus`:

```typescript
async updateAdmissionDocumentStatus(id: string, status: 'aprovado' | 'recusado', reviewNote?: string) {
  const updated = await this.prisma.admissionDocument.update({
    where: { id },
    data: { status, reviewNote: status === 'recusado' ? reviewNote : null },
  });
  await this.notifications.sendDocumentStatusChanged('admissional', updated.userId, status);
  return updated;
}
```

`AdmissionDocument.reviewNote` é o campo novo já incluído no snippet do §2.

### 3.5 `DocumentosController` (modificado, `apps/api/src/documentos/documentos.controller.ts`)

Dois handlers novos:

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

`createAdmissionDocument` (modificado) — passa `req.user.name`:

```typescript
async createAdmissionDocument(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
  const result = AdmissionDocumentInputSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.flatten());
  }
  return this.documentos.createAdmissionDocument(req.user.sub, req.user.name, result.data);
}
```

`DocumentosModule` (modificado) — adiciona `NotificationsModule` aos imports; adiciona `exports: [DocumentosService]` (necessário para o `OnboardingModule` importar, §3.6 — hoje `DocumentosModule` não exporta nada).

### 3.6 Onboarding com upload (`apps/api/src/onboarding/`)

`OnboardingService` (modificado) — injeta `DocumentosService`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly documentos: DocumentosService,
) {}

async submitTaskDocument(userId: string, userName: string, taskId: string, input: AdmissionDocumentInput) {
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
```

`upsert` em vez de `create`/`toggleTask` — enviar um segundo documento pela mesma tarefa não deve "desmarcar" a conclusão (diferente de `toggleTask`, que é deliberadamente um toggle para as outras 4 tarefas).

`OnboardingController` (modificado) — novo handler:

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

`OnboardingModule` (modificado) — adiciona `DocumentosModule` aos imports.

`getTasks()` (modificado, `OnboardingService`) — hoje devolve só `{ tasks, completedTaskIds }`; `tasks` já inclui todos os campos de `OnboardingTask` (nenhum `select` explícito), então `requiresUpload` já viria de graça — **nenhuma mudança necessária** aqui além do campo novo no schema.

## 4. Frontend web (`apps/web`)

### 4.1 Confirmação ao enviar um documento

`apps/web/src/app/(app)/documentos/actions.ts` (modificado) — `submitAtestado` e `submitAdmissionDocument` trocam de "lança Error" para o formato `useActionState` já usado em `createHolerite`/`createMuralPost`:

```typescript
export type DocumentSubmitState = { error: string | null; success: boolean; successToken: number };

export async function submitAdmissionDocument(
  _prevState: DocumentSubmitState,
  formData: FormData,
): Promise<DocumentSubmitState> {
  const title = formData.get("title");
  const photo = formData.get("photo");
  if (typeof title !== "string" || title.trim().length === 0) {
    return { error: "Título é obrigatório.", success: false, successToken: _prevState.successToken };
  }
  if (typeof photo !== "string" || photo.length === 0) {
    return { error: "Foto é obrigatória.", success: false, successToken: _prevState.successToken };
  }
  const res = await apiFetch("/documentos/admissionais", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.trim(), photoUri: photo }),
  });
  if (!res.ok) {
    return { error: `Não foi possível enviar (código ${res.status}).`, success: false, successToken: _prevState.successToken };
  }
  revalidatePath("/documentos");
  return { error: null, success: true, successToken: Date.now() };
}
```

Mesma transformação para `submitAtestado` (validações inline viram `return`s em vez de `throw`, mesmas mensagens de erro já escritas hoje).

`apps/web/src/app/(app)/documentos/atestado-form.tsx` e a seção `AdmissionaisSection` de `page.tsx` (modificados) — trocam `<form action={submitX}>` direto por `useActionState`, igual `novo-holerite-dialog.tsx`:

```typescript
const [state, formAction, pending] = useActionState(submitAdmissionDocument, { error: null, success: false, successToken: 0 });
const formRef = useRef<HTMLFormElement>(null);

useEffect(() => {
  if (state.success) formRef.current?.reset();
}, [state.successToken]);

// ...
<form ref={formRef} action={formAction}>
  ...
  {state.error ? <p className={styles.error}>{state.error}</p> : null}
  {state.success ? <p className={styles.success}>Documento enviado com sucesso!</p> : null}
  <button type="submit" disabled={pending}>Enviar</button>
</form>
```

`AdmissionaisSection`/`AtestadosSection` (hoje funções `async` de Server Component, porque recebem `documents`/`atestados` como prop) precisam de um componente `"use client"` novo por baixo do formulário para poder usar `useActionState` — extrair `AtestadoForm` (já é `"use client"`, só adaptar) e criar `AdmissionDocumentForm` (`"use client"`, novo) espelhando a mesma estrutura.

`.success` (nova classe CSS em `documentos.module.css`) — mesma cor/estilo de sucesso já usada em outro lugar do app (ex.: `statusAprovado`), texto verde.

Mesmo tratamento para `submitCertification` (consistência — os três formulários da página ganham o mesmo feedback), embora não fosse o pedido original.

### 4.2 Fila de Aprovações ganha "Visualizar" + admissionais

`apps/web/src/app/(app)/aprovacoes/page.tsx` (modificado) — busca também os admissionais da equipe:

```typescript
const [atestados, admissionDocuments, vacations, adjustments, compensations] = await Promise.all([
  apiFetchJson<Atestado[]>("/atestados/team"),
  apiFetchJson<AdmissionDocument[]>("/documentos/admissionais/equipe"),
  ...
]);
const pendingAdmissionDocuments = admissionDocuments.filter((d) => !isDecided(d.status));
const historyAdmissionDocuments = admissionDocuments.filter((d) => isDecided(d.status));
```

Novo grupo "Documentos admissionais" na `AprovacoesAccordion`, mesmo padrão do grupo "Atestados" — `ApprovalSection` na fila, `HistorySection` no histórico.

`apps/web/src/app/(app)/aprovacoes/approval-section.tsx` (modificado) — cada item ganha um `viewer?: ReactNode` opcional. Quando presente, a linha mostra **só** o botão "Visualizar" (não mais "Aprovar"/"Recusar" direto); esse botão abre um `<dialog>` com o `viewer` (conteúdo completo do documento) e, dentro do mesmo diálogo, os controles de decisão (reaproveitando a lógica de `RejectButton`, agora dentro do diálogo de visualização em vez de solto na lista). Itens sem `viewer` (férias, ajustes, banco de horas) continuam exatamente como hoje — **fora de escopo**, o pedido foi especificamente sobre documentos.

```typescript
type ApprovalItem = {
  id: string;
  name: string;
  detail: string;
  viewer?: ReactNode; // novo — presença decide "Visualizar" vs. Aprovar/Recusar direto
};

function ViewAndDecideButton({ id, name, viewer, onDecide }: { id: string; name: string; viewer: ReactNode; onDecide: (formData: FormData) => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rejecting, setRejecting] = useState(false);

  return (
    <>
      <button type="button" className={styles.viewButton} onClick={() => dialogRef.current?.showModal()}>
        Visualizar
      </button>
      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.dialogTitle}>{name}</p>
        {viewer}
        {!rejecting ? (
          <div className={styles.dialogActions}>
            <button type="button" className={styles.dialogCancel} onClick={() => dialogRef.current?.close()}>Fechar</button>
            <form action={onDecide} style={{ display: "contents" }}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="aprovado" />
              <button type="submit" className={styles.approveButton}>Aprovar</button>
            </form>
            <button type="button" className={styles.rejectButton} onClick={() => setRejecting(true)}>Reprovar</button>
          </div>
        ) : (
          <form action={onDecide}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="recusado" />
            <label className={styles.dialogLabel} htmlFor={`reviewNote-${id}`}>Motivo da reprovação</label>
            <textarea id={`reviewNote-${id}`} name="reviewNote" className={styles.dialogTextarea} rows={3} required minLength={1} />
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogCancel} onClick={() => setRejecting(false)}>Voltar</button>
              <button type="submit" className={styles.dialogConfirm}>Confirmar reprovação</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
```

`RejectButton` **continua existindo, inalterado** — segue servindo os itens sem `viewer` (férias, ajustes, banco de horas), que mantêm o par "Aprovar"/"Recusar" solto na lista, sem diálogo. `ViewAndDecideButton` é um componente novo, só para itens com `viewer`; duplica a mesma UX de textarea-de-justificativa do `RejectButton` porque vive dentro de um diálogo diferente (o de visualização) — pequena duplicação aceita para não acoplar os dois fluxos.

### 4.3 O que cada `viewer` mostra

`apps/web/src/app/(app)/aprovacoes/page.tsx` monta o `viewer` de cada atestado/admissional pendente/histórico como um componente cliente próprio (busca a foto sob demanda, só quando o diálogo abre — mesmo princípio de `AtestadoPhotoButton`, nunca pré-carregar):

- **Atestado** (`AtestadoViewer`, novo componente): `dias`; se RH, também `cid`/`crm`/`medico` e um botão "Ver foto" (`getAtestadoPhoto`, reaproveitado de `documentos/actions.ts` — já existe); se gestor, nem o botão aparece (igual hoje, igual ao mobile).
- **Admissional** (`AdmissionDocumentViewer`, novo componente): `title` e um botão "Ver foto" (gestor **e** RH — nova action `getAdmissionDocumentPhoto` em `apps/web/src/app/(app)/documentos/actions.ts`, chamando `GET /documentos/admissionais/:id/photo`).

`apps/web/src/app/(app)/aprovacoes/actions.ts` (modificado) — nova função `decideAdmissionDocument`, mesmo padrão de `decideAtestado`:

```typescript
export async function decideAdmissionDocument(formData: FormData) {
  const { id, status, reviewNote } = readDecision(formData);
  await updateStatus(`/documentos/admissionais/${id}/status`, status, reviewNote);
}
```

### 4.4 `/documentos` também ganha "Ver foto" para admissionais

`apps/web/src/app/(app)/documentos/page.tsx`, `TeamView` (modificado) — a seção "Documentos admissionais" ganha um botão "Ver foto" por item, visível para gestor e RH (não só RH como o do atestado), usando a mesma `AdmissionDocumentPhotoButton` (novo componente, cópia de `AtestadoPhotoButton` apontando para a nova action). Isso é **navegação/consulta** (papel já estabelecido de `/documentos`) — a decisão em si (Aprovar/Reprovar) continua só em `/aprovacoes` (§1, decidido em conversa).

### 4.5 Relabel "Recusado" → "Reprovado"

`apps/web/src/app/(app)/documentos/page.tsx` (`STATUS_LABEL`) — troca `recusado: "Recusado"` para `recusado: "Reprovado"`. O valor interno do enum continua `"recusado"` (só o rótulo).

`apps/web/src/app/(app)/aprovacoes/history-section.tsx` é **compartilhado** por atestados/admissionais e por férias/ajustes/compensações — o pedido de renomear foi só sobre documentos, então **não** trocar a string literal `"Recusado"` ali direto (isso relabelaria férias/ajustes/compensações também, fora do pedido). Em vez disso, `HistorySection` ganha uma prop opcional `rejectedLabel` (default `"Recusado"`, preservando o comportamento atual pros outros três tipos):

```typescript
export function HistorySection({ title, emptyLabel, items, rejectedLabel = "Recusado" }: { ...; rejectedLabel?: string }) {
  ...
  {item.status === "aprovado" ? "Aprovado" : rejectedLabel}
  ...
}
```

`page.tsx` passa `rejectedLabel="Reprovado"` só nos grupos "Atestados" e "Documentos admissionais" do histórico.

### 4.6 Onboarding para o colaborador

`apps/web/src/app/(app)/onboarding/page.tsx` (modificado) — ganha um branch para `colaborador`, espelhando `apps/mobile/src/app/onboarding.tsx`: barra de progresso, lista de tarefas com toggle (`toggleTask`, endpoint já existe e já aceita qualquer role autenticada). A tarefa com `requiresUpload: true` renderiza um formulário embutido (título + foto, campos obrigatórios como no admissional) em vez do toggle; ao enviar, chama uma nova action `submitOnboardingTaskDocument` (`POST /onboarding/tarefas/:taskId/documento`) e marca a tarefa como concluída localmente (resposta 200 = sucesso). Mostra "Enviado" (não o status de aprovação — esse só aparece em Documentos, §1) uma vez que pelo menos um documento tenha sido enviado por essa tarefa.

`apps/web/src/lib/nav-sections.ts` (modificado):
- `NAV_SECTIONS`: `/onboarding` ganha `"colaborador"` em `roles` (hoje só `["gestor", "rh"]`) — necessário para a busca (Ctrl+K) encontrar a tela também para colaborador.
- `COLABORADOR_SIDEBAR`: novo item `{ href: "/onboarding", label: "Onboarding" }`, topo-nível (mesmo padrão de Banco de Horas/Férias/Documentos/Mural — não aninhado em nenhum grupo). Ícone já existe em `nav-icon.tsx` (`/onboarding`, já implementado no lote anterior).

## 5. Mobile (`apps/mobile`) — só a parte do colaborador

### 5.1 `apps/mobile/src/lib/documentos.ts` (modificado)

```typescript
export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Reprovado", // era "Recusado"
};
```

### 5.2 `apps/mobile/src/app/atestados-equipe.tsx` (modificado)

A condição que decide se mostra os botões Aprovar/Recusar checa hoje `atestado.status === "enviado"` — com o novo default `"em_analise"`, um atestado recém-criado nunca mais bateria nessa condição. Trocar para o mesmo critério robusto do §2 ("pendente = não decidido"):

```typescript
{!["aprovado", "recusado"].includes(atestado.status) ? (
  <View style={styles.actions}>...</View>
) : null}
```

### 5.3 `apps/mobile/src/lib/onboarding-api.ts` (modificado) e `apps/mobile/src/app/onboarding.tsx` (modificado)

Novo tipo de retorno de `fetchOnboardingTasks` já inclui `requiresUpload` (o objeto `Task` precisa desse campo — hoje só tem `id`/`title`/`description`; `icon` também já existe mas não está no tipo `Task` local do arquivo, checar). Nova função:

```typescript
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

`onboarding.tsx`: a tarefa com `requiresUpload: true` renderiza, em vez do `Pressable` de toggle, um formulário embutido (mesmos campos/UX de `AdmissionaisSection` em `apps/mobile/src/app/(tabs)/documentos.tsx` — título + `pickPhoto` + `readPhotoAsDataUrl`, foto obrigatória). Ao enviar com sucesso, adiciona `task.id` ao set `done` local (mesmo efeito visual de "concluída" que o toggle já dá às outras tarefas) — sem exigir um novo fetch de `fetchOnboardingTasks`.

## 6. Testes

### 6.1 API

- `notifications.service.spec.ts`: `sendDocumentSubmitted` (notifica todo gestor/rh ativo, ninguém mais; mensagem/tipo/link corretos) e `sendDocumentStatusChanged` (notifica só o dono, mensagem varia por aprovado/recusado).
- `atestados.service.spec.ts`: `create` dispara `sendDocumentSubmitted`; `updateStatus` dispara `sendDocumentStatusChanged` em vez do push direto de antes; `getPhoto` libera o próprio dono mesmo sem ser RH, continua bloqueando gestor.
- `documentos.service.spec.ts`: `createAdmissionDocument` dispara `sendDocumentSubmitted`; `updateAdmissionDocumentStatus` dispara `sendDocumentStatusChanged`; `getAdmissionDocumentPhoto` libera dono/gestor/rh, bloqueia terceiro; `listAllAdmissionDocuments`/`listAdmissionDocuments` não incluem `photoUri`.
- `onboarding.service.spec.ts`: `submitTaskDocument` rejeita tarefa sem `requiresUpload`; cria o documento admissional; marca `OnboardingProgress` via upsert (idempotente — chamar duas vezes não duplica nem falha).

### 6.2 Web (Playwright)

- `documentos.spec.ts`: submeter atestado/admissional com sucesso mostra "Documento enviado com sucesso!"; uma falha simulada da API mostra erro inline sem perder os campos preenchidos.
- `aprovacoes.spec.ts` (novo ou estendido): item de atestado/admissional pendente mostra só "Visualizar" (sem Aprovar/Recusar soltos na lista); abrir o diálogo mostra os dados completos + foto sob demanda; Aprovar decide via `PATCH .../status`; Reprovar exige o textarea preenchido; gestor não vê "Ver foto" de atestado mas vê de admissional; RH vê os dois.
- `onboarding.spec.ts` (novo): colaborador vê a checklist com progresso; a tarefa "Enviar documentos" mostra formulário de upload, não toggle; enviar marca a tarefa como concluída.

### 6.3 Mobile (Jest)

- `documentos.test.tsx`: rótulo "Reprovado" aparece para status `recusado`.
- Novo teste de `atestados-equipe` (se ainda não houver arquivo de teste — checar): um atestado com status `em_analise` mostra os botões Aprovar/Recusar (regressão que a mudança do §5.2 evita).
- Novo teste de `onboarding.tsx`: a tarefa flagada mostra o formulário de upload; enviar com sucesso marca a tarefa como concluída.

## 7. Global Constraints

- Nenhuma mudança na restrição de LGPD do atestado — CID/CRM/médico/foto continuam RH-only; a única abertura nova é o próprio dono poder ver a própria foto (§3.3).
- Documento admissional: foto visível a gestor **e** RH (decidido em conversa, §1) — diferente do atestado.
- Toda notificação nova segue o padrão já estabelecido: `createManyAndReturn`/`create` **awaited**, push sempre `void Promise.all(...)` ou `void this.expoPush.sendToUser(...)` — nunca aguardado.
- Nenhuma tela de gestor/RH nova no mobile — aprovação de admissionais é só web.
- `/aprovacoes` decide; `/documentos` consulta — nenhuma ação de aprovar/reprovar é duplicada em `/documentos`.
- Onboarding do colaborador não introduz um novo conceito de "status de tarefa" além do `completedTaskIds` que já existe — o upload só antecipa essa conclusão automaticamente para a tarefa flagada.

## 8. Fora de escopo

- Mudar a tarefa "Enviar documentos" para aceitar múltiplos tipos de documento com títulos pré-definidos (RG, CPF, comprovante...) em campos separados — o formulário embutido é genérico (um título livre + uma foto por envio), o colaborador pode enviar várias vezes pela mesma tarefa.
- Editar ou excluir um documento já enviado.
- Aprovação de admissionais no mobile para gestor/RH.
- Anexar mais de uma foto por documento.
- Notificar o gestor/RH responsável direto (hoje "gestor/rh" é todo mundo com esse role, sem recorte de time/departamento — mesmo alcance que `sendPontoPerdido` já usa).
