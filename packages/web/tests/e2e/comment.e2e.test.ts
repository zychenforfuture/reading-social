import { test, expect } from '@playwright/test';

test.describe('Comment System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('邮箱').fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByPlaceholder('密码').fill(process.env.TEST_PASSWORD || 'test123');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL('/');
  });

  test('should display comment section', async ({ page }) => {
    await expect(page.getByText('评论')).toBeVisible();
  });

  test('should allow creating a comment', async ({ page }) => {
    const commentContent = `Test comment ${Date.now()}`;

    await page.getByPlaceholder('添加评论...').fill(commentContent);
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.getByText(commentContent)).toBeVisible({ timeout: 10000 });
  });

  test('should validate empty comment', async ({ page }) => {
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.getByPlaceholder('添加评论...')).toHaveAttribute('aria-invalid', 'true');
  });
});
