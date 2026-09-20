import { classifyTipoContratacao } from "./actions";
import styles from "./fiscal-tributos.module.css";

export function ClassificarTipoForm({ userId }: { userId: string }) {
  return (
    <form action={classifyTipoContratacao} className={styles.classifyForm}>
      <input type="hidden" name="userId" value={userId} />
      <select name="tipoContratacao" defaultValue="" required>
        <option value="" disabled>
          Classificar como...
        </option>
        <option value="CLT">CLT</option>
        <option value="PJ">PJ</option>
        <option value="terceirizado">Terceirizado</option>
      </select>
      <button type="submit">Salvar</button>
    </form>
  );
}
