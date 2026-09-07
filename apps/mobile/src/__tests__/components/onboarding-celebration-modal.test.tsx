import { fireEvent, render, screen } from "@testing-library/react-native";
import { OnboardingCelebrationModal } from "@/components/onboarding-celebration-modal";

describe("OnboardingCelebrationModal", () => {
  it("renders the title, description and action label", () => {
    render(
      <OnboardingCelebrationModal
        visible
        title="🎉 Parabéns! Onboarding concluído"
        description="Aguarde o gestor ou RH liberar seu acesso completo ao portal."
        actionLabel="Fechar"
        onAction={jest.fn()}
      />,
    );
    expect(screen.getByText("🎉 Parabéns! Onboarding concluído")).toBeTruthy();
    expect(screen.getByText("Aguarde o gestor ou RH liberar seu acesso completo ao portal.")).toBeTruthy();
  });

  it("calls onAction when the action button is pressed", () => {
    const onAction = jest.fn();
    render(
      <OnboardingCelebrationModal
        visible
        title="t"
        description="d"
        actionLabel="Ir para o Dashboard"
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByText("Ir para o Dashboard"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
