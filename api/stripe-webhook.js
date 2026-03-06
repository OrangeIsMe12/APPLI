// /api/stripe-webhook.js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
    })
}

function safeTimestampToISO(ts) {
    if (!ts || typeof ts !== 'number') return null
    const d = new Date(ts * 1000)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
}

// ── Template email confirmation ───────────────────────────────────────────────
function emailTemplate({ firstName, email, trialEnd }) {
    const date = trialEnd
        ? new Date(trialEnd * 1000).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
        : null

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenue dans The Pro Xau</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- HEADER -->
        <tr>
          <td style="padding-bottom:32px;text-align:center;border-bottom:1px solid #1e1a10;">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#c9a84c;letter-spacing:-0.5px;">The Pro Xau</div>
            <div style="font-family:monospace;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#4a4038;margin-top:6px;">Newsletter Premium · Or & Marchés</div>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td style="padding:44px 0 32px;text-align:center;border-bottom:1px solid #1e1a10;">
            <div style="font-size:48px;margin-bottom:20px;">✓</div>
            <div style="font-family:monospace;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#4caf7d;margin-bottom:16px;">Abonnement confirmé</div>
            <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:700;color:#e8e0d0;line-height:1.1;letter-spacing:-1px;margin:0 0 16px;">
              Bienvenue,<br><span style="color:#e8c97a;font-style:italic;">${firstName || 'trader'}</span>
            </h1>
            <p style="font-size:14px;color:#9a9080;line-height:1.8;margin:0;max-width:420px;display:inline-block;">
              Ton abonnement <strong style="color:#c9a84c;">The Pro Xau Premium</strong> est maintenant actif. Tu as accès à toutes les éditions et services inclus.
            </p>
          </td>
        </tr>

        <!-- TRIAL INFO -->
        ${date ? `
        <tr>
          <td style="padding:28px 0;border-bottom:1px solid #1e1a10;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(76,175,125,0.06);border:1px solid rgba(76,175,125,0.2);border-left:3px solid #4caf7d;">
              <tr>
                <td style="padding:18px 24px;">
                  <div style="font-family:monospace;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#4caf7d;margin-bottom:8px;">Période d'essai gratuite</div>
                  <div style="font-size:14px;color:#9a9080;line-height:1.7;">
                    Tu bénéficies de <strong style="color:#e8e0d0;">30 jours gratuits</strong>. Aucun montant ne sera débité avant le <strong style="color:#e8c97a;">${date}</strong>. Tu peux annuler à tout moment avant cette date.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ` : ''}

        <!-- FEATURES -->
        <tr>
          <td style="padding:32px 0;border-bottom:1px solid #1e1a10;">
            <div style="font-family:monospace;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#c9a84c;opacity:0.6;margin-bottom:20px;">Ce qui est inclus</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:10px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;font-size:18px;">📰</td>
                  <td><div style="font-size:13px;color:#e8e0d0;font-weight:600;margin-bottom:3px;">Newsletter hebdomadaire</div><div style="font-size:12px;color:#4a4038;">Analyse XAU/USD chaque vendredi soir</div></td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;font-size:18px;">📊</td>
                  <td><div style="font-size:13px;color:#e8e0d0;font-weight:600;margin-bottom:3px;">Analyse technique complète</div><div style="font-size:12px;color:#4a4038;">Niveaux clés, supports et résistances</div></td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;font-size:18px;">🎯</td>
                  <td><div style="font-size:13px;color:#e8e0d0;font-weight:600;margin-bottom:3px;">Setups de la semaine</div><div style="font-size:12px;color:#4a4038;">Scénarios bullish & bearish avec entrées et cibles</div></td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;font-size:18px;">🔵</td>
                  <td><div style="font-size:13px;color:#e8e0d0;font-weight:600;margin-bottom:3px;">Discord privé</div><div style="font-size:12px;color:#4a4038;">Accès au serveur privé du coach</div></td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:14px;font-size:18px;">📚</td>
                  <td><div style="font-size:13px;color:#e8e0d0;font-weight:600;margin-bottom:3px;">Toutes les éditions</div><div style="font-size:12px;color:#4a4038;">Accès à tout l'archive des publications</div></td>
                </tr></table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:36px 0;text-align:center;border-bottom:1px solid #1e1a10;">
            <a href="https://www.thegolddesk.online/dashboard.html"
               style="display:inline-block;background:#c9a84c;color:#080804;font-family:monospace;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:16px 36px;text-decoration:none;">
              Accéder à mon compte →
            </a>
            <div style="margin-top:16px;">
              <a href="https://www.thegolddesk.online/index.html"
                 style="font-family:monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a4038;text-decoration:none;">
                Voir les éditions →
              </a>
            </div>
          </td>
        </tr>

        <!-- DETAILS -->
        <tr>
          <td style="padding:28px 0;border-bottom:1px solid #1e1a10;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-right:16px;">
                  <div style="font-family:monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#4a4038;margin-bottom:6px;">Montant</div>
                  <div style="font-family:monospace;font-size:13px;color:#e8c97a;">9.99$ USD / mois</div>
                </td>
                <td width="50%">
                  <div style="font-family:monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#4a4038;margin-bottom:6px;">Email du compte</div>
                  <div style="font-family:monospace;font-size:13px;color:#9a9080;">${email}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding-top:32px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:18px;color:#1e1a10;margin-bottom:12px;">THE PRO XAU</div>
            <div style="font-family:monospace;font-size:9px;color:#1e1a10;letter-spacing:2px;">
              © 2026 THE PRO XAU · TOUS DROITS RÉSERVÉS<br>
              <span style="color:#2a2318;">Contenu éducatif uniquement · Pas de conseil financier</span>
            </div>
            <div style="margin-top:16px;">
              <a href="https://www.thegolddesk.online/dashboard.html" style="font-family:monospace;font-size:9px;color:#2a2318;text-decoration:none;margin:0 8px;">Mon compte</a>
              <a href="https://www.thegolddesk.online/privacy.html" style="font-family:monospace;font-size:9px;color:#2a2318;text-decoration:none;margin:0 8px;">Confidentialité</a>
              <a href="https://www.thegolddesk.online/terms.html" style="font-family:monospace;font-size:9px;color:#2a2318;text-decoration:none;margin:0 8px;">Conditions</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`
}

// ── Envoi email confirmation ──────────────────────────────────────────────────
async function sendWelcomeEmail({ email, firstName, trialEnd }) {
    try {
        await resend.emails.send({
            from: 'The Pro Xau <noreply@thegolddesk.online>',
            to: email,
            subject: '✓ Bienvenue dans The Pro Xau — Abonnement confirmé',
            html: emailTemplate({ firstName, email, trialEnd }),
        })
        console.log('Email de bienvenue envoyé à:', email)
    } catch (err) {
        console.error('Resend error:', err.message)
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const sig = req.headers['stripe-signature']
    const rawBody = await getRawBody(req)

    let event
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
        console.error('Webhook signature failed:', err.message)
        return res.status(400).send('Webhook Error: ' + err.message)
    }

    const data = event.data.object

    // ── Checkout complété ─────────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        try {
            if (!data.subscription) return res.json({ received: true })

            const subscription = await stripe.subscriptions.retrieve(data.subscription)

            let email = data.customer_details?.email
            let firstName = null
            if (!email && subscription.customer) {
                const customer = await stripe.customers.retrieve(subscription.customer)
                email = customer.email
                firstName = customer.name?.split(' ')[0] || null
            }
            if (!email) {
                console.error('No email found for subscription', subscription.id)
                return res.json({ received: true })
            }

            // Récupère le prénom depuis customer si pas encore fait
            if (!firstName && subscription.customer) {
                const customer = await stripe.customers.retrieve(subscription.customer)
                firstName = customer.name?.split(' ')[0] || null
            }

            const userId = data.client_reference_id || null
            const periodEnd   = safeTimestampToISO(subscription.current_period_end)
            const periodStart = safeTimestampToISO(subscription.current_period_start)
            const createdAt   = safeTimestampToISO(subscription.created)

            const upsertData = {
                email,
                stripe_customer_id:     subscription.customer,
                stripe_subscription_id: subscription.id,
                status:                 subscription.status,
                member_since:           createdAt || new Date().toISOString(),
            }
            if (periodEnd)   upsertData.current_period_end   = periodEnd
            if (periodStart) upsertData.current_period_start = periodStart
            if (userId)      upsertData.user_id = userId

            await sb.from('subscriptions').upsert(upsertData, { onConflict: 'email' })

            if (userId) {
                await sb.auth.admin.updateUserById(userId, {
                    user_metadata: { is_subscribed: true }
                })
            }

            // ✅ Envoie l'email de bienvenue
            await sendWelcomeEmail({ email, firstName, trialEnd: subscription.trial_end })

        } catch (err) {
            console.error('checkout.session.completed error:', err.message, err.stack)
            return res.json({ received: true })
        }
    }

    // ── Abonnement créé ───────────────────────────────────────────────────────
    if (event.type === 'customer.subscription.created') {
        try {
            let email = null
            let firstName = null
            if (data.customer) {
                const customer = await stripe.customers.retrieve(data.customer)
                email = customer.email
                firstName = customer.name?.split(' ')[0] || null
            }

            if (!email) {
                console.error('customer.subscription.created: no email found', data.customer)
                return res.json({ received: true })
            }

            const periodEnd   = safeTimestampToISO(data.current_period_end)
            const periodStart = safeTimestampToISO(data.current_period_start)
            const createdAt   = safeTimestampToISO(data.created)

            const upsertData = {
                email,
                stripe_customer_id:     data.customer,
                stripe_subscription_id: data.id,
                status:                 data.status,
                member_since:           createdAt || new Date().toISOString(),
            }
            if (periodEnd)   upsertData.current_period_end   = periodEnd
            if (periodStart) upsertData.current_period_start = periodStart

            const { data: existingUser } = await sb
                .from('subscriptions')
                .select('user_id')
                .eq('email', email)
                .single()

            if (existingUser?.user_id) upsertData.user_id = existingUser.user_id

            await sb.from('subscriptions').upsert(upsertData, { onConflict: 'email' })

            // ✅ Envoie l'email de bienvenue
            await sendWelcomeEmail({ email, firstName, trialEnd: data.trial_end })

        } catch (err) {
            console.error('customer.subscription.created error:', err.message, err.stack)
            return res.json({ received: true })
        }
    }

    // ── Abonnement mis à jour ─────────────────────────────────────────────────
    if (event.type === 'customer.subscription.updated') {
        try {
            const periodEnd   = safeTimestampToISO(data.current_period_end)
            const periodStart = safeTimestampToISO(data.current_period_start)

            const updateData = { status: data.status }
            if (periodEnd)   updateData.current_period_end   = periodEnd
            if (periodStart) updateData.current_period_start = periodStart

            await sb.from('subscriptions')
                .update(updateData)
                .eq('stripe_subscription_id', data.id)

        } catch (err) {
            console.error('customer.subscription.updated error:', err.message)
        }
    }

    // ── Paiement reçu ─────────────────────────────────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
        try {
            let email = data.customer_email
            if (!email && data.customer) {
                const customer = await stripe.customers.retrieve(data.customer)
                email = customer.email
            }
            if (!email) return res.json({ received: true })

            const paidAt = safeTimestampToISO(data.status_transitions?.paid_at) || new Date().toISOString()

            await sb.from('payments').insert({
                stripe_customer_id: data.customer,
                email,
                amount:      (data.amount_paid || 0) / 100,
                currency:    (data.currency || 'usd').toUpperCase(),
                status:      'paid',
                description: 'The Pro Xau — Premium',
                invoice_pdf: data.invoice_pdf || null,
                paid_at:     paidAt
            })

            if (data.subscription) {
                const subscription = await stripe.subscriptions.retrieve(data.subscription)
                const periodEnd = safeTimestampToISO(subscription.current_period_end)
                if (periodEnd) {
                    await sb.from('subscriptions')
                        .update({ current_period_end: periodEnd, status: subscription.status })
                        .eq('stripe_subscription_id', data.subscription)
                }
            }

        } catch (err) {
            console.error('invoice.payment_succeeded error:', err.message)
            return res.json({ received: true })
        }
    }

    // ── Abonnement annulé ─────────────────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
        try {
            await sb.from('subscriptions')
                .update({ status: 'canceled' })
                .eq('stripe_subscription_id', data.id)
        } catch (err) {
            console.error('subscription.deleted error:', err.message)
        }
    }

    return res.json({ received: true })
}
