import { expect, test } from "@playwright/test";

test.describe("Root entry", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/");

    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
