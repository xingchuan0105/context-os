import { z } from 'zod';

/**
 * 用户注册验证 Schema
 * 要求:
 * - 邮箱格式有效
 * - 密码至少 8 位，包含大小写字母和数字
 * - 可选的全名，最多 100 字符
 */
export const RegisterSchema = z.object({
  email: z.string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式无效')
    .max(255, '邮箱过长')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, '密码至少需要 8 个字符')
    .max(128, '密码过长')
    .regex(/[a-z]/, '密码必须包含至少一个小写字母')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/\d/, '密码必须包含至少一个数字'),
  full_name: z.string()
    .max(100, '全名过长')
    .optional()
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * 用户登录验证 Schema
 */
export const LoginSchema = z.object({
  email: z.string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式无效')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, '密码不能为空')
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * 密码重置请求验证 Schema
 */
export const ResetRequestSchema = z.object({
  email: z.string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式无效')
    .toLowerCase()
    .trim()
});

export type ResetRequestInput = z.infer<typeof ResetRequestSchema>;

/**
 * 验证重置 Token Schema
 */
export const VerifyResetTokenSchema = z.object({
  token: z.string()
    .min(1, 'Token 不能为空')
});

export type VerifyResetTokenInput = z.infer<typeof VerifyResetTokenSchema>;

/**
 * 重置密码验证 Schema
 * 注意: confirmPassword 在前端验证，后端只验证 password 强度
 */
export const ResetPasswordSchema = z.object({
  token: z.string()
    .min(1, 'Token 不能为空'),
  password: z.string()
    .min(8, '密码至少需要 8 个字符')
    .max(128, '密码过长')
    .regex(/[a-z]/, '密码必须包含至少一个小写字母')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/\d/, '密码必须包含至少一个数字')
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
