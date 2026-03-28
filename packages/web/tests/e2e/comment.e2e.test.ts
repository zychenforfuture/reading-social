import { test, expect } from '@playwright/test';

test.describe('Comment System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('邮箱').fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByPlaceholder('密码').fill(process.env.TEST_PASSWORD || 'test123');
    await page.getByRole('button', { name: /登入/ }).click();
    await page.waitForURL('/');

    const openButtons = page.getByRole('button', { name: '打开' });
    const enabledOpenButtons = page.locator('button:has-text("打开"):not([disabled])');

    if ((await enabledOpenButtons.count()) === 0) {
      await page.getByRole('button', { name: '新建文档' }).click();
      await page.getByPlaceholder('输入文档标题').fill(`E2E 文档 ${Date.now()}`);
      await page.getByPlaceholder('输入文档内容...').fill('第一章\n这是用于评论系统 E2E 的测试内容。');
      await page.getByRole('button', { name: '创建' }).click();

      // 新建后文档可能先处于 processing，等待出现可点击的“打开”按钮
      await expect
        .poll(async () => enabledOpenButtons.count(), { timeout: 60000 })
        .toBeGreaterThan(0);
    }

    await expect(openButtons.first()).toBeVisible({ timeout: 20000 });
    await expect(enabledOpenButtons.first()).toBeVisible({ timeout: 20000 });
    await enabledOpenButtons.first().click();
    
    // 等待文档内容加载出来 (寻找正文段落)
    await page.waitForSelector('.break-words.cursor-pointer');
  });

  test('should display comment section', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^评论/ })).toBeVisible();
  });

  test('should allow creating a comment', async ({ page }) => {
    const commentContent = `Test comment ${Date.now()}`;

    // Click on a readable text block to enable comment form
    await page.locator('.break-words.cursor-pointer').first().click();

    await page.locator('textarea').fill(commentContent);
    await page.locator('textarea + button').click();

    await expect(page.getByText(commentContent)).toBeVisible({ timeout: 10000 });
  });

  test('should validate empty comment', async ({ page }) => {
    await page.locator('.break-words.cursor-pointer').first().click();
    
    // The button shouldn't be actionable when empty, it's disabled
    await expect(page.locator('textarea + button')).toBeDisabled();
  });
});
