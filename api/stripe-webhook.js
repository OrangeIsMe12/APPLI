// /api/stripe-webhook.js
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
    })
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

    // ── Checkout complété → abonnement créé ──────────────────
    if (event.type === 'checkout.session.completed') {
        try {
            if (!data.subscription) return res.json({ received: true })

            const subscription = await stripe.subscriptions.retrieve(data.subscription)
            const email = data.customer_details?.email
                || (await stripe.customers.retrieve(subscription.customer)).email

            if (!email) return res.json({ received: true })

            await sb.from('subscriptions').upsert({
                email,
                stripe_customer_id:     subscription.customer,
                stripe_subscription_id: subscription.id,
                status:                 subscription.status,
                current_period_end:     new Date(subscription.current_period_end * 1000).toISOString(),
                member_since:           new Date(subscription.created * 1000).toISOString(),
            }, { onConflict: 'email' })

        } catch (err) {
            console.error('checkout.session.completed error:', err.message)
            return res.json({ received: true })
        }
    }

    // ── Paiement reçu → enregistre dans payments ─────────────
    if (event.type === 'invoice.payment_succeeded') {
        try {
            // ✅ FIX : essaie d'abord customer_email (évite un appel API)
            const email = data.customer_email
                || (await stripe.customers.retrieve(data.customer)).email

            if (!email) return res.json({ received: true })

            await sb.from('payments').insert({
                stripe_customer_id: data.customer,
                email,
                amount:      data.amount_paid / 100,
                currency:    data.currency.toUpperCase(),
                status:      'paid',
                description: 'The Pro Xau — Premium',
                invoice_pdf: data.invoice_pdf,
                paid_at:     data.status_transitions?.paid_at
                    ? new Date(data.status_transitions.paid_at * 1000).toISOString()
                    : new Date().toISOString()
            })

        } catch (err) {
            console.error('invoice.payment_succeeded error:', err.message)
            return res.json({ received: true })
        }
    }

    // ── Abonnement annulé ─────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
        try {
            const customer = await stripe.customers.retrieve(data.customer)
            await sb.from('subscriptions')
                .update({ status: 'canceled' })
                .eq('email', customer.email)
        } catch (err) {
            console.error('subscription.deleted error:', err.message)
        }
    }

    return res.json({ received: true })
}
