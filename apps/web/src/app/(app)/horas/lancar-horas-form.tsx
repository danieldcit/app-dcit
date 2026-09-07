import { lancarHoras } from "./actions";
import styles from "./horas.module.css";

type Employee = { userId: string; name: string };

function todaySaoPauloDateOnly(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// First day of the current São Paulo calendar month, as a date-only
// string. Bounds the date <input> together with today's date (max) so a
// mistyped date can't land outside the window "resumo"/"list" can ever
// resolve back to — dia = today only, semana = current Mon-Sun, mês =
// current calendar month. A date outside [this, today] would create a
// row invisible under every period tab, with no id exposed in the UI to
// delete it via. Bounding to the current month guarantees any pickable
// date is at least visible under "Mês".
function firstDayOfCurrentSaoPauloMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-01`;
}

export function LancarHorasForm({ employees }: { employees: Employee[] }) {
  const today = todaySaoPauloDateOnly();
  const firstDayOfMonth = firstDayOfCurrentSaoPauloMonth();
  return (
    <form action={lancarHoras} className={styles.form}>
      <h2 className={styles.sectionTitle}>Lançar horas em tickets</h2>
      <label className={styles.field}>
        Colaborador
        <select name="userId" required defaultValue="" className={styles.input}>
          <option value="" disabled>
            Selecione
          </option>
          {employees.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Data
        <input
          type="date"
          name="date"
          required
          defaultValue={today}
          min={firstDayOfMonth}
          max={today}
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        Horas em tickets
        <input type="number" name="horasTickets" min={0} step={0.5} required className={styles.input} />
      </label>
      <button type="submit" className={styles.submitButton}>
        Lançar
      </button>
    </form>
  );
}
