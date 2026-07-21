import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/coming-soon",
  "/admin/login",
  "/admin/dashboard/panoramica",
  "/admin/dashboard/aziende",
  "/admin/dashboard/voti",
];

for (const route of ROUTES) {
  test(`smoke: ${route} 200`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status()).toBe(200);
  });
}
