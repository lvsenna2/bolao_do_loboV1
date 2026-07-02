import { expect, test } from "@playwright/test";

test.describe("public navigation", () => {
  test("home links to login and registration", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Bolao do Lobo" })).toBeVisible();

    const header = page.getByRole("banner");

    await header.getByRole("link", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();

    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("button", { name: /criar conta/i })).toBeVisible();
  });
});
