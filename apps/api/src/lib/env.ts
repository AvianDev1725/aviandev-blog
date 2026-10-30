/**
 * Checks the API's settings at startup. Never prints a value, only names.
 * Production: stops the server if something is missing or weak.
 * Development: only warns, so local work isn't blocked.
 */

type Problem = string;

const MIN_SECRET_LENGTH = 32;

const value = (name: string) => process.env[name]?.trim() ?? '';

function requireSet(name: string, problems: Problem[]) {
    if (!value(name)) problems.push(`${name} is not set`);
}

function requireSecret(name: string, problems: Problem[]) {
    const secret = value(name);
    if (!secret) problems.push(`${name} is not set`);
    else if (secret.length < MIN_SECRET_LENGTH) problems.push(`${name} is too short (use at least ${MIN_SECRET_LENGTH} characters)`);
}

function requireHttpsUrl(name: string, problems: Problem[], production: boolean) {
    const raw = value(name);
    if (!raw) return problems.push(`${name} is not set`);
    for (const part of raw.split(',').map((item) => item.trim()).filter(Boolean)) {
        try {
            const url = new URL(part);
            if (production && url.protocol !== 'https:') problems.push(`${name} must use https:// in production`);
        } catch {
            problems.push(`${name} contains an invalid URL`);
        }
    }
}

export function checkEnv() {
    const production = process.env.NODE_ENV === 'production';
    const problems: Problem[] = [];
    const warnings: string[] = [];

    // Database
    requireSet('DATABASE_URL', problems);
    if (value('DATABASE_URL') && !/^postgres(ql)?:\/\//.test(value('DATABASE_URL'))) problems.push('DATABASE_URL must start with postgres://');

    // Secrets
    requireSecret('VIEW_SECRET', problems);
    requireSecret('PREVIEW_SECRET', problems);
    requireSecret('REVALIDATE_SECRET', problems);

    // Addresses used in emails, links and cache refresh
    requireHttpsUrl('BLOG_URL', problems, production);
    requireHttpsUrl('ADMIN_URL', problems, production);
    requireHttpsUrl('REVALIDATE_URLS', problems, production);

    // Email
    const provider = value('EMAIL_PROVIDER').toLowerCase() || 'console';
    if (provider === 'gmail') {
        requireSet('GMAIL_USER', problems);
        requireSet('GMAIL_APP_PASSWORD', problems);
    } else if (provider === 'resend') {
        requireSet('RESEND_API_KEY', problems);
        requireSet('EMAIL_FROM', problems);
    } else if (production) {
        problems.push('EMAIL_PROVIDER must be gmail or resend in production (emails would not be sent)');
    }

    // Image storage: all or nothing
    const s3 = ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'];
    const s3Set = s3.filter((name) => value(name));
    if (s3Set.length > 0 && s3Set.length < s3.length) {
        problems.push(`Storage settings are incomplete: missing ${s3.filter((name) => !value(name)).join(', ')}`);
    }

    // Search embeddings
    const embeddings = value('EMBEDDINGS').toLowerCase() || 'local';
    if (embeddings === 'cloudflare') {
        requireSet('CLOUDFLARE_ACCOUNT_ID', problems);
        requireSet('CLOUDFLARE_AI_TOKEN', problems);
    } else if (process.env.VERCEL && embeddings !== 'fake') {
        problems.push('EMBEDDINGS must be cloudflare on Vercel (the local model is too large)');
    }

    // Optional
    if (!value('GROQ_API_KEY')) warnings.push('GROQ_API_KEY is not set: Ask AvianDev will be unavailable');
    const hops = value('TRUSTED_PROXY_HOPS');
    if (hops && !/^[0-5]$/.test(hops)) problems.push('TRUSTED_PROXY_HOPS must be a number from 0 to 5');

    for (const warning of warnings) console.warn(`[env] ${warning}`);

    if (problems.length === 0) return;

    const list = problems.map((problem) => `  - ${problem}`).join('\n');
    if (production) {
        console.error(`[env] The API can't start. Fix these settings:\n${list}`);
        process.exit(1);
    }
    console.warn(`[env] Settings to fix before going live:\n${list}`);
}