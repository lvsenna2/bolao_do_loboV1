import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationSearch } from "./navigation-search";
import { NavigationList } from "./navigation-list";
import { adminNavigationItems } from "./navigation";

const route = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

beforeEach(() => {
  route.pathname = "/dashboard";
  // jsdom does not implement the browser's native dialog methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

function openSearch() {
  const button = screen.getByRole("button", { name: "Pesquisar seções" });
  button.focus();
  fireEvent.click(button);
  return button;
}

describe("navigation search", () => {
  it("focuses search, filters without case or accent sensitivity, and reports empty results", () => {
    render(<NavigationSearch mode="admin" />);
    openSearch();
    const input = screen.getByRole("searchbox", { name: "Nome da seção" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "  USUÁRIOS  " } });
    const results = screen.getByRole("navigation", { name: "Resultados da pesquisa" });
    expect(within(results).getAllByRole("link")).toHaveLength(1);
    expect(within(results).getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "href",
      "/admin/usuarios"
    );
    fireEvent.change(input, { target: { value: "inexistente" } });
    expect(within(results).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhuma seção encontrada/)).toBeVisible();
  });

  it("restores focus and scrolling after cancellation", () => {
    render(<NavigationSearch />);
    const trigger = openSearch();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes even when selecting the current section and clears the next search", () => {
    render(<NavigationSearch />);
    openSearch();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dashboard" } });
    const results = screen.getByRole("navigation", { name: "Resultados da pesquisa" });
    const currentSection = within(results).getByRole("link", { name: "Dashboard" });
    currentSection.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(currentSection);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openSearch();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  });

  it("keeps the dialog open when clicking its content and closes on the backdrop", () => {
    render(<NavigationSearch />);
    openSearch();
    fireEvent.click(screen.getByRole("heading", { name: "Ir para uma seção" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("marks only the active admin section, including its nested routes", () => {
  route.pathname = "/admin/usuarios/123";
  render(<NavigationList items={adminNavigationItems} />);
  expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Visao geral" })).not.toHaveAttribute("aria-current");
});
