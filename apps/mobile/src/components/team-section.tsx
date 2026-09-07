import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { ThemedButton } from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { TEAM_ROWS } from "@/lib/team-members";

// Plain presentational grid — completion for this task is a separate manual
// action (no natural "finished viewing photos" event), same as the web
// version's TeamSection.
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
    <View style={styles.container}>
      {TEAM_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((member, memberIndex) => (
            <View key={memberIndex} style={styles.member}>
              <Image source={member.image} style={styles.photo} contentFit="cover" />
              <ThemedText type="smallBold">{member.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {member.title}
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
      <ThemedButton title={isDone ? "Desfazer" : "Marcar como concluído"} onPress={pending ? () => {} : onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  member: {
    width: 100,
    alignItems: "center",
    gap: 2,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
