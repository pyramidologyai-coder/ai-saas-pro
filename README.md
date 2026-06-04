This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Public Chat Authorization

`/api/chat` requires a server-signed public chat token in production. Configure `PUBLIC_CHAT_TOKEN_SECRET` only on the server and send the issued token in the `x-public-chat-token` request header. The token is bound to `tenantId`, the serving host/domain, and an expiry timestamp.

The public widget/page obtains a token from `GET /api/chat/token` before calling `/api/chat`.

- On the configured app host from `NEXT_PUBLIC_APP_URL`, call `/api/chat/token?tenantId=<tenant-uuid>`.
- On a tenant custom domain, call `/api/chat/token`; the server resolves the tenant from `tenants.custom_domain`.
- The endpoint returns a short-lived token and never exposes `PUBLIC_CHAT_TOKEN_SECRET`.

Set `PUBLIC_CHAT_TOKEN_SECRET` in the Vercel/server environment before preview or production traffic is enabled. Do not place this value in browser-exposed env vars or client code.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
