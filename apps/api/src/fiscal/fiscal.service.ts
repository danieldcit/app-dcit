import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FiscalParametersInput } from '@ponto-dcit/shared-types';

type DashboardFilters = { team?: string; tipoContratacao?: string };

@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(filters: DashboardFilters) {
    const employees = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...(filters.team ? { team: filters.team } : {}),
        ...(filters.tipoContratacao ? { tipoContratacao: filters.tipoContratacao } : {}),
      },
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

    const params = await this.prisma.fiscalParameters.findUnique({ where: { id: 'default' } });
    const encargosConfigurados =
      params?.inssPatronalPercent != null && params?.ratPercent != null && params?.fgtsPercent != null;

    let encargos: number | null = null;
    if (encargosConfigurados) {
      const percentualTotal = params!.inssPatronalPercent! + params!.ratPercent! + params!.fgtsPercent!;
      const custoCLT = employees
        .filter((e) => e.tipoContratacao === 'CLT')
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
      colaboradoresSemSalario,
    };
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
