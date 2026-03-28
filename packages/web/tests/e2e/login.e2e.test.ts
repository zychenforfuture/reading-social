import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByPlaceholder('邮箱')).toBeVisible();
    await expect(page.getByPlaceholder('密码')).toBeVisible();
    await expect(page.getByRole('button', { name: /登入/ })).toBeVisible();
  });

  test('should have required fields', async ({ page }) => {
    const emailInput = page.getByPlaceholder('邮箱');
    const passwordInput = page.getByPlaceholder('密码');

    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('邮箱').fill('invalid@test.com');
    await page.getByPlaceholder('密码').fill('wrongpassword');
    await page.getByRole('button', { name: /登入/ }).click();

    await expect(page.getByText(/邮箱或密码错误/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByText('注册').click();
    await expect(page).toHaveURL('/register');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByText('忘记密码').click();
    await expect(page).toHaveURL('/forgot-password');
  });
});
