import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/coming-soon",
  "/admin/login",
];

const PROTECTED_ROUTES = [
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

for (const route of PROTECTED_ROUTES) {
  test(`smoke: ${route} redirects to login without session`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status()).toBe(307);
    const location = res.headers()['location'] || '';
    expect(location).toContain('/admin/login');
  });
}