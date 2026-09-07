import { fireEvent, render, screen } from "@testing-library/react-native";
import { TeamSection } from "@/components/team-section";

describe("TeamSection", () => {
  it("renders every team member's name and title", () => {
    render(<TeamSection isDone={false} pending={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Claudio Medeiros")).toBeTruthy();
    expect(screen.getByText("Founder e CEO na DCIT")).toBeTruthy();
    expect(screen.getByText("Diego Moreira")).toBeTruthy();
  });

  it("shows 'Marcar como concluído' when not done and calls onToggle when pressed", () => {
    const onToggle = jest.fn();
    render(<TeamSection isDone={false} pending={false} onToggle={onToggle} />);
    fireEvent.press(screen.getByText("Marcar como concluído"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows 'Desfazer' when done", () => {
    render(<TeamSection isDone pending={false} onToggle={jest.fn()} />);
    expect(screen.getByText("Desfazer")).toBeTruthy();
  });
});
