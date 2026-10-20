import { loginText } from '../app/login/text';
import { signupText } from '../app/signup/text';
import { acceptInviteText } from '../app/accept-invite/text';
import { dashboardText, shellText } from '../app/(dashboard)/text';
import { teamText } from '../app/(dashboard)/team/text';
import { modelsText } from '../app/(dashboard)/models/text';
import { contentText, richTextText } from '../app/(dashboard)/content/text';
import { emailKeys, emailText } from '../../api/src/content/email-text';
import { categoriesText } from '../app/(dashboard)/categories/text';
import { postEditorText, postsText } from '../app/(dashboard)/posts/text';
import { categoryText, homeText, postText, seoText, siteText, previewText, } from '../../web/app/text';
import { adminSeoText } from '../app/seo-text';

type Value = string | number | boolean;

export type CmsEntry = {
  key: string;
  name: string;
  description: string;
  fallback: Record<string, Value>;
  fieldTypes?: Record<string, 'text' | 'longText' | 'image' | 'link'>;
};

export const cmsRegistry: CmsEntry[] = [
  {
    key: 'admin-login',
    name: 'Admin: sign in page',
    description: 'Text on the admin sign in page.',
    fallback: loginText,
  },
  {
    key: 'admin-signup',
    name: 'Admin: request access page',
    description: 'The signup form and its confirmation message.',
    fallback: signupText,
  },
  {
    key: 'admin-accept-invite',
    name: 'Admin: accept invite page',
    description: 'The page an invited person uses to create their account.',
    fallback: acceptInviteText,
  },
  {
    key: 'admin-shell',
    name: 'Admin: sidebar',
    description: 'Navigation, role names and buttons in the sidebar.',
    fallback: shellText,
  },
  {
    key: 'admin-dashboard',
    name: 'Admin: dashboard home',
    description: 'The first page after signing in. {name} is replaced with the person’s name.',
    fallback: dashboardText,
  },
  {
    key: 'admin-team',
    name: 'Admin: team page',
    description: 'Invites, access requests and members. Placeholders: {email}, {count}, {date}, {name}.',
    fallback: teamText,
  },
  {
    key: 'admin-models',
    name: 'Admin: content models',
    description: 'The model list and the drag-and-drop model builder.',
    fallback: modelsText,
  },
  {
    key: 'admin-content',
    name: 'Admin: content',
    description: 'The content list and the content editor.',
    fallback: contentText,
  },
  {
    key: 'admin-rich-text',
    name: 'Admin: rich text toolbar',
    description: 'Button names in the rich text editor toolbar.',
    fallback: richTextText,
  },
  {
    key: emailKeys.newSignup,
    name: 'Email: new access request',
    description: 'Sent to super admins. Placeholders: {name}, {email}, {url}.',
    fallback: emailText.newSignup,
  },
  {
    key: emailKeys.approved,
    name: 'Email: access approved',
    description: 'Placeholders: {name}, {url}.',
    fallback: emailText.approved,
  },
  {
    key: emailKeys.rejected,
    name: 'Email: access rejected',
    description: 'Placeholders: {name}.',
    fallback: emailText.rejected,
  },
  {
    key: emailKeys.invite,
    name: 'Email: invitation',
    description: 'Placeholders: {role}, {url}. Role wording comes from the two role fields.',
    fallback: emailText.invite,
  },
  {
    key: 'admin-categories',
    name: 'Admin: categories page',
    description: 'Adding, editing and deleting categories. Placeholders: {count}, {name}.',
    fallback: categoriesText,
  },
  {
    key: 'admin-posts',
    name: 'Admin: posts list',
    description: 'The list of posts, with filters and statuses. Placeholders: {count}, {date}, {name}, {title}.',
    fallback: postsText,
  },
  {
    key: 'admin-post-editor',
    name: 'Admin: post editor',
    description: 'Writing and publishing posts. Placeholders: {count}, {max}.',
    fallback: postEditorText,
  },
  {
    key: 'web-site',
    name: 'Blog: site-wide text',
    description: 'Site name, tagline and footer, used on every page of the blog.',
    fallback: siteText,
  },
  {
    key: 'web-home',
    name: 'Blog: home page',
    description: 'Text on the blog home page.',
    fallback: homeText,
  },
  {
    key: 'web-post',
    name: 'Blog: post page',
    description: 'Labels on a blog post page. Placeholder: {name}.',
    fallback: postText,
  },
  {
    key: 'web-category',
    name: 'Blog: topic pages',
    description: 'The list of topics, and each topic page.',
    fallback: categoryText,
  },
  {
    key: 'web-seo',
    name: 'Blog: SEO and site settings',
    description:
      'Browser title, search description, favicon, share image and search indexing. The title template must contain %s, which becomes the page title.',
    fallback: seoText,
    fieldTypes: { favicon: 'image', shareImage: 'image' },
  },
  {
    key: 'admin-seo',
    name: 'Admin: title, description and favicon',
    description: 'How the admin appears in browser tabs. The admin is always hidden from search engines.',
    fallback: adminSeoText,
    fieldTypes: { favicon: 'image' },
  },
  {
    key: 'web-preview',
    name: 'Blog: draft preview',
    description: 'The banner and messages on private post previews.',
    fallback: previewText,
  },
    {
    key: emailKeys.verifyEmail,
    name: 'Email: confirm email (readers)',
    description: 'Sent when a reader signs up. Placeholders: {name}, {url}.',
    fallback: emailText.verifyEmail,
  },
  {
    key: emailKeys.resetPassword,
    name: 'Email: reset password',
    description: 'Sent when someone asks to reset their password. Placeholders: {name}, {url}.',
    fallback: emailText.resetPassword,
  },
  {
    key: emailKeys.accountExists,
    name: 'Email: account already exists',
    description: 'Sent when someone signs up with an email that already has an account. Placeholders: {name}, {loginUrl}, {resetUrl}.',
    fallback: emailText.accountExists,
  },
];