import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("renders initials from a full name", () => {
    render(<Avatar name="Lucas Silva" />);

    expect(screen.getByText("LS")).toBeInTheDocument();
  });

  it("renders image when src is provided", () => {
    render(<Avatar name="Lucas Silva" src="https://example.com/avatar.png" />);

    expect(screen.getByRole("img", { name: "Lucas Silva" })).toHaveAttribute(
      "src",
      "https://example.com/avatar.png"
    );
  });
});
