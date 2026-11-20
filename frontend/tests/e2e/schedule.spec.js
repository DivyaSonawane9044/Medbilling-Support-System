import { test, expect, openViaSidebar, noHorizontalOverflow, shot } from "./fixtures";

async function createCustomerViaApi(api, uid) {
  const r = await api.post("/api/customers", { name: `QA Customer ${uid}`, contactNumber: "9876543210" });
  expect(r.status, r.text).toBe(201);
  return r.json;
}

test.describe("Medicine Schedule", () => {
  test("validation, create with and without customer, list, customer filter, form clears", async ({ page, api, uid, monitor }) => {
    await page.goto("/dashboard");
    const c = await createCustomerViaApi(api, uid);
    await openViaSidebar(page, "Medicine Schedule");
    await expect(page).toHaveURL(/\/medicine-schedule$/);

    const save = page.getByRole("button", { name: "Save Schedule" });
    const medicine = page.getByLabel("Medicine Name");

    // empty medicine name -> visible error, nothing saved
    await medicine.fill("   ");
    await save.click();
    await expect(page.getByRole("alert")).toHaveText("Medicine name is required.");

    // with customer
    const withCust = `QA Sched ${uid}`;
    await page.getByLabel("Customer (optional)").selectOption(String(c.customerId));
    await medicine.fill(withCust);
    await page.getByLabel("Morning").check();
    await page.getByLabel("Night").check();
    await page.getByLabel("Special Instructions").fill("After food, 5 days");
    await save.click();
    await expect(page.getByText(`Schedule for ${withCust} saved.`)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    // form cleared
    await expect(medicine).toHaveValue("");
    await expect(page.getByLabel("Customer (optional)")).toHaveValue("");
    await expect(page.getByLabel("Morning")).not.toBeChecked();
    await expect(page.getByLabel("Special Instructions")).toHaveValue("");

    const item = page.locator(".schedule-item").filter({ hasText: withCust });
    await expect(item).toHaveCount(1);
    // schedules are grouped per customer: the item sits in that customer's group
    await expect(page.locator(".schedule-group").filter({ has: item }).locator(".schedule-group-name")).toHaveText(c.name);
    await expect(item.locator(".schedule-chip")).toHaveText(["Morning", "Night"]);
    await expect(item).toContainText("After food, 5 days");

    // without customer
    const noCust = `QA Sched NC ${uid}`;
    await medicine.fill(noCust);
    await page.getByLabel("Afternoon").check();
    await save.click();
    await expect(page.getByText(`Schedule for ${noCust} saved.`)).toBeVisible();
    const item2 = page.locator(".schedule-item").filter({ hasText: noCust });
    await expect(page.locator(".schedule-group").filter({ has: item2 }).locator(".schedule-group-name")).toHaveText("No customer");
    await expect(item2.locator(".schedule-chip")).toHaveText(["Afternoon"]);

    // DB
    const mine = (await api.get(`/api/prescriptions?customerId=${c.customerId}`)).json;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ medicineName: withCust, morning: true, night: true, afternoon: false, evening: false, instructions: "After food, 5 days", customerName: c.name });
    const all = (await api.get("/api/prescriptions")).json;
    const nc = all.find((r) => r.medicineName === noCust);
    expect(nc).toBeTruthy();
    expect(nc.customerId ?? null).toBeNull();

    // filter by customer: only that customer's schedule
    await page.getByLabel("Filter by customer").selectOption(String(c.customerId));
    await expect(page.locator(".schedule-item")).toHaveCount(1);
    await expect(page.locator(".schedule-item")).toContainText(withCust);
    await page.getByLabel("Filter by customer").selectOption("");
    await expect(page.locator(".schedule-item").filter({ hasText: noCust })).toHaveCount(1);
    await shot(page, "schedule");
  });

  for (const [w, h] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    test(`responsive ${w}x${h}`, async ({ page, monitor }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/medicine-schedule");
      await page.waitForLoadState("networkidle");
      await expect(page.locator(".schedule-list-box")).toBeVisible();
      expect(await noHorizontalOverflow(page)).toBe(true);
      const clipped = await page.evaluate(() => [...document.querySelectorAll(".schedule-box, .schedule-box select, .schedule-box input, .schedule-item, .save-btn")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className || el.tagName));
      expect(clipped).toEqual([]);
      await shot(page, `schedule-${w}x${h}`);
    });
  }
});
