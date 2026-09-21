import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalParametersInput } from '@ponto-dcit/shared-types';

type DashboardFilters = { team?: string; tipoContratacao?: string };

const TIPOS_CONTRATACAO = ['CLT', 'PJ', 'terceirizado'] as const;

function firstOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(filters: DashboardFilters) {
    const [core, { historico, historicoCombinacaoNaoSuportada }] = await Promise.all([
      this.computeDashboardCore(filters),
      this.getHistorico(filters),
    ]);

    const currentMonthStart = firstOfMonthUTC(new Date());
    const anterior = historico.filter((h) => h.month.getTime() < currentMonthStart.getTime()).at(-1) ?? null;

    const variacaoCustoMensalPercent =
      anterior && anterior.custoMensalTotal > 0
        ? ((core.custoMensalTotal - anterior.custoMensalTotal) / anterior.custoMensalTotal) * 100
        : null;

    const custoMedioAnterior =
      anterior && anterior.headcountTotal > 0 ? anterior.custoMensalTotal / anterior.headcountTotal : null;
    const variacaoCustoMedioPercent =
      custoMedioAnterior && custoMedioAnterior > 0
        ? ((core.custoMedioPorColaborador - custoMedioAnterior) / custoMedioAnterior) * 100
        : null;

    return {
      ...core,
      historico,
      historicoCombinacaoNaoSuportada,
      variacaoCustoMensalPercent,
      variacaoCustoMedioPercent,
    };
  }

  private async computeDashboardCore(filters: DashboardFilters) {
    const employees = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...(filters.team ? { team: filters.team } : {}),
        ...(filters.tipoContratacao ? { tipoContratacao: filters.tipoContratacao } : {}),
      },
      select: { userId: true, name: true, tipoContratacao: true, salarioMensal: true },
    });

    const headcountPorTipo = {
      CLT: employees.filter((e) => e.tipoContratacao === 'CLT').length,
      PJ: employees.filter((e) => e.tipoContratacao === 'PJ').length,
      terceirizado: employees.filter((e) => e.tipoContratacao === 'terceirizado').length,
      naoClassificado: employees.filter((e) => e.tipoContratacao === null).length,
    };

    const custoBase = employees.reduce((sum, e) => sum + (e.salarioMensal ?? 0), 0);
    const colaboradoresSemSalario = employees.filter((e) => e.salarioMensal === null).length;

    const beneficios = employees.length
      ? await this.prisma.benefitBalance.findMany({
          where: { userId: { in: employees.map((e) => e.userId) } },
        })
      : [];
    const custoBeneficios = beneficios.reduce((sum, b) => sum + b.monthlyCredit, 0);
    const beneficiosPorColaborador = new Map<string, number>();
    for (const b of beneficios) {
      beneficiosPorColaborador.set(b.userId, (beneficiosPorColaborador.get(b.userId) ?? 0) + b.monthlyCredit);
    }

    const params = await this.prisma.fiscalParameters.findUnique({ where: { id: 'default' } });
    const encargosConfigurados =
      params?.inssPatronalPercent != null && params?.ratPercent != null && params?.fgtsPercent != null;

    const folhaCLTConsiderada = employees
      .filter((e) => e.tipoContratacao === 'CLT')
      .reduce((sum, e) => sum + (e.salarioMensal ?? 0), 0);

    let encargos: number | null = null;
    let encargosPercentual: number | null = null;
    let encargosBreakdown: {
      inssPatronal: number;
      rat: number;
      terceiros: number;
      fgts: number;
      total: number;
    } | null = null;
    let encargosPercentuais: {
      inssPatronal: number;
      rat: number;
      terceiros: number;
      fgts: number;
    } | null = null;
    if (encargosConfigurados) {
      encargosPercentuais = {
        inssPatronal: params!.inssPatronalPercent!,
        rat: params!.ratPercent!,
        terceiros: params!.terceirosPercent ?? 0,
        fgts: params!.fgtsPercent!,
      };
      const inssPatronal = folhaCLTConsiderada * (encargosPercentuais.inssPatronal / 100);
      const rat = folhaCLTConsiderada * (encargosPercentuais.rat / 100);
      const terceiros = folhaCLTConsiderada * (encargosPercentuais.terceiros / 100);
      const fgts = folhaCLTConsiderada * (encargosPercentuais.fgts / 100);
      encargosPercentual =
        encargosPercentuais.inssPatronal + encargosPercentuais.rat + encargosPercentuais.terceiros + encargosPercentuais.fgts;
      encargos = inssPatronal + rat + terceiros + fgts;
      encargosBreakdown = { inssPatronal, rat, terceiros, fgts, total: encargos };
    }

    const custoMensalTotal = custoBase + custoBeneficios + (encargos ?? 0);
    const headcountTotal = employees.length;
    const headcountComSalario = headcountTotal - colaboradoresSemSalario;

    const naoClassificados = employees
      .filter((e) => e.tipoContratacao === null)
      .map((e) => ({ userId: e.userId, name: e.name }));

    const semSalario = employees
      .filter((e) => e.salarioMensal === null)
      .map((e) => ({ userId: e.userId, name: e.name }));

    const cltComSalario = employees.filter((e) => e.tipoContratacao === 'CLT' && e.salarioMensal !== null).length;

    const custosPorColaborador = employees.map((e) => {
      const salario = e.salarioMensal ?? 0;
      // salarioMensal === null é "desconhecido", não "zero" — sem isso, essa
      // pessoa entraria no Raio-X/tabela com um breakdown todo zerado em vez
      // de N/D, escondendo que o dado está faltando.
      const elegivelEncargos = e.tipoContratacao === 'CLT' && encargosConfigurados && e.salarioMensal !== null;
      const encargosPessoaBreakdown = elegivelEncargos
        ? {
            inssPatronal: salario * (params!.inssPatronalPercent! / 100),
            rat: salario * (params!.ratPercent! / 100),
            terceiros: salario * ((params!.terceirosPercent ?? 0) / 100),
            fgts: salario * (params!.fgtsPercent! / 100),
            total: salario * (encargosPercentual! / 100),
          }
        : null;
      const beneficiosPessoa = beneficiosPorColaborador.get(e.userId) ?? 0;
      return {
        userId: e.userId,
        name: e.name,
        tipoContratacao: e.tipoContratacao,
        salarioMensal: e.salarioMensal,
        encargos: encargosPessoaBreakdown?.total ?? null,
        encargosBreakdown: encargosPessoaBreakdown,
        beneficios: beneficiosPessoa,
        custoTotal: salario + (encargosPessoaBreakdown?.total ?? 0) + beneficiosPessoa,
      };
    });

    return {
      headcountTotal,
      headcountPorTipo,
      custoBase,
      custoBeneficios,
      encargos,
      encargosConfigurados,
      encargosPercentual,
      encargosBreakdown,
      encargosPercentuais,
      folhaCLTConsiderada,
      cltComSalario,
      custosPorColaborador,
      custoMensalTotal,
      custoMedioPorColaborador: headcountTotal > 0 ? custoMensalTotal / headcountTotal : 0,
      custoMedioComDadosCompletos: headcountComSalario > 0 ? custoMensalTotal / headcountComSalario : null,
      colaboradoresSemSalario,
      naoClassificados,
      semSalario,
      parametrosAtualizadoEm: params?.updatedAt ?? null,
      parametrosVigenciaData: params?.vigenciaData ?? null,
    };
  }

  async getHistorico(filters: DashboardFilters): Promise<{
    historico: { month: Date; custoMensalTotal: number; headcountTotal: number }[];
    historicoCombinacaoNaoSuportada: boolean;
  }> {
    if (filters.team && filters.tipoContratacao) {
      return { historico: [], historicoCombinacaoNaoSuportada: true };
    }

    const where = filters.team
      ? { team: filters.team, tipoContratacao: '' }
      : filters.tipoContratacao
        ? { team: '', tipoContratacao: filters.tipoContratacao }
        : { team: '', tipoContratacao: '' };

    const rows = await this.prisma.fiscalCostSnapshot.findMany({
      where,
      orderBy: { month: 'desc' },
      take: 12,
      select: { month: true, custoMensalTotal: true, headcountTotal: true },
    });

    return { historico: rows.reverse(), historicoCombinacaoNaoSuportada: false };
  }

  // 05:00 América/São_Paulo, todo dia 1 do mês — depois que os cadastros de
  // salário/benefícios do mês corrente já devem estar estáveis. Sem
  // backfill: a série só começa a existir a partir do primeiro mês em que
  // este job rodou (ver design spec).
  @Cron('0 5 1 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlySnapshot(): Promise<void> {
    // Best-effort: uma falha aqui nunca pode travar o agendador nem afetar
    // o restante da API.
    try {
      await this.captureSnapshot(new Date());
    } catch (error) {
      this.logger.warn(`Failed to capture fiscal cost snapshot: ${String(error)}`);
    }
  }

  // Separado de handleMonthlySnapshot pra ser chamável direto nos testes,
  // com uma data fixa, sem depender de mockar o relógio do sistema ou de
  // esperar o cron disparar.
  async captureSnapshot(now: Date): Promise<void> {
    const month = firstOfMonthUTC(now);

    const total = await this.computeDashboardCore({});
    await this.upsertSnapshot(month, '', '', total);

    const teams = await this.prisma.employee.findMany({
      where: { deletedAt: null, team: { not: null } },
      distinct: ['team'],
      select: { team: true },
    });
    for (const { team } of teams) {
      if (!team) continue;
      const data = await this.computeDashboardCore({ team });
      await this.upsertSnapshot(month, team, '', data);
    }

    for (const tipoContratacao of TIPOS_CONTRATACAO) {
      const data = await this.computeDashboardCore({ tipoContratacao });
      await this.upsertSnapshot(month, '', tipoContratacao, data);
    }
  }

  private async upsertSnapshot(
    month: Date,
    team: string,
    tipoContratacao: string,
    data: { headcountTotal: number; custoBase: number; custoBeneficios: number; encargos: number | null; custoMensalTotal: number },
  ): Promise<void> {
    const values = {
      headcountTotal: data.headcountTotal,
      custoBase: data.custoBase,
      custoBeneficios: data.custoBeneficios,
      encargos: data.encargos,
      custoMensalTotal: data.custoMensalTotal,
    };
    await this.prisma.fiscalCostSnapshot.upsert({
      where: { month_team_tipoContratacao: { month, team, tipoContratacao } },
      create: { month, team, tipoContratacao, ...values },
      update: values,
    });
  }

  getParametros() {
    return this.prisma.fiscalParameters.findUnique({ where: { id: 'default' } });
  }

  updateParametros(input: FiscalParametersInput, updatedByUserId: string) {
    return this.prisma.fiscalParameters.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...input, updatedByUserId },
      update: { ...input, updatedByUserId },
    });
  }
}
