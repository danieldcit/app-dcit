import { Pressable, Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppLocaleProvider, useLocaleContext } from "../locale-context";

function LocaleConsumer() {
  const { locale, setLocale, t } = useLocaleContext();
  return (
    <>
      <Text testID="locale-value">{locale}</Text>
      <Text testID="translated">{t("Salvar")}</Text>
      <Pressable testID="set-en" onPress={() => setLocale("en")}>
        <Text>set-en</Text>
      </Pressable>
    </>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("defaults to Portuguese when nothing was saved", async () => {
  render(
    <AppLocaleProvider>
      <LocaleConsumer />
    </AppLocaleProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("locale-value").props.children).toBe("pt"));
  expect(screen.getByTestId("translated").props.children).toBe("Salvar");
});

test("setLocale updates the locale, translates via t(), and persists to AsyncStorage", async () => {
  render(
    <AppLocaleProvider>
      <LocaleConsumer />
    </AppLocaleProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("locale-value").props.children).toBe("pt"));

  fireEvent.press(screen.getByTestId("set-en"));

  await waitFor(() => expect(screen.getByTestId("locale-value").props.children).toBe("en"));
  expect(screen.getByTestId("translated").props.children).toBe("Save");
  await waitFor(async () => {
    expect(await AsyncStorage.getItem("locale-override")).toBe("en");
  });
});

test("loads a previously saved locale from AsyncStorage on mount", async () => {
  await AsyncStorage.setItem("locale-override", "es");

  render(
    <AppLocaleProvider>
      <LocaleConsumer />
    </AppLocaleProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("locale-value").props.children).toBe("es"));
  expect(screen.getByTestId("translated").props.children).toBe("Guardar");
});
