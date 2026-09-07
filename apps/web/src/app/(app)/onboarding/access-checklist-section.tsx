import { ONBOARDING_ACCESS_ITEMS, ONBOARDING_ACCESS_ITEM_LABELS } from "@ponto-dcit/shared-types";

import styles from "./onboarding.module.css";

// Plain presentational list — each item's own Pendente/Concluído pill is
// also its toggle button, independent of the other 4. The outer
// "Configurar seus acessos" task completes on its own once every item here
// is done (derived server-side, see OnboardingService.mergeDerivedCompletion)
// — there's no separate "mark task complete" action the way TeamSection has.
export function AccessChecklistSection({
  completedItems,
  pendingItem,
  onToggleItem,
}: {
  completedItems: string[];
  pendingItem: string | null;
  onToggleItem: (item: string) => void;
}) {
  return (
    <ul className={styles.accessList}>
      {ONBOARDING_ACCESS_ITEMS.map((item) => {
        const isDone = completedItems.includes(item);
        return (
          <li key={item} className={styles.accessItem}>
            <span className={styles.accessItemLabel}>{ONBOARDING_ACCESS_ITEM_LABELS[item]}</span>
            <button
              type="button"
              className={`${styles.accessToggleButton} ${isDone ? styles.statusComplete : styles.statusPending}`}
              disabled={pendingItem === item}
              onClick={() => onToggleItem(item)}
            >
              {isDone ? "Concluído" : "Pendente"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
