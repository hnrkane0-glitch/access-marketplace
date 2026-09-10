# Before this will fully work on your live site

The code fixes in this zip stop the app from crashing/showing a blank error
page. But there are 2 things only YOU can do (I don't have access to your
Vercel account or database), and without them, sign up and the dashboards
will still not fully work — people just won't see a broken white page
anymore.

## 1. Push the database changes (the most important step)

Your database is missing the new `Subscription` table (and related fields)
that the Starter/Eternal/Pro plans use. To fix this:

1. On your computer (or anywhere you can run terminal commands), open this
   project folder.
2. Run:
   ```
   npm install
   ```
3. Make sure you have a `.env` file (copy `.env.example` to `.env`) with your
   REAL `DATABASE_URL` in it — the same database your live Vercel site uses.
4. Run:
   ```
   npx prisma db push
   ```
   This updates your real database to match the new plan/subscription
   system, without deleting your existing users, listings, or bookings.

If you're not comfortable running terminal commands, ask whoever manages
your Vercel/database (or send me your DATABASE_URL setup questions — never
paste the actual URL/password here) and I can walk you through it step by
step.

## 2. Set these in Vercel → your project → Settings → Environment Variables

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Your database connection |
| `SESSION_SECRET` | Keeps logins secure — any long random string |
| `PAYSTACK_SECRET_KEY` | From your Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | From your Paystack dashboard |
| `PAYSTACK_PLAN_STARTER` | `PLN_4fj6ah6f5oo2tlx` |
| `PAYSTACK_PLAN_ETERNAL` | `PLN_moo8asxaof1nqjl` |
| `PAYSTACK_PLAN_PRO` | `PLN_w7pnequ8jp3hc5d` |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `EMAIL_FROM` | Use `Access Marketplace <onboarding@resend.dev>` until you buy a domain |
| `ADMIN_NOTIFICATION_EMAIL` | `hnrkane0@gmail.com` |

After adding/changing env vars in Vercel, you need to **redeploy** — Vercel
doesn't apply new env vars to a deployment that's already running.

## 3. After both of these are done

Try signing up again on your real production link
(`access-marketplace.vercel.app`, not a preview link). If you still see an
error, send me a screenshot — with these fixes, the error message itself
will now be much more specific and useful.
