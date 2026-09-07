import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessChecklistSection } from "@/components/access-checklist-section";

describe("AccessChecklistSection", () => {
  it("renders every access item with its label and Pendente/Concluído state", () => {
    render(
      <AccessChecklistSection completedItems={["movidesk"]} pendingItem={null} onToggleItem={jest.fn()} />,
    );
    expect(screen.getByText("Movidesk")).toBeTruthy();
    expect(screen.getByText("SGN Portal")).toBeTruthy();
    expect(screen.getAllByText("Concluído")).toHaveLength(1);
    expect(screen.getAllByText("Pendente")).toHaveLength(4);
  });

  it("calls onToggleItem with the item key when its button is pressed", () => {
    const onToggleItem = jest.fn();
    render(<AccessChecklistSection completedItems={[]} pendingItem={null} onToggleItem={onToggleItem} />);
    fireEvent.press(screen.getByText("SGN Portal"));
    expect(onToggleItem).toHaveBeenCalledWith("sgn_portal");
  });
});
