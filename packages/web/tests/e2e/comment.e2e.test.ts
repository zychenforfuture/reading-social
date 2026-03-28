import { test, expect } from '@playwright/test';

test.describe('Comment System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('邮箱').fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByPlaceholder('密码').fill(process.env.TEST_PASSWORD || 'test123');
    await page.getByRole('button', { name: /登入/ }).click();
    await page.waitForURL('/');
    
    // 从文档列表点击第一个文档进入阅读页
    await page.getByRole('button', { name: '打开' }).first().click();
    
    // 等待文档内容加载出来 (寻找正文段落)
    await page.waitForSelector('.break-words.cursor-pointer');
  });

  test('should display comment section', async ({ page }) => {
    await expect(page.getByRole('button', { name: '评论', exact: true })).toBeVisible();
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
