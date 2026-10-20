export const siteText = {
  siteName: 'AvianDev',
  tagline: 'Notes on Next.js, motion and performance.',
  skipToContent: 'Skip to content',
  footerCopyright: '© AvianDev. All rights reserved.',
  navLabel: 'Main',
  navTopics: 'Topics',
  back: 'Back',
};

export const homeText = {
  latestPosts: 'Latest posts',
  empty: 'No posts yet. Check back soon.',
};

export const homeBanner = {
  title: '',
  subtitle: '',
  body: '',
  image: '',
  imageAlt: '',
  link: '',
  linkLabel: '',
  showButton: false,
  postsPerPage: 6,
};

export const postText = {
  allPosts: 'All posts',
  byAuthor: 'By {name}',
  published: 'Published',
  updated: 'Updated',
  viewsOne: '1 view',
  viewsMany: '{count} views',
  readingTime: '{count} min read',
};

export const categoryText = {
  topicsTitle: 'Topics',
  topicsIntro: 'Browse posts by topic.',
  noTopics: 'No topics yet.',
  allTopics: 'All topics',
  postsHeading: 'Posts',
  empty: 'No posts in this topic yet.',
};

export const seoText = {
  defaultTitle: 'AvianDev',
  titleTemplate: '%s · AvianDev',
  description: 'Notes on Next.js, motion and performance.',
  favicon: '',
  shareImage: '',
  twitterHandle: '',
  locale: 'en_IN',
  allowIndexing: true,
};

export const previewText = {
  banner: 'Preview: this is your last saved version. Only people with this link can see it, and the link expires in 30 minutes.',
  draft: 'Draft',
  published: 'Published',
  expiredTitle: 'This preview link has expired',
  expiredBody: 'Open a new preview from the post editor.',
};

export const accountText = {
  logIn: 'Log in',
  signUp: 'Sign up',
  logOut: 'Log out',
  accountMenu: 'Your account',
  email: 'Email',
  password: 'Password',
  firstName: 'First name',
  lastName: 'Last name',
  newPassword: 'New password',
  passwordHint: 'Use a long password you don’t use anywhere else.',
  loginTitle: 'Log in',
  loginIntro: 'Welcome back. Log in to join the conversation.',
  loggingIn: 'Logging in…',
  forgotLink: 'Forgot your password?',
  noAccount: 'New here?',
  signupTitle: 'Join AvianDev',
  signupIntro: 'Create a free account to comment on posts.',
  signupSubmit: 'Create account',
  signingUp: 'Creating account…',
  haveAccount: 'Already have an account?',
  checkEmailTitle: 'Check your email',
  checkEmailBody: 'We sent a link to {email}. Click it to confirm your account. You’ll be logged in straight away.',
  forgotTitle: 'Reset your password',
  forgotIntro: 'Enter your email and we’ll send you a link to choose a new password.',
  forgotSubmit: 'Send reset link',
  sending: 'Sending…',
  forgotSent: 'If an account exists for {email}, a reset link is on its way. It expires in 1 hour.',
  resetTitle: 'Choose a new password',
  resetSubmit: 'Save new password',
  saving: 'Saving…',
  verifyTitle: 'Confirm your email',
  verifying: 'Confirming your email…',
  verifiedTitle: 'Email confirmed',
  verifiedBody: 'You’re logged in and ready to comment.',
  continueToBlog: 'Continue to the blog',
  invalidLinkTitle: 'This link has expired',
  invalidLinkBody: 'Links work once and expire after a while.',
  invalidVerifyAction: 'Log in to get a new confirmation email',
  invalidResetAction: 'Request a new reset link',
  unverifiedNotice: 'Confirm your email to comment.',
  resend: 'Resend confirmation email',
  resent: 'Sent. Check your inbox.',
  genericError: 'Something went wrong. Please try again.',
};

export type AccountText = typeof accountText;