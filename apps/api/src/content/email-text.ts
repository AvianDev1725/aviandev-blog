export const emailKeys = {
  newSignup: 'email-new-signup',
  approved: 'email-approved',
  rejected: 'email-rejected',
  invite: 'email-invite',
  verifyEmail: 'email-verify',
  resetPassword: 'email-reset-password',
  accountExists: 'email-account-exists',
} as const;

export const emailText = {
  newSignup: {
    subject: 'New admin access request',
    body: '{name} ({email}) has requested admin access to AvianDev.\n\nReview it here: {url}',
  },
  approved: {
    subject: 'Your AvianDev access was approved',
    body: 'Hi {name},\n\nYour request for admin access was approved. You can sign in here: {url}',
  },
  rejected: {
    subject: 'About your AvianDev access request',
    body: "Hi {name},\n\nYour request for admin access to AvianDev wasn't approved.",
  },
  invite: {
    subject: "You're invited to AvianDev Admin",
    body:
      "You've been invited to join AvianDev Admin as {role}.\n\nAccept your invite: {url}\n\n" +
      "This link expires in 48 hours. If you weren't expecting this, you can ignore this email.",
    roleAdmin: 'an admin',
    roleSuperAdmin: 'a super admin',
  },
    verifyEmail: {
    subject: 'Confirm your email for AvianDev',
    body:
      'Hi {name},\n\nThanks for joining AvianDev. Confirm your email to start commenting:\n\n{url}\n\n' +
      "This link expires in 24 hours. If you didn't sign up, you can ignore this email.",
  },
  resetPassword: {
    subject: 'Reset your AvianDev password',
    body:
      'Hi {name},\n\nUse this link to choose a new password:\n\n{url}\n\n' +
      "This link expires in 1 hour. If you didn't ask for this, you can ignore this email. Your password won't change.",
  },
  accountExists: {
    subject: 'You already have an AvianDev account',
    body:
      'Hi {name},\n\nSomeone tried to sign up with this email, but you already have an account.\n\n' +
      "Log in: {loginUrl}\nForgot your password? {resetUrl}\n\nIf this wasn't you, you can ignore this email.",
  },
};