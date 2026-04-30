# 🚀 2126 Multi-Tenant SaaS Deployment Checklist

Welcome to Phase Zero. Follow this checklist exactly to ensure your "Digital Fortress" boots up without a hitch in production.

## 1. Environment Variables (`.env.production`)
These must be added to your hosting provider (Vercel, AWS, etc.):

```env
# ==========================================
# 1. CORE NEXT.JS & SUPABASE
# ==========================================
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..." # KEEP SECRET! Server-side only.

# ==========================================
# 2. AI INTEGRATIONS (OPENAI / GEMINI)
# ==========================================
GOOGLE_API_KEY="AIzaSy..." # For Gemini 1.5 Pro
# OPENAI_API_KEY="sk-..." # (If using OpenAI instead)

# ==========================================
# 3. BACKGROUND WORKER & CACHING
# ==========================================
# If using Upstash/Redis for WhatsApp Queue & Rate Limiting
# UPSTASH_REDIS_REST_URL="https://..."
# UPSTASH_REDIS_REST_TOKEN="..."

# ==========================================
# 4. PLATFORM URL
# ==========================================
NEXT_PUBLIC_SITE_URL="https://your-main-saas-domain.com"
```

## 2. Zero Trust KMS Variables (Stored Securely in DB/Vault)
Instead of putting these in `.env`, the system is built to read them from the **KMS (Key Management System)**. Make sure these exist in your KMS (or as fallback in `.env` if you haven't fully migrated the vault yet):

- `STRIPE_SECRET_KEY`: Your Master Payment Key.
- `STRIPE_WEBHOOK_SECRET`: Used to verify Stripe payments.
- `META_APP_SECRET`: Used to verify the `X-Hub-Signature-256` of WhatsApp Webhooks.
- `STRIPE_SECRET_KEY_V2`: (For Key Rotation) Your new Master Key used to encrypt WhatsApp `meta_token` with AES-256-GCM.

## 3. Database Pre-Flight
- [ ] Run the `supabase-master-migration.sql` script in your Supabase SQL Editor to guarantee all tables, indexes, and RLS policies are active.
- [ ] Ensure the `audit_logs` table is empty before launching, so you have a clean slate.

## 4. The Big Red Button
- Run `node scripts/big_red_button.js` in your terminal after deployment.
- If it prints **"ALL SYSTEMS GO"**, you are officially live.
