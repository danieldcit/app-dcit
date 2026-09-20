# Fiscal & Tributos 2026 — Fundação + Dashboard

**Status:** Proposto
**Sub-projeto:** 1 de 10 do módulo "Gestão Fiscal, Tributária e Pessoas — 2026" (ver §7 para o mapa completo dos demais)

## 1. Objetivo e escopo

Pedido do usuário (2026-09-20): construir o "Módulo do Gestor — Gestão Fiscal, Tributária e Pessoas 2026", a partir de um documento de especificação de 24 seções cobrindo dashboard, simulador de contratação, motor de regras tributárias, IA, PLR, comparador de cenários, relatório de Custo-Brasil, trilha de auditoria e RBAC por 5 perfis.

Esse documento descreve vários subsistemas independentes — não uma feature única. Decidido em conversa: tratar como decomposição em sub-projetos (§7), cada um com seu próprio ciclo spec → plano → implementação. Esta spec cobre **apenas o primeiro**: a fundação de acesso/navegação e um dashboard com indicadores reais (não inventados).

Decidido em conversa (perguntas de esclarecimento, 2026-09-20):
- **Uso real interno na DCIT** (não é uma demo de produto) — os números do dashboard precisam ser reais ou claramente marcados como "não configurado", nunca inventados ou hardcoded como se fossem lei.
- **Só o perfil `gestor`** tem acesso a este módulo por enquanto (nem `rh`, nem os outros 4 perfis do documento — RH Estratégico, Fiscal/Tributário, Financeiro/CFO, Administrador — ficam fora de escopo; ver §7, sub-projeto de RBAC futuro se necessário).
- **Escopo de dados: empresa toda.** Hoje não existe hierarquia de equipe no sistema — `gestor` já vê todos os colaboradores nas telas existentes (ex: `TimeEntriesService.listTeamToday` não filtra por gestor). O dashboard fiscal segue o mesmo alcance, sem inventar uma regra de hierarquia nova só para este módulo.
- **Parâmetros fiscais nascem vazios.** Em vez de chutar INSS patronal/RAT/FGTS da DCIT, esta fase constrói uma tela de configuração; o dashboard mostra um estado "não configurado" até alguém preencher com os números reais da empresa.

## 2. Modelo de dados (`apps/api/prisma/schema.prisma`)

### 2.1 `Employee.tipoContratacao` (campo novo)

```prisma
model Employee {
  // ...campos existentes...
  tipoContratacao String? // "CLT" | "PJ" | "terceirizado" — null = não classificado
}
```

Nasce `null` para todo mundo, inclusive linhas existentes — **não** força `"CLT"` como default. Hoje não há nenhum indicador no sistema de quem é PJ ou terceirizado; assumir CLT silenciosamente poderia classificar errado gente que já é PJ de verdade. O dashboard trata "não classificado" como um balde próprio (§3.1), não como CLT.

Migration: aditiva, `ALTER TABLE "Employee" ADD COLUMN "tipoContratacao" TEXT`.

`salarioMensal` (campo já existente) é reaproveitado como "valor mensal do contrato" também para `PJ`/`terceirizado`, não só salário CLT — não existe hoje um campo separado para valor de contrato PJ, e criar um duplicaria o mesmo dado. Só os encargos (INSS/RAT/FGTS, §3.1) são calculados exclusivamente sobre `CLT`; PJ/terceirizado entram no custo total pelo valor bruto de `salarioMensal`, sem encargos — reflete a diferença de modelo de contratação descrita no documento original (seção 5).

### 2.2 `FiscalParameters` (model novo, linha única)

```prisma
// Uma única linha (id fixo "default") com os parâmetros fiscais da empresa,
// usados no cálculo de encargos do dashboard. Nasce vazia — ver §1: o
// sistema não deve inventar uma alíquota. Cada campo carrega sua fonte
// legal e vigência para satisfazer o requisito de "a IA/sistema não deve
// inventar uma alíquota tributária" do documento original (seção 22).
model FiscalParameters {
  id                       String    @id @default("default")
  inssPatronalPercent      Float?
  ratPercent               Float?    // 1 | 2 | 3, conforme grau de risco da atividade
  fgtsPercent              Float?
  sujeitoDesoneracaoFolha  Boolean?
  fonteLegal               String?   // texto livre citando lei/norma e enquadramento
  vigenciaData             DateTime?
  updatedAt                DateTime  @updatedAt
  updatedByUserId          String?
}
```

Serviço sempre opera sobre o id fixo `"default"` (`findUnique`/`upsert`), sem endpoint de criação/listagem — é configuração singleton, não uma tabela de registros.

## 3. Backend (`apps/api/src/fiscal`, módulo novo)

### 3.1 `FiscalService`

```typescript
async getDashboard(filters: { team?: string; tipoContratacao?: string }) {
  const employees = await this.prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(filters.team ? { team: filters.team } : {}),
      ...(filters.tipoContratacao ? { tipoContratacao: filters.tipoContratacao } : {}),
    },
  });

  const headcountPorTipo = {
    CLT: employees.filter((e) => e.tipoContratacao === "CLT").length,
    PJ: employees.filter((e) => e.tipoContratacao === "PJ").length,
    terceirizado: employees.filter((e) => e.tipoContratacao === "terceirizado").length,
    naoClassificado: employees.filter((e) => e.tipoContratacao === null).length,
  };

  const custoBase = employees.reduce((sum, e) => sum + (e.salarioMensal ?? 0), 0);
  const semSalario = employees.filter((e) => e.salarioMensal === null).length;

  const benefícios = await this.prisma.benefitBalance.findMany({
    where: { userId: { in: employees.map((e) => e.userId) } },
  });
  const custoBeneficios = benefícios.reduce((sum, b) => sum + b.monthlyCredit, 0);

  const params = await this.prisma.fiscalParameters.findUnique({ where: { id: "default" } });
  const encargosConfigurados =
    params?.inssPatronalPercent != null && params?.ratPercent != null && params?.fgtsPercent != null;

  let encargos = null;
  if (encargosConfigurados) {
    const percentualTotal = params.inssPatronalPercent! + params.ratPercent! + params.fgtsPercent!;
    const custoCLT = employees
      .filter((e) => e.tipoContratacao === "CLT")
      .reduce((sum, e) => sum + (e.salarioMensal ?? 0), 0);
    encargos = custoCLT * (percentualTotal / 100);
  }

  const custoMensalTotal = custoBase + custoBeneficios + (encargos ?? 0);
  const headcountTotal = employees.length;

  return {
    headcountTotal,
    headcountPorTipo,
    custoBase,
    custoBeneficios,
    encargos,
    encargosConfigurados,
    custoMensalTotal,
    custoMedioPorColaborador: headcountTotal > 0 ? custoMensalTotal / headcountTotal : 0,
    colaboradoresSemSalario: semSalario,
  };
}
```

`getParametros()` / `updateParametros(input)` — leitura e upsert de `FiscalParameters` no id `"default"`, gravando `updatedAt` (automático) e `updatedByUserId` (do `req.user.sub`).

### 3.2 `FiscalController`

Mesmo padrão de guard usado em `PromotabilidadeController`/`ConvencoesController`:

```typescript
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get('dashboard')
  getDashboard(@Query('team') team?: string, @Query('tipoContratacao') tipoContratacao?: string) {
    return this.fiscal.getDashboard({ team, tipoContratacao });
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Get('parametros')
  getParametros() {
    return this.fiscal.getParametros();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor')
  @Post('parametros')
  async updateParametros(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = FiscalParametersInputSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.fiscal.updateParametros(result.data, req.user.sub);
  }
}
```

### 3.3 `packages/shared-types/src/fiscal-parameters.ts` (novo)

Mesmo idioma de `ConvencaoInputSchema` (campos numéricos via `z.coerce`, pois chegam de formulário):

```typescript
import { z } from "zod";

export const FiscalParametersInputSchema = z.object({
  inssPatronalPercent: z.coerce.number().nonnegative().nullable(),
  ratPercent: z.coerce.number().min(1).max(3).nullable(),
  fgtsPercent: z.coerce.number().nonnegative().nullable(),
  // Booleano de verdade, não z.coerce.boolean() — esse coage QUALQUER string
  // não-vazia (inclusive "false") para true. O server action (§4.3) converte
  // o checkbox (`formData.get(...) === "on"`) para um boolean real antes de
  // enviar o JSON, então a API sempre recebe true/false/null.
  sujeitoDesoneracaoFolha: z.boolean().nullable(),
  fonteLegal: z.string().min(1).nullable(),
  vigenciaData: z.coerce.date().nullable(),
});
export type FiscalParametersInput = z.infer<typeof FiscalParametersInputSchema>;
```

### 3.4 `Employee` — endpoint de classificação

Cada `PATCH` em `EmployeesController` já é estreito e dedicado a uma preocupação (`:userId/personal-data`, `:userId/restore`, o `:userId` genérico é na real só schedule via `EmployeeScheduleUpdateSchema`) — não um update genérico. Seguindo o mesmo idioma, `tipoContratacao` ganha seu próprio endpoint:

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('gestor')
@Patch(':userId/tipo-contratacao')
async updateTipoContratacao(@Param('userId') userId: string, @Body() body: unknown) {
  const result = TipoContratacaoUpdateSchema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return this.employees.updateTipoContratacao(userId, result.data.tipoContratacao);
}
```

`TipoContratacaoUpdateSchema` (novo, `packages/shared-types/src/tipo-contratacao.ts`): `z.object({ tipoContratacao: z.enum(["CLT", "PJ", "terceirizado"]).nullable() })`.

## 4. Frontend web (`apps/web`)

### 4.1 Navegação (`apps/web/src/lib/nav-sections.ts`)

```typescript
export const GESTOR_FISCAL_LINK: SidebarLink = {
  href: "/fiscal-tributos",
  label: "Fiscal & Tributos 2026",
};
```

Adicionado a `NAV_SECTIONS` como `roles: ["gestor"]` (mesmo padrão de `GESTOR_CAREER_LINK`/`/gestao-carreiras` — gestor-only, não compartilhado com `rh`).

### 4.2 `/fiscal-tributos/page.tsx` (novo)

Segue exatamente o padrão de `gestao-carreiras/page.tsx`: guarda de sessão + `EmptyState`, busca via `apiFetchJson`, renderiza cards.

```typescript
export default async function FiscalTributosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session || session.role !== "gestor") {
    return <EmptyState title="Sem permissão" description="Esta área é exclusiva para gestores." />;
  }
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.team === "string") query.set("team", params.team);
  if (typeof params.tipoContratacao === "string") query.set("tipoContratacao", params.tipoContratacao);

  const dashboard = await apiFetchJson<FiscalDashboard>(`/fiscal/dashboard?${query}`);
  return <FiscalDashboardView dashboard={dashboard} />;
}
```

Cards do `FiscalDashboardView`:
- **Headcount** — total + breakdown CLT/PJ/terceirizado/não classificado.
- **Custo mensal da equipe** — salários + benefícios + encargos (se configurados); mostra aviso se `colaboradoresSemSalario > 0`.
- **Custo médio por colaborador**.
- **Impacto tributário estimado** — se `encargosConfigurados === false`, renderiza um `EmptyState`-like card: "Configure os parâmetros fiscais para ver o impacto tributário estimado" com link para `/fiscal-tributos/parametros`, em vez de mostrar R$ 0 ou qualquer número.

Filtros (`team`, `tipoContratacao`) como `<form method="get">` nativo (sem JS) — os `<select>` submetem a própria página com `?team=...&tipoContratacao=...`, lidos em `searchParams` no Server Component acima. `team` popula as opções a partir dos valores distintos já presentes em `Employee.team`; `tipoContratacao` é a lista fixa `["CLT", "PJ", "terceirizado"]` mais "Não classificado".

### 4.3 `/fiscal-tributos/parametros/page.tsx` + `actions.ts` (novo)

Mesmo padrão de `convencoes/page.tsx` + `actions.ts` (server action de formulário): um único formulário (não uma lista com diálogos, já que é um registro singleton) com os campos de `FiscalParametersInputSchema`, cada um com um texto de ajuda citando o que a lei diz (ex: "INSS patronal: em geral 20% sobre a folha — confirme com o contador da empresa"), reforçando que são valores a confirmar, não um chute do sistema.

## 5. Testes

### 5.1 API (TDD)

`fiscal.service.spec.ts`:
- `getDashboard` sem `FiscalParameters` configurado → `encargosConfigurados: false`, `encargos: null`, `custoMensalTotal` não inclui encargos.
- `getDashboard` com os 3 parâmetros configurados → `encargos` calculado só sobre a soma dos `salarioMensal` de `tipoContratacao === "CLT"`.
- Headcount agrupado corretamente incluindo o balde `naoClassificado` (colaboradores com `tipoContratacao: null`).
- Filtro por `team` e por `tipoContratacao` restringe a base antes de agregar.
- Colaborador com `salarioMensal: null` não quebra a soma (tratado como 0) e é contado em `colaboradoresSemSalario`.

`fiscal.controller.spec.ts` (ou verificação de guard): `@Roles('gestor')` bloqueia `rh`/`colaborador` nas duas rotas.

### 5.2 Web (Playwright)

Novo `fiscal-tributos.spec.ts`:
- `gestor` acessa `/fiscal-tributos`, vê o card de impacto tributário no estado "não configurado" com link para configurar.
- Preenche `/fiscal-tributos/parametros` e salva; volta ao dashboard e vê o card de impacto tributário com valores calculados.
- `rh`/`colaborador` acessando `/fiscal-tributos` veem o `EmptyState` de "Sem permissão".

## 6. Global Constraints

- Nenhuma alíquota é hardcoded no código como se fosse lei — `FiscalParameters` é sempre a única fonte, e nasce vazio.
- `gestor` é o único perfil com acesso neste sub-projeto; `rh` e os demais perfis do documento original ficam fora de escopo (podem entrar em um sub-projeto futuro de RBAC, §7).
- Escopo de dados é a empresa toda — não há filtro de hierarquia de time, consistente com o resto do app hoje.
- Indicadores fora do que já é derivável dos dados existentes (orçamento, comparação com budget, alertas, PLR, simulação) ficam fora desta fase — ver §7.

## 7. Fora de escopo (mapa dos próximos sub-projetos)

1. **Este sub-projeto** — Fundação + Dashboard.
2. Parametrização fiscal avançada (por UF/atividade/regime) + motor de cálculo completo.
3. Simulador de Contratação (CLT × PJ × Terceirização).
4. Comparador de Cenários.
5. Motor de Alertas Fiscais (desoneração da folha, Reforma Tributária, indicadores de risco de vínculo PJ).
6. Projeção Orçamentária.
7. Gestão de PLR.
8. Relatório de Custo-Brasil.
9. Trilha de Auditoria (histórico de alterações com usuário/data/valor anterior/justificativa).
10. Motor de IA / recomendações.

Também fora de escopo desta fase: os 4 perfis adicionais do documento (RH Estratégico, Fiscal/Tributário, Financeiro/CFO, Administrador) e qualquer hierarquia real de equipe (o app não tem isso hoje para nenhuma tela).
