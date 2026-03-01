import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtpdm.aliyun.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(
  to: string,
  token: string,
  frontendUrl: string
): Promise<void> {
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"共鸣阅读" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: '请验证您的邮箱 - 共鸣阅读',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a;">验证您的邮箱</h2>
        <p style="color: #555;">感谢注册共鸣阅读！请点击下方按钮完成邮箱验证，链接 24 小时内有效。</p>
        <a href="${verifyUrl}"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#000;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;">
          验证邮箱
        </a>
        <p style="margin-top:24px;color:#999;font-size:12px;">
          如非本人操作，请忽略此邮件。<br/>
          链接：${verifyUrl}
        </p>
      </div>
    `,
  });

  logger.info(`Verification email sent to ${to}`);
}

export async function sendOTPEmail(
  to: string,
  code: string,
  purpose: 'register' | 'reset_password'
): Promise<void> {
  const subjectMap = {
    register: '注册验证码 - 共鸣阅读',
    reset_password: '重置密码验证码 - 共鸣阅读',
  };
  const titleMap = {
    register: '邮箱注册验证码',
    reset_password: '密码重置验证码',
  };

  await transporter.sendMail({
    from: `"共鸣阅读" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: subjectMap[purpose],
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a;">${titleMap[purpose]}</h2>
        <p style="color: #555;">您的验证码为（10 分钟内有效）：</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #000;
                    background: #f5f5f5; border-radius: 8px; padding: 16px 24px;
                    display: inline-block; margin: 12px 0;">
          ${code}
        </div>
        <p style="margin-top:24px;color:#999;font-size:12px;">如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });

  logger.info(`OTP email (${purpose}) sent to ${to}`);
}
