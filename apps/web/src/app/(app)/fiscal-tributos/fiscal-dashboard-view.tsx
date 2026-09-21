import Link from "next/link";

import { TEAM_SUGGESTIONS } from "@/lib/team-suggestions";
import type { FiscalDashboard } from "./page";
import { ClassificarTipoForm } from "./classificar-tipo-form";
import { CustoColaboradorTable } from "./custo-colaborador-table";
import { EncargosCard } from "./encargos-card";
import styles from "./fiscal-tributos.module.css";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERCENT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function semSalarioHref(semSalario: { userId: string }[]): string {
  return `/colaboradores?semSalario=${semSalario.map((e) => e.userId).join(",")}`;
}

function TrendIndicator({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const arrow = percent > 0 ? "↑" : percent < 0 ? "↓" : "→";
  return (
    <p className={styles.cardSubtext}>
      {arrow} {PERCENT.format(Math.abs(percent))}% vs. mês anterior
    </p>
  );
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMonthShort(iso: string): string {
  const date = new Date(iso);
  return `${MESES_ABREV[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`;
}

function CostTrendChart({ historico }: { historico: { month: string; custoMensalTotal: number }[] }) {
  const width = 300;
  const height = 100;
  const padding = 8;
  const values = historico.map((h) => h.custoMensalTotal);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = historico.map((h, i) => {
    const x = historico.length > 1 ? padding + (i / (historico.length - 1)) * (width - padding * 2) : width / 2;
    const y = height - padding - ((h.custoMensalTotal - min) / range) * (height - padding * 2);
    return { x, y };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.trendChart}
      role="img"
      aria-label="Evolução do custo mensal da equipe"
    >
      <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="currentColor" />
      ))}
    </svg>
  );
}

function PercentBar({
  label,
  value,
  displayValue,
  total,
}: {
  label: string;
  value: number;
  displayValue: string;
  total: number;
}) {
  const percentual = pct(value, total);
  return (
    <li className={styles.headcountRow}>
      <div className={styles.headcountLabelRow}>
        <span>{label}</span>
        <span>
          {displayValue} ({PERCENT.format(percentual)}%)
        </span>
      </div>
      <div className={styles.headcountBarTrack}>
        <div className={styles.headcountBarFill} style={{ width: `${percentual}%` }} />
      </div>
    </li>
  );
}

function CompactPercentRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <li className={styles.compositionRow}>
      <span>{label}</span>
      <span>
        {BRL.format(value)} — {PERCENT.format(pct(value, total))}%
      </span>
    </li>
  );
}

type AlertItem = { key: string; text: string; actionLabel: string; href: string };

function AlertGroup({ emoji, label, items }: { emoji: string; label: string; items: AlertItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.alertGroup}>
      <p className={styles.alertGroupHeader}>
        {emoji} {items.length} {items.length === 1 ? "alerta" : "alertas"} de {label}
      </p>
      {items.map((item) => (
        <div key={item.key} className={styles.alertItem}>
          <p>{item.text}</p>
          <Link href={item.href}>{item.actionLabel} →</Link>
        </div>
      ))}
    </div>
  );
}

function AlertasCard({
  dashboard,
  naoClassificadosCount,
}: {
  dashboard: FiscalDashboard;
  naoClassificadosCount: number;
}) {
  const criticos: AlertItem[] = [];
  if (!dashboard.encargosConfigurados) {
    criticos.push({
      key: "parametros",
      text: "Parâmetros fiscais não configurados",
      actionLabel: "Configurar parâmetros",
      href: "/fiscal-tributos/parametros",
    });
  }

  const atencao: AlertItem[] = [];
  if (dashboard.colaboradoresSemSalario > 0) {
    atencao.push({
      key: "sem-salario",
      text: `${dashboard.colaboradoresSemSalario} colaborador(es) sem salário cadastrado`,
      actionLabel: "Atualizar cadastros",
      href: semSalarioHref(dashboard.semSalario),
    });
  }
  if (naoClassificadosCount > 0) {
    atencao.push({
      key: "nao-classificados",
      text: `${naoClassificadosCount} colaborador(es) sem tipo de contratação classificado`,
      actionLabel: "Classificar agora",
      href: "#nao-classificados",
    });
  }

  const total = criticos.length + atencao.length;

  return (
    <section className={styles.card}>
      <h2>⚠️ Alertas</h2>
      <p className={styles.bigNumber}>{total}</p>
      {total === 0 ? (
        <p className={styles.cardSubtext}>✅ Nenhuma pendência encontrada</p>
      ) : (
        <>
          <AlertGroup emoji="🔴" label="crítico" items={criticos} />
          <AlertGroup emoji="🟡" label="atenção" items={atencao} />
        </>
      )}
    </section>
  );
}

export function FiscalDashboardView({
  dashboard,
  naoClassificados,
  team,
  tipoContratacao,
}: {
  dashboard: FiscalDashboard;
  naoClassificados: { userId: string; name: string }[];
  team: string;
  tipoContratacao: string;
}) {
  return (
    <div className={styles.page}>
      <h1>Fiscal &amp; Tributos 2026</h1>
      <p className={styles.subtitle}>Custos de pessoal e impactos tributários da equipe.</p>

      <form className={styles.filters} method="get">
        <label className={styles.filterField}>
          Equipe
          <select id="team" name="team" defaultValue={team}>
            <option value="">Todos</option>
            {/* Se o filtro atual já vier com um time fora das 4 sugestões
                (alguém cadastrou um nome livre em Colaboradores), inclui
                aqui também — senão o filtro em vigor "sumiria" da lista. */}
            {team && !(TEAM_SUGGESTIONS as readonly string[]).includes(team) ? (
              <option value={team}>{team}</option>
            ) : null}
            {TEAM_SUGGESTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          Tipo de contratação
          <select id="tipoContratacao" name="tipoContratacao" defaultValue={tipoContratacao}>
            <option value="">Todos</option>
            <option value="CLT">CLT</option>
            <option value="PJ">PJ</option>
            <option value="terceirizado">Terceirizado</option>
          </select>
        </label>
        <button type="submit">Aplicar filtros</button>
      </form>

      <div className={styles.cards}>
        <AlertasCard dashboard={dashboard} naoClassificadosCount={naoClassificados.length} />

        <section className={styles.card}>
          <h2>Headcount</h2>
          <p className={styles.bigNumber}>{dashboard.headcountTotal}</p>
          <ul className={styles.headcountList}>
            <PercentBar
              label="CLT"
              value={dashboard.headcountPorTipo.CLT}
              displayValue={String(dashboard.headcountPorTipo.CLT)}
              total={dashboard.headcountTotal}
            />
            <PercentBar
              label="PJ"
              value={dashboard.headcountPorTipo.PJ}
              displayValue={String(dashboard.headcountPorTipo.PJ)}
              total={dashboard.headcountTotal}
            />
            <PercentBar
              label="Terceirizado"
              value={dashboard.headcountPorTipo.terceirizado}
              displayValue={String(dashboard.headcountPorTipo.terceirizado)}
              total={dashboard.headcountTotal}
            />
            <PercentBar
              label="Não classificado"
              value={dashboard.headcountPorTipo.naoClassificado}
              displayValue={String(dashboard.headcountPorTipo.naoClassificado)}
              total={dashboard.headcountTotal}
            />
          </ul>
        </section>

        <section className={styles.card}>
          <h2>💰 Custo mensal da equipe</h2>
          <p className={styles.bigNumber}>{BRL.format(dashboard.custoMensalTotal)}</p>
          <TrendIndicator percent={dashboard.variacaoCustoMensalPercent} />
          <p className={styles.cardSubtext}>Ver composição em &quot;Composição do custo&quot;, abaixo.</p>
          {dashboard.colaboradoresSemSalario > 0 ? (
            <p className={styles.warning}>
              {dashboard.colaboradoresSemSalario} colaborador(es) sem salário cadastrado — não entram na soma.{" "}
              <Link href={semSalarioHref(dashboard.semSalario)}>Atualizar cadastros</Link>
            </p>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2>Custo médio por colaborador</h2>
          <p className={styles.bigNumber}>{BRL.format(dashboard.custoMedioPorColaborador)}</p>
          <TrendIndicator percent={dashboard.variacaoCustoMedioPercent} />
          <p className={styles.cardSubtext}>Base: {dashboard.headcountTotal} colaborador(es)</p>
          {dashboard.colaboradoresSemSalario > 0 ? (
            <p className={styles.warning}>
              ⚠️ {dashboard.colaboradoresSemSalario} colaborador(es) sem salário cadastrado
            </p>
          ) : null}
          {dashboard.colaboradoresSemSalario > 0 && dashboard.custoMedioComDadosCompletos !== null ? (
            <p className={styles.cardSubtext}>
              Custo médio dos {dashboard.headcountTotal - dashboard.colaboradoresSemSalario} com dados completos:{" "}
              {BRL.format(dashboard.custoMedioComDadosCompletos)}
            </p>
          ) : null}
        </section>

        <EncargosCard dashboard={dashboard} />
      </div>

      <section className={styles.card}>
        <h2>Evolução do custo da equipe</h2>
        {dashboard.historicoCombinacaoNaoSuportada ? (
          <p className={styles.cardSubtext}>
            Selecione apenas time OU tipo de contratação para ver a evolução histórica.
          </p>
        ) : dashboard.historico.length === 0 ? (
          <>
            <p className={styles.cardSubtext}>Ainda não há histórico suficiente para gerar o gráfico.</p>
            <p className={styles.cardSubtext}>O histórico será exibido após o fechamento de novos períodos.</p>
          </>
        ) : (
          <>
            <CostTrendChart historico={dashboard.historico} />
            <div className={styles.trendLabels}>
              {dashboard.historico.map((h) => (
                <span key={h.month}>{formatMonthShort(h.month)}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>Composição do custo</h2>
        <ul className={styles.compositionList}>
          <CompactPercentRow label="Salários/contratos" value={dashboard.custoBase} total={dashboard.custoMensalTotal} />
          <CompactPercentRow label="Benefícios" value={dashboard.custoBeneficios} total={dashboard.custoMensalTotal} />
          {dashboard.encargos !== null ? (
            <CompactPercentRow label="Encargos" value={dashboard.encargos} total={dashboard.custoMensalTotal} />
          ) : null}
        </ul>
        {dashboard.encargos === null ? (
          <p className={styles.cardSubtext}>Encargos não incluídos — parâmetros fiscais não configurados.</p>
        ) : null}
      </section>

      {dashboard.custosPorColaborador.length > 0 ? (
        <section className={styles.card}>
          <h2>Custo por colaborador</h2>
          <p className={styles.cardSubtext}>Clique em um colaborador para ver a memória de cálculo.</p>
          <CustoColaboradorTable colaboradores={dashboard.custosPorColaborador} />
        </section>
      ) : null}

      {naoClassificados.length > 0 ? (
        <section id="nao-classificados" className={styles.card}>
          <h2>Colaboradores não classificados ({naoClassificados.length})</h2>
          <ul className={styles.classificationList}>
            {naoClassificados.map((employee) => (
              <li key={employee.userId}>
                <span>{employee.name}</span>
                <ClassificarTipoForm userId={employee.userId} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className={styles.updatedFooter}>
        Dados atualizados em {DATE_TIME.format(new Date())}
        {dashboard.parametrosAtualizadoEm
          ? ` • Parâmetros tributários atualizados em ${DATE_TIME.format(new Date(dashboard.parametrosAtualizadoEm))}`
          : ""}
        {dashboard.parametrosVigenciaData
          ? ` • Vigência legal desde ${DATE.format(new Date(dashboard.parametrosVigenciaData))}`
          : ""}
      </p>
    </div>
  );
}
