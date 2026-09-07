import Image from "next/image";

import styles from "./onboarding.module.css";
import { TEAM_ROWS } from "./team-members";

// Plain presentational grid — completion for this task is a separate manual
// action (there's no natural "finished viewing photos" event the way a video
// has "ended" or an upload has "submitted"), so the toggle button lives here
// rather than on the row header, which is now dedicated to expand/collapse.
export function TeamSection({
  isDone,
  pending,
  onToggle,
}: {
  isDone: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.teamSection}>
      {TEAM_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.teamRow}>
          {row.map((member, memberIndex) => (
            <div key={memberIndex} className={styles.teamMember}>
              <Image
                src={member.image}
                alt={member.title}
                width={120}
                height={120}
                className={styles.teamPhoto}
              />
              <span className={styles.teamTitle}>{member.title}</span>
            </div>
          ))}
        </div>
      ))}
      <button type="button" className={styles.teamToggleButton} disabled={pending} onClick={onToggle}>
        {isDone ? "Desfazer" : "Marcar como concluído"}
      </button>
    </div>
  );
}
