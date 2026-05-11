import { test, expect, Page } from '@playwright/test';

test.describe('Scroll Blocking Bug Fix', () => {
  
  const completeVotingFlow = async (page: Page) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[placeholder*="Cerca"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('GreenEnergy');
    
    await page.waitForTimeout(800);
    
    const companyOption = page.locator('li:has-text("GreenEnergy")').first();
    await companyOption.waitFor({ state: 'visible', timeout: 5000 });
    await companyOption.click();
    
    const nextButton = page.locator('button:has-text(">>")').first();
    await nextButton.click();
    
    const commentTextarea = page.locator('textarea').first();
    await commentTextarea.waitFor({ state: 'visible' });
    await commentTextarea.fill('Great company!');
    await nextButton.click();
    
    const adjectiveButton = page.locator('button:has-text("eccezionale")').first();
    await adjectiveButton.waitFor({ state: 'visible' });
    await adjectiveButton.click();
    await nextButton.click();
    
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    for (let i = 0; i < sliderCount; i++) {
      await sliders.nth(i).fill('80');
    }
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await expect(fattoButton).toBeEnabled({ timeout: 5000 });
  };

  test('TEST 1: Scroll funziona dalla sezione successo dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await fattoButton.click();
    
    await page.waitForSelector('[data-section="success"]', { timeout: 10000 });
    
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    
    const initialScroll = await main.evaluate(el => el.scrollTop);
    
    await main.evaluate(el => {
      el.scrollTop = 500;
    });
    
    await page.waitForTimeout(300);
    
    const newScroll = await main.evaluate(el => el.scrollTop);
    
    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('TEST 2: Snap attivo dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await fattoButton.click();
    
    await page.waitForSelector('[data-section="success"]', { timeout: 10000 });
    
    const mainClass = await page.locator('main').first().getAttribute('class');
    
    expect(mainClass).toContain('snap-y');
    expect(mainClass).toContain('snap-mandatory');
  });

  test('TEST 3: Nessun overlay bloccante dopo il voto', async ({ page }) => {
    await completeVotingFlow(page);
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await fattoButton.click();
    
    await page.waitForSelector('[data-section="success"]', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    const fixedElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' && 
               style.pointerEvents !== 'none' && 
               style.visibility !== 'hidden' &&
               parseFloat(style.opacity) > 0;
      });
      return elements.map(el => ({
        tag: el.tagName,
        class: el.className.slice(0, 50),
        zIndex: window.getComputedStyle(el).zIndex,
        pointerEvents: window.getComputedStyle(el).pointerEvents
      }));
    });
    
    console.log('Fixed elements blocking:', fixedElements);
    
    const blockingOverlays = fixedElements.filter(el => 
      el.zIndex === '100' || el.zIndex === 'auto'
    );
    
    expect(blockingOverlays.length).toBe(0);
  });

  test('TEST 4: Button FATTO abilita e apre overlay (regression test)', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[placeholder*="Cerca"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('GreenEnergy');
    
    await page.waitForTimeout(800);
    
    const companyOption = page.locator('li:has-text("GreenEnergy")').first();
    await companyOption.waitFor({ state: 'visible', timeout: 5000 });
    await companyOption.click();
    
    const nextButton = page.locator('button:has-text(">>")').first();
    await nextButton.click();
    
    const commentTextarea = page.locator('textarea').first();
    await commentTextarea.fill('Great company!');
    await nextButton.click();
    
    const adjectiveButton = page.locator('button:has-text("eccezionale")').first();
    await adjectiveButton.waitFor({ state: 'visible' });
    await adjectiveButton.click();
    await nextButton.click();
    
    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    for (let i = 0; i < sliderCount; i++) {
      await sliders.nth(i).fill('80');
    }
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await expect(fattoButton).toBeEnabled({ timeout: 5000 });
    
    await fattoButton.click();
    
    await page.waitForTimeout(500);
    
    const overlayVisible = await page.evaluate(() => {
      const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]');
      if (!overlay) return false;
      const style = window.getComputedStyle(overlay);
      return parseFloat(style.opacity) > 0 || style.display !== 'none';
    });
    
    expect(overlayVisible).toBe(true);
  });

  test('TEST 5: Scroll funziona su mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    
    await completeVotingFlow(page);
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await fattoButton.click();
    
    await page.waitForSelector('[data-section="success"]', { timeout: 10000 });
    
    const main = page.locator('main').first();
    const initialScroll = await main.evaluate(el => el.scrollTop);
    
    await main.evaluate(el => {
      el.scrollTop = 300;
    });
    
    await page.waitForTimeout(300);
    
    const newScroll = await main.evaluate(el => el.scrollTop);
    
    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('TEST 6: Snap su mobile funziona', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    
    await completeVotingFlow(page);
    
    const fattoButton = page.locator('button:has-text("FATTO!")').first();
    await fattoButton.click();
    
    await page.waitForSelector('[data-section="success"]', { timeout: 10000 });
    
    const mainClass = await page.locator('main').first().getAttribute('class');
    
    expect(mainClass).toContain('snap-y');
    expect(mainClass).toContain('snap-mandatory');
  });
});