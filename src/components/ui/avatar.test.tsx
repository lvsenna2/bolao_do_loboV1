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

  it("keeps uploaded avatar bytes out of the rendered document", () => {
    render(
      <Avatar
        name="Lucas Silva"
        src="data:image/webp;base64,AAAA"
        userId="4d0ebf43-c690-4de6-a8ad-1a4bbf412345"
      />
    );

    const image = screen.getByRole("img", { name: "Lucas Silva" });

    expect(image.getAttribute("src")).toContain("%2Fapi%2Favatar%2F4d0ebf43");
    expect(image.getAttribute("src")).not.toContain("data%3Aimage");
  });
});
