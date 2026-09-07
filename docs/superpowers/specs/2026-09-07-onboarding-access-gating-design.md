# Bloqueio de Acesso Inicial (Onboarding Gating)

**Status:** Proposto
**Specs relacionadas:** [`2026-09-05-document-review-onboarding-upload-design.md`](2026-09-05-document-review-onboarding-upload-design.md) (onboarding do colaborador, upload embutido, status de documentos — base sobre a qual esta spec constrói)

## 1. Objetivo e escopo

Pedido do usuário (2026-09-07), com uma sessão anterior já tendo implementado: assinatura de contrato, checklist de acessos, e um botão manual "Liberar acesso total ao SGP Portal" (só habilitava depois de completar as 5 etapas). O pedido de hoje muda o modelo:

1. **Todo colaborador novo nasce restrito** — só enxerga a tela de Onboarding; qualquer outra rota do SGP (ponto, férias, folha, etc.) fica bloqueada, e a sidebar só mostra o item Onboarding.
2. **A conclusão das 5 etapas libera sozinha** — sem precisar de clique de ninguém. O sistema mostra um modal de parabéns e libera o dashboard completo na mesma sessão (sem novo login).
3. **O botão do RH vira uma exceção** — antes só habilitava depois de completo (redundante com o auto-liberar); agora fica sempre clicável, para o RH liberar alguém que **ainda não terminou** o onboarding.
4. **A origem da liberação aparece pro RH** — "liberado automaticamente" vs "liberado manualmente por {nome}".

Decidido em conversa (perguntas de esclarecimento, 2026-09-07):
- Bloqueio só na camada web (esconder sidebar + redirecionar) — **sem** guard novo na API. Mesmo nível de proteção que o app já usa hoje para todo controle de acesso por papel (nenhuma rota da API tem enforcement além do role colaborador/gestor/rh).
- Restrito enxerga **só** Onboarding na sidebar (não Mural, não Notificações).
- Escopo: só o papel `colaborador` é restringível. `gestor`/`rh` nunca passam por este gate, mesmo que tenham linhas de onboarding no seed de dev (resquício de dados de teste, não uma regra de negócio).

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

```prisma
model OnboardingAccessGrant {
  id            String   @id @default(uuid())
  userId        String   @unique
  grantedAt     DateTime @default(now())
  source        String   @default("auto") // "auto" | "manual"
  grantedByName String?  // preenchido só quando source = "manual"
}
```

Migration: nova pasta em `apps/api/prisma/migrations/`, `ALTER TABLE "OnboardingAccessGrant" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'auto'; ADD COLUMN "grantedByName" TEXT;` — aditivo, sem backfill necessário (linhas existentes, todas criadas pelo botão manual antes desta mudança, ficariam com `source = 'auto'` por causa do default; como isso é dev data, não é um problema real, mas vale rodar um `updateMany` pontual pra corrigir se já houver alguma linha em `dev.db`/`test.db`).

## 3. Backend (`apps/api`)

### 3.1 `OnboardingService` (modificado, `apps/api/src/onboarding/onboarding.service.ts`)

`grantFullAccess` (modificado) — remove a checagem "só depois de completo" (linhas 89-93 hoje). Passa a aceitar o nome de quem libera:

```typescript
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

`checkAutoUnlock` (novo, chamado depois de qualquer mutação que possa completar a trilha):

```typescript
async checkAutoUnlock(userId: string): Promise<void> {
  const { tasks, completedTaskIds } = await this.getTasks(userId);
  if (tasks.length === 0 || completedTaskIds.length < tasks.length) return;

  const existing = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
  if (existing) return;

  await this.prisma.onboardingAccessGrant.create({ data: { userId, source: 'auto' } });
  await this.notifications.sendFullAccessGranted(userId);
}
```

Chamado a partir de:
- `toggleTask` (depois do `create` de `OnboardingProgress`, dentro do `if (task) { ... }`)
- `toggleAccessItem` (depois do `create` de `OnboardingAccessItem`)
- `DocumentosService.createAdmissionDocument` (§3.2)
- `DocumentosService.submitSignedContract` (§3.2)

`isUnlocked` (novo, endpoint leve pro middleware — ver §4.1):

```typescript
async isUnlocked(userId: string): Promise<boolean> {
  const grant = await this.prisma.onboardingAccessGrant.findUnique({ where: { userId } });
  if (grant) return true;
  const { tasks, completedTaskIds } = await this.getTasks(userId);
  return tasks.length > 0 && completedTaskIds.length === tasks.length;
}
```

Checa os dois sinais (grant OU trilha completa) em vez de confiar só na existência da linha — mesmo espírito defensivo de `mergeDerivedCompletion` já tratar conclusão como fato derivado, não só estado gravado.

`getTasks` (modificado) — passa a incluir `fullAccessGrantedAt` (hoje só `listTeamProgress` tem isso), pro próprio colaborador saber seu status sem uma segunda chamada:

```typescript
async getTasks(userId: string) {
  const [tasks, progress, admissionDocuments, accessItems, grant] = await Promise.all([
    // ...os quatro já existentes...
    this.prisma.onboardingAccessGrant.findUnique({ where: { userId } }),
  ]);
  // ...
  return {
    tasks,
    completedTaskIds: this.mergeDerivedCompletion(/* ...igual hoje... */),
    completedAccessItems,
    fullAccessGrantedAt: grant?.grantedAt ?? null,
  };
}
```

`listTeamProgress` (modificado) — expõe `fullAccessGrantSource`/`fullAccessGrantedByName` junto do `fullAccessGrantedAt` que já existe, buscando o registro completo em vez de só `grantedAt`:

```typescript
const grantedByUser = new Map(accessGrants.map((g) => [g.userId, g]));
// ...
return {
  // ...campos já existentes...
  fullAccessGrantedAt: grantedByUser.get(employee.userId)?.grantedAt ?? null,
  fullAccessGrantSource: grantedByUser.get(employee.userId)?.source ?? null,
  fullAccessGrantedByName: grantedByUser.get(employee.userId)?.grantedByName ?? null,
};
```

### 3.2 `OnboardingController` (modificado)

`grantFullAccess` passa o nome de quem libera:

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('gestor', 'rh')
@Post('equipe/:userId/liberar-acesso')
@HttpCode(200)
grantFullAccess(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
  return this.onboarding.grantFullAccess(userId, req.user.name);
}
```

Novo endpoint, usado pelo middleware web (§4.1) — sem `RolesGuard`, qualquer usuário autenticado consulta o próprio status:

```typescript
@UseGuards(AuthGuard)
@Get('meu-status')
async myStatus(@Req() req: AuthenticatedRequest) {
  const unlocked = await this.onboarding.isUnlocked(req.user.sub);
  return { unlocked };
}
```

Colaboradores restritos continuam podendo chamar `GET /onboarding/tarefas`, `POST /onboarding/tarefas/:id/toggle` e `POST /onboarding/acessos/:item/toggle` normalmente — nenhuma dessas rotas ganha um guard novo (decidido em conversa, §1: bloqueio só na camada web).

### 3.3 `DocumentosService` (modificado, `apps/api/src/documentos/documentos.service.ts`)

Injeta `OnboardingService`:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly push: ExpoPushService,
  private readonly notifications: NotificationsService,
  private readonly onboarding: OnboardingService,
) {}
```

`createAdmissionDocument` e `submitSignedContract` (modificados) — chamam `checkAutoUnlock` depois de gravar:

```typescript
async createAdmissionDocument(userId: string, userName: string, input: AdmissionDocumentInput) {
  const document = await this.prisma.admissionDocument.upsert({ /* ...já existe... */ });
  await this.notifications.sendDocumentSubmitted('admissional', userId, userName);
  await this.onboarding.checkAutoUnlock(userId);
  return document;
}

async submitSignedContract(userId: string, userName: string, fileDataUrl: string) {
  const contract = await this.prisma.signedContract.upsert({ /* ...já existe... */ });
  await this.notifications.sendDocumentSubmitted('contrato', userId, userName);
  await this.onboarding.checkAutoUnlock(userId);
  return { submittedAt: contract.submittedAt };
}
```

`DocumentosModule` (modificado) — importa `OnboardingModule`; `OnboardingModule` (modificado) — adiciona `exports: [OnboardingService]` (hoje não exporta nada). Sem risco de dependência circular: `OnboardingModule` nunca importa `DocumentosModule`.

### 3.4 `NotificationsService` — sem mudanças

`sendFullAccessGranted` já existe e serve os dois caminhos (auto e manual) com a mesma mensagem — não há pedido para diferenciar o texto da notificação em si, só a exibição na tela do RH (§4.3).

## 4. Frontend web (`apps/web`)

### 4.1 `apps/web/src/middleware.ts` (novo)

Único ponto de bloqueio por caminho. Não existe `middleware.ts` hoje neste projeto — cada página faz sua própria checagem de papel inline (`getSession()` + `EmptyState`, replicado em 15+ arquivos); esse padrão não serve aqui porque um Server Component de layout não tem acesso ao pathname da requisição, e a regra precisa valer para *toda* rota exceto uma.

`apps/web/src/lib/session.ts` starts with `import "server-only"` — that guards against the module (and its `cookies()`/`redirect()` calls) being pulled into a client bundle, but middleware is a separate build target from both "server" (RSC) and "client," so importing from a `server-only`-marked module here is untested territory in this codebase. To avoid depending on that working, the cookie name is duplicated as a literal instead of imported:

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
  if (!token) return NextResponse.next(); // sem sessão: layout.tsx cuida do redirect pro /login

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

  const res = await fetch(`${API_URL}/onboarding/meu-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { unlocked } = res.ok ? await res.json() : { unlocked: true }; // API fora do ar: não trava o app inteiro

  if (!unlocked) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|documents|sgp-icon.png).*)"],
};
```

Pontos a validar na implementação (não bloqueiam o design, mas precisam de teste manual):
- Decodificação do payload usa `atob` em vez do `Buffer.from(...).toString()` de `session.ts` porque o runtime padrão do middleware não garante a API `Buffer` do Node — se o projeto já roda middleware com `export const runtime = "nodejs"` em algum lugar, pode-se reusar a mesma decodificação de `session.ts` diretamente.
- Uma falha/timeout na chamada à API não deve travar o app inteiro (`unlocked: true` como fallback otimista, acima) — falha aberta, não fechada; aceitável para um app interno de porte pequeno.
- O matcher exclui `/documents/*` (o PDF modelo de contrato, estático) e `/sgp-icon.png` além dos already-padrão do Next.

### 4.2 Sidebar restrita (`apps/web/src/components/`, `apps/web/src/lib/nav-sections.ts`)

`apps/web/src/app/(app)/layout.tsx` (modificado) — busca o mesmo `unlocked` que o middleware calculou (chamada duplicada e aceitável, dado o tamanho do app; ver nota de otimização abaixo) e passa pro `AppShell`:

```typescript
const unlocked = user.role !== "colaborador" || (await apiFetchJson<{ unlocked: boolean }>("/onboarding/meu-status")).unlocked;
return (
  <AppShell user={user} notifications={notifications} restricted={!unlocked}>
    {children}
  </AppShell>
);
```

`AppShell`/`SidebarShell`/`NavLinks` (modificados) — recebem `restricted?: boolean`, propagado até `NavLinks`. Quando `restricted` é `true`, `NavLinks` ignora `COLABORADOR_SIDEBAR` e renderiza só o item Onboarding:

```typescript
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
```

Sino de notificações e menu do usuário (`AppShell`, topbar) continuam visíveis mesmo restrito — só a sidebar muda (decidido em conversa, §1).

**Otimização futura (fora de escopo agora):** middleware poderia gravar o resultado num header de request (`NextResponse.next({ request: { headers } })`) e o layout ler via `headers()` em vez de chamar a API de novo — evita a chamada duplicada por request. Não fazer agora para manter o primeiro corte simples; revisitar se a latência incomodar.

### 4.3 Botão do RH vira exceção (`apps/web/src/app/(app)/onboarding/onboarding-row.tsx`)

`disabled` (modificado) — remove a exigência de trilha completa; só desabilita se já tem grant ou está no meio de uma chamada:

```typescript
disabled={granting || Boolean(entry.fullAccessGrantedAt)}
```

Como a auto-liberação já cobre o caminho "completou tudo", o botão só é clicável de fato enquanto a trilha está incompleta — então **todo clique é uma exceção**, e passa a exigir confirmação (mesmo padrão de diálogo de confirmação já usado em `HoleritesRow`/exclusão de colaborador):

```typescript
<button type="button" className={styles.grantAccessButton} disabled={/* ... */} onClick={() => confirmDialogRef.current?.showModal()}>
  {renderGrantLabel(entry)}
</button>
<dialog ref={confirmDialogRef} className={styles.dialog}>
  <p className={styles.dialogTitle}>Liberar acesso total ao SGP Portal para {entry.userName}?</p>
  <p className={styles.subheading}>
    {entry.userName} ainda não completou o onboarding ({entry.completedCount} de {entry.totalCount}).
    Essa é uma exceção manual — o colaborador ganha acesso completo ao portal mesmo assim.
  </p>
  <div className={styles.dialogActions}>
    <button type="button" onClick={() => confirmDialogRef.current?.close()}>Cancelar</button>
    <button type="button" onClick={handleGrantFullAccess}>Confirmar liberação</button>
  </div>
</dialog>
```

`renderGrantLabel` (novo helper) — mostra a origem:

```typescript
function renderGrantLabel(entry: TeamProgress): string {
  if (!entry.fullAccessGrantedAt) return "Liberar acesso total ao SGP Portal";
  if (entry.fullAccessGrantSource === "manual") return `Liberado manualmente por ${entry.fullAccessGrantedByName}`;
  return "Acesso liberado automaticamente";
}
```

`TeamProgress` (tipo, em `page.tsx` e `onboarding-row.tsx`) ganha `fullAccessGrantSource: string | null` e `fullAccessGrantedByName: string | null`.

### 4.4 Modal de parabéns (`apps/web/src/app/(app)/onboarding/colaborador-onboarding.tsx`)

`ColaboradorOnboarding` (modificado) — recebe `fullAccessGrantedAt: string | null` como prop nova (vindo de `getTasks`, §3.1). Detecta a transição *null → valor* causada pela própria ação do colaborador (não no primeiro carregamento, quando já vinha liberado) via `useRef` guardando o valor anterior:

```typescript
const previousGrantedAt = useRef(fullAccessGrantedAt);
const [showCongrats, setShowCongrats] = useState(false);
const congratsDialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (!previousGrantedAt.current && fullAccessGrantedAt) {
    setShowCongrats(true);
  }
  previousGrantedAt.current = fullAccessGrantedAt;
}, [fullAccessGrantedAt]);

useEffect(() => {
  if (showCongrats) congratsDialogRef.current?.showModal();
}, [showCongrats]);
```

Modal (novo, no fim do JSX):

```tsx
<dialog ref={congratsDialogRef} className={styles.dialog}>
  <p className={styles.dialogTitle}>🎉 Parabéns! Onboarding concluído</p>
  <p className={styles.itemDetail}>Seu acesso total ao SGP Portal foi liberado.</p>
  <div className={styles.dialogActions}>
    <a href="/" className={styles.grantAccessButton} onClick={() => congratsDialogRef.current?.close()}>
      Ir para o Dashboard
    </a>
  </div>
</dialog>
```

O link usa `<a href="/">` (navegação completa), não `<Link>` — força uma requisição nova, que passa pelo middleware já liberado e recebe a sidebar completa de primeira. Um `router.push("/")` também funcionaria (o middleware roda em toda navegação, inclusive client-side), mas `<a>` é mais simples e não exige importar `useRouter` só para este botão.

## 5. Testes

### 5.1 API

- `onboarding.service.spec.ts`: `checkAutoUnlock` cria o grant com `source: 'auto'` e notifica quando a trilha acaba de completar; não faz nada se já existe grant; não faz nada se a trilha ainda está incompleta. `grantFullAccess` agora libera com trilha incompleta (`source: 'manual'`, `grantedByName` preenchido); idempotente (chamar de novo não sobrescreve pra `manual` se já era `auto`, e vice-versa). `isUnlocked` cobre os dois sinais (grant existente, trilha completa sem grant ainda criado — não deveria acontecer em produção já que `checkAutoUnlock` roda em todo ponto de mutação, mas o método não deve *depender* disso).
- `onboarding.controller.spec.ts`: `myStatus` sem `RolesGuard`, devolve `{ unlocked }` pro usuário autenticado; `grantFullAccess` passa `req.user.name`.
- `documentos.service.spec.ts`: `createAdmissionDocument` e `submitSignedContract` chamam `checkAutoUnlock` (mock do `OnboardingService`, verificar chamada — não precisa reimplementar a lógica de conclusão aqui, já coberta em `onboarding.service.spec.ts`).

### 5.2 Web (Playwright)

- Novo `onboarding-gating.spec.ts`: colaborador restrito acessando `/` (ou qualquer rota) é redirecionado pra `/onboarding`; sidebar mostra só "Onboarding"; colaborador liberado acessa `/` normalmente com sidebar completa.
- `onboarding.spec.ts` (estendido): completar a última etapa mostra o modal de parabéns; o modal não aparece de novo num carregamento subsequente já liberado.
- `onboarding.spec.ts`, visão gestor/rh (estendido): botão "Liberar acesso total ao SGP Portal" agora clicável mesmo com trilha incompleta, abre diálogo de confirmação; depois de confirmar, mostra "Liberado manualmente por {nome}"; depois de auto-liberado (trilha completa sem clique), mostra "Acesso liberado automaticamente".

## 6. Global Constraints

- Bloqueio só na camada web — nenhum guard novo na API além do `myStatus` de leitura. Alguém com um token válido de colaborador ainda consegue chamar qualquer endpoint da API diretamente, igual hoje para qualquer outra regra de negócio deste app (nenhuma delas tem enforcement na API além de role).
- Só `colaborador` passa pelo gate — `gestor`/`rh` nunca são restringidos, independentemente do próprio progresso de onboarding.
- O botão manual do RH nunca fica desabilitado por "já está tudo pronto" — ele reflete `!!fullAccessGrantedAt`, então uma vez liberado (por qualquer via) ele desaparece como ação, sobrando só o rótulo de status.
- Falha ao consultar `/onboarding/meu-status` no middleware nunca deve travar a navegação inteira do app — fail-open (`unlocked: true`).

## 7. Fora de escopo

- Guard de autorização na API baseado em onboarding (bloqueio fica só na camada web, decidido em conversa).
- Revogar um acesso já liberado (nem automático nem manual) — não existe "desliberar".
- Otimização para evitar a chamada duplicada middleware+layout (§4.2, nota de otimização futura).
- Qualquer mudança de UI no módulo de envio de documentos em si (4 estados visuais, upload) — já implementado na spec de 2026-09-05, sem mudanças aqui.
- Bloquear rotas do app mobile por status de onboarding — pedido é explicitamente sobre o SGP (web).
