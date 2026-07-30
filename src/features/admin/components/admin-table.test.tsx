import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "./admin-table";

describe("AdminTable", () => {
  it("adds column labels to mobile card cells", async () => {
    render(
      <AdminTable>
        <AdminTableHead>
          <tr>
            <AdminTh>Usuario</AdminTh>
            <AdminTh>Status</AdminTh>
          </tr>
        </AdminTableHead>
        <AdminTableBody>
          <tr>
            <AdminTd>Lucas</AdminTd>
            <AdminTd>Ativo</AdminTd>
          </tr>
        </AdminTableBody>
      </AdminTable>
    );

    await waitFor(() => {
      expect(screen.getByText("Lucas").closest("td")).toHaveAttribute("data-label", "Usuario");
      expect(screen.getByText("Ativo").closest("td")).toHaveAttribute("data-label", "Status");
    });
  });

  it("keeps the wide table constraint only from the desktop breakpoint", () => {
    const { container } = render(
      <AdminTable>
        <AdminTableBody>
          <tr>
            <AdminTd>Registro</AdminTd>
          </tr>
        </AdminTableBody>
      </AdminTable>
    );

    expect(container.querySelector("table")).toHaveClass("md:min-w-[780px]");
    expect(container.querySelector("table")).not.toHaveClass("min-w-[780px]");
  });
});
