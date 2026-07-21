export const VIEWPORTS = {
  'mobile-small': { width: 320, height: 640 },
  mobile: { width: 375, height: 812 },
  'tablet-portrait': { width: 768, height: 1024 },
  'tablet-landscape': { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
  'desktop-wide': { width: 1920, height: 1080 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;
