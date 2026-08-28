import * as Yup from 'yup';

export const loginSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export const forgotPasswordSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
});

export const otpSchema = Yup.object({
  otp: Yup.string()
    .matches(/^\d{6}$/, 'Enter the 6-digit code')
    .required('OTP is required'),
});

// Mirrors backend ResetPasswordDto's @IsStrongPassword rule (minLength: 10,
// minLowercase/minUppercase/minNumbers/minSymbols: 1 each) — see
// backashbackend/src/modules/identity/dto/reset-password.dto.ts.
const strongPasswordRule = Yup.string()
  .min(10, 'Password must be at least 10 characters')
  .matches(/[a-z]/, 'Include at least one lowercase letter')
  .matches(/[A-Z]/, 'Include at least one uppercase letter')
  .matches(/\d/, 'Include at least one number')
  .matches(/[^A-Za-z0-9]/, 'Include at least one symbol')
  .required('New password is required');

export const resetPasswordSchema = Yup.object({
  otp: Yup.string()
    .matches(/^\d{6}$/, 'Enter a valid 6-digit code')
    .required('Code is required'),
  newPassword: strongPasswordRule,
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Confirm your new password'),
});

export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: strongPasswordRule,
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Confirm your new password'),
});
