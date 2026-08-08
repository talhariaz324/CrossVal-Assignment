import { expect, test } from "@playwright/test";

/**
 * Golden-path e2e test mirroring the exact sample scenario from the
 * assignment brief, run against a real local dev server (frontend + backend
 * + Postgres) — the MVP interaction check, not a mocked component test.
 *
 * Note on step 5: the brief's sample scenario pays the order fully to $0
 * due, then attempts a $1 overpayment. In this UI the payment form is
 * intentionally hidden once amountDueCents reaches 0 (there is nothing left
 * to pay), so the overpayment-rejection check below is done one step
 * earlier — attempting to overpay the remaining $600 balance by paying $700
 * — which exercises the exact same backend rejection path and is
 * observable in the UI (the form stays visible because the order isn't
 * fully paid yet).
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

test("signup, create order, partial payment, overpayment rejection, full payment, dashboard filter", async ({
  page,
}) => {
  const email = uniqueEmail();

  await test.step("sign up", async () => {
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/");
  });

  await test.step("log out and log back in", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/");
  });

  await test.step("create order: 2 x $500 = $1000, due in 7 days", async () => {
    await page.getByRole("navigation").getByRole("link", { name: "New order" }).click();
    await page.getByRole("textbox", { name: "Customer name" }).fill("Acme Corp");
    await page.getByRole("textbox", { name: "Description" }).fill("Widget");
    await page.getByRole("spinbutton", { name: "Qty" }).fill("2");
    await page.getByRole("spinbutton", { name: "Unit price" }).fill("500");
    await page.getByRole("button", { name: "Create order" }).click();

    await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    await expect(page.getByTestId("amount-due")).toHaveText("$1,000.00");
  });

  await test.step("record $400 payment -> partially_paid, $600 due", async () => {
    await page.getByRole("textbox", { name: "Amount" }).fill("400");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();
    await expect(page.getByTestId("amount-due")).toHaveText("$600.00");
    await expect(page.getByTestId("payment-history").getByRole("row")).toHaveCount(2); // header + 1 payment
  });

  await test.step("attempt to overpay the remaining $600 balance with $700 -> rejected", async () => {
    await page.getByRole("textbox", { name: "Amount" }).fill("700");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByTestId("payment-error")).toContainText("exceeds the remaining balance");
    // Still just the one payment from the previous step, and balance unchanged.
    await expect(page.getByTestId("payment-history").getByRole("row")).toHaveCount(2);
    await expect(page.getByTestId("amount-due")).toHaveText("$600.00");
    await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();
  });

  await test.step("record the exact remaining $600 -> paid, $0 due", async () => {
    await page.getByRole("textbox", { name: "Amount" }).fill("600");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByTestId("amount-due")).toHaveText("$0.00");
    await expect(page.getByTestId("payment-history").getByRole("row")).toHaveCount(3); // header + 2 payments
    // Fully paid: nothing left to pay, so the payment form should be gone.
    await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
  });

  await test.step("dashboard status filter narrows correctly", async () => {
    await page.getByRole("link", { name: "Orders & Settlements" }).click();
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();

    const filter = page.getByRole("group", { name: "Filter by status" });
    await filter.getByRole("button", { name: "Paid" }).click();
    await expect(page.getByRole("link", { name: "Acme Corp" })).toBeVisible();

    await filter.getByRole("button", { name: "Pending" }).click();
    await expect(page.getByRole("link", { name: "Acme Corp" })).toHaveCount(0);
    await expect(page.getByText("No orders yet")).toBeVisible();
  });
});
