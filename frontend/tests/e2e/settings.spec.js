import fs from "node:fs";
import { test, expect, noHorizontalOverflow, shot, clerkReady } from "./fixtures";

const KEY = "pharmacy_settings";

async function openSettings(page) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
}

test.describe("Settings", () => {
  test("edit pharmacy details, save, reload: values persist in browser storage", async ({ page, monitor, uid }) => {
    await openSettings(page);
    const values = {
      "Pharmacy Name": `QA Pharmacy ${uid}`,
      "Phone Number": "9876543210",
      "Email Address": `qa.${uid.toLowerCase()}@example.com`,
      Address: `12 QA Street ${uid}, Pune`,
      GSTIN: "27abcde1234f1z5",
      "Drug Licence Number": `DL-${uid}`,
    };
    for (const [label, v] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(v);
    await expect(page.getByLabel("GSTIN")).toHaveValue("27ABCDE1234F1Z5"); // upper-cased
    await expect(page.getByRole("button", { name: "Save Settings*" })).toBeVisible();
    await page.getByRole("button", { name: /Save Settings/ }).click();
    await expect(page.getByRole("status")).toHaveText("Settings saved in this browser.");
    await expect(page.getByRole("button", { name: "Save Settings", exact: true })).toBeVisible();

    const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
    expect(stored).toEqual({
      pharmacyName: values["Pharmacy Name"],
      phone: values["Phone Number"],
      email: values["Email Address"],
      address: values.Address,
      gstNumber: "27ABCDE1234F1Z5",
      licenseNumber: values["Drug Licence Number"],
    });

    await page.reload();
    await expect(page.getByLabel("Pharmacy Name")).toHaveValue(values["Pharmacy Name"]);
    await expect(page.getByLabel("Address", { exact: true })).toHaveValue(values.Address);
    await expect(page.getByLabel("GSTIN")).toHaveValue("27ABCDE1234F1Z5");
    await expect(page.getByLabel("Drug Licence Number")).toHaveValue(values["Drug Licence Number"]);
    await expect(page.getByLabel("Phone Number")).toHaveValue(values["Phone Number"]);
    await shot(page, "settings-saved");
  });

  test("export downloads the current settings as JSON", async ({ page, monitor, uid }) => {
    await openSettings(page);
    await page.getByLabel("Pharmacy Name").fill(`QA Export ${uid}`);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
    expect(dl.suggestedFilename()).toBe("pharmacy_settings.json");
    const json = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
    expect(json.pharmacyName).toBe(`QA Export ${uid}`);
    expect(Object.keys(json).sort()).toEqual(["address", "email", "gstNumber", "licenseNumber", "pharmacyName", "phone"]);
  });

  test("import a valid file fills the form; a bad file shows an error and changes nothing", async ({ page, monitor, uid }) => {
    await openSettings(page);
    const input = page.getByTestId("settings-import-input");
    // The visible Import button is a real, focusable button that opens the picker
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Import" }).click()]);
    await chooser.setFiles({
      name: "good.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ pharmacyName: `QA Import ${uid}`, gstNumber: "27ABCDE1234F1Z5", unknownKey: "<script>", phone: 12345 })),
    });
    await expect(page.getByRole("status")).toContainText("Settings imported");
    await expect(page.getByLabel("Pharmacy Name")).toHaveValue(`QA Import ${uid}`);
    await expect(page.getByLabel("Phone Number")).toHaveValue("12345");
    await page.getByRole("button", { name: /Save Settings/ }).click();
    const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY));
    expect(stored.pharmacyName).toBe(`QA Import ${uid}`);
    expect(stored.unknownKey).toBeUndefined();

    for (const bad of ["not json at all", "[1,2,3]", "null"]) {
      await input.setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(bad) });
      await expect(page.getByRole("alert")).toHaveText("That file is not a valid settings file.");
      await expect(page.getByLabel("Pharmacy Name")).toHaveValue(`QA Import ${uid}`);
    }
  });

  test("Tax section explains where GST is configured; Profile section shows the signed-in user", async ({ page, api, monitor }) => {
    await openSettings(page);
    // All sections are visible cards now (no tabs)
    await expect(page.getByRole("region", { name: "Tax settings" })).toContainText("GST");
    await expect(page.getByRole("link", { name: "Medicine Catalog & Pricing" }).last()).toBeVisible();
    await clerkReady(page);
    const email = await page.evaluate(() => window.Clerk.user.primaryEmailAddress?.emailAddress);
    const card = page.locator(".settings-user-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(email);
    await expect(card).toContainText("Signed in");
    // Payment configuration reflects the server's Razorpay config (never the secret)
    const cfg = (await api.get("/api/payments/config")).json;
    await openSettings(page);
    await expect(page.getByRole("region", { name: "Payment configuration" })).toContainText(cfg.configured ? "Configured" : "Not configured");
    await shot(page, "settings-users");
  });

  test("no overflow at 390px and buttons usable", async ({ page, monitor }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    expect(await noHorizontalOverflow(page)).toBe(true);
    for (const n of ["Export", "Import", "Save Settings"]) {
      await expect(page.getByRole("button", { name: n, exact: true })).toBeInViewport();
    }
    await shot(page, "settings-390");
  });
});
