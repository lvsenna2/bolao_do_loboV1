import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders content with the requested tone", () => {
    render(<Badge tone="success">Ativo</Badge>);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toHaveClass("text-emerald-700");
  });
});
