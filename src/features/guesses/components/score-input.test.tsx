import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScoreInput } from "./score-input";

describe("ScoreInput", () => {
  it("aumenta e diminui o placar pelos controles", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ScoreInput ariaLabel="Gols do Lobo" onChange={onChange} value={2} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Aumentar Gols do Lobo" }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    rerender(<ScoreInput ariaLabel="Gols do Lobo" onChange={onChange} value={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Gols do Lobo" }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("aceita digitacao direta e limita o valor", () => {
    const onChange = vi.fn();
    render(<ScoreInput ariaLabel="Gols do Lobo" onChange={onChange} value={Number.NaN} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Gols do Lobo" }), {
      target: { value: "120" }
    });

    expect(onChange).toHaveBeenLastCalledWith(99);
  });
});
