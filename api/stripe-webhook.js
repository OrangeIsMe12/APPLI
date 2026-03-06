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

// ✅ Convertit un timestamp Unix en ISO string de façon sécurisée
function safeTimestampToISO(ts) {
    if (!ts || typeof ts !== 'number') return null
    const d = new Date(ts * 1000)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
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

    // ── Checkout complété → abonnement créé ──────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        try {
            if (!data.subscription) return res.json({ received: true })

            const subscription = await stripe.subscriptions.retrieve(data.subscription)

            // ✅ Récupère l'email depuis plusieurs sources possibles
            let email = data.customer_details?.email
            if (!email && subscription.customer) {
                const customer = await stripe.customers.retrieve(subscription.customer)
                email = customer.email
            }
            if (!email) {
                console.error('No email found for subscription', subscription.id)
                return res.json({ received: true })
            }

            // ✅ Récupère client_reference_id (= user_id Supabase envoyé depuis register.html)
            const userId = data.client_reference_id || null

            // ✅ Dates sécurisées — plus jamais de RangeError
            const periodEnd  = safeTimestampToISO(subscription.current_period_end)
            const periodStart = safeTimestampToISO(subscription.current_period_start)
            const createdAt  = safeTimestampToISO(subscription.created)

            console.log('checkout.session.completed:', {
                email, userId,
                status: subscription.status,
                periodEnd, periodStart, createdAt
            })

            const upsertData = {
                email,
                stripe_customer_id:     subscription.customer,
                stripe_subscription_id: subscription.id,
                status:                 subscription.status,
                member_since:           createdAt || new Date().toISOString(),
            }

            // Ajoute les dates seulement si valides
            if (periodEnd)   upsertData.current_period_end   = periodEnd
            if (periodStart) upsertData.current_period_start = periodStart

            // ✅ Lie l'abonnement à l'user Supabase si client_reference_id présent
            if (userId) upsertData.user_id = userId

            await sb.from('subscriptions').upsert(upsertData, { onConflict: 'email' })

            // ✅ Si on a le user_id, met aussi à jour la table auth.users metadata
            if (userId) {
                await sb.auth.admin.updateUserById(userId, {
                    user_metadata: { is_subscribed: true }
                })
            }

        } catch (err) {
            console.error('checkout.session.completed error:', err.message, err.stack)
            return res.json({ received: true })
        }
    }

    // ── Abonnement créé → sauvegarde dans Supabase ───────────────────────────
    // C'est cet événement qui se déclenche quand le Payment Link crée un abonnement
    if (event.type === 'customer.subscription.created') {
        try {
            // Récupère l'email depuis le customer Stripe
            let email = null
            if (data.customer) {
                const customer = await stripe.customers.retrieve(data.customer)
                email = customer.email
            }

            if (!email) {
                console.error('customer.subscription.created: no email found for customer', data.customer)
                return res.json({ received: true })
            }

            const periodEnd   = safeTimestampToISO(data.current_period_end)
            const periodStart = safeTimestampToISO(data.current_period_start)
            const createdAt   = safeTimestampToISO(data.created)

            console.log('customer.subscription.created:', {
                email, status: data.status, periodEnd, createdAt
            })

            const upsertData = {
                email,
                stripe_customer_id:     data.customer,
                stripe_subscription_id: data.id,
                status:                 data.status,
                member_since:           createdAt || new Date().toISOString(),
            }

            if (periodEnd)   upsertData.current_period_end   = periodEnd
            if (periodStart) upsertData.current_period_start = periodStart

            // ✅ Cherche si on a un user Supabase avec cet email pour lier le user_id
            const { data: existingUser } = await sb
                .from('subscriptions')
                .select('user_id')
                .eq('email', email)
                .single()

            if (existingUser?.user_id) {
                upsertData.user_id = existingUser.user_id
            }

            await sb.from('subscriptions').upsert(upsertData, { onConflict: 'email' })

        } catch (err) {
            console.error('customer.subscription.created error:', err.message, err.stack)
            return res.json({ received: true })
        }
    }

    // ── Abonnement mis à jour (renouvellement, changement de statut) ──────────
    if (event.type === 'customer.subscription.updated') {
        try {
            const periodEnd  = safeTimestampToISO(data.current_period_end)
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

    // ── Paiement reçu → enregistre dans payments ─────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
        try {
            let email = data.customer_email
            if (!email && data.customer) {
                const customer = await stripe.customers.retrieve(data.customer)
                email = customer.email
            }

            if (!email) return res.json({ received: true })

            // ✅ Date de paiement sécurisée
            const paidAt = safeTimestampToISO(data.status_transitions?.paid_at)
                        || new Date().toISOString()

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

            // ✅ Met aussi à jour current_period_end dans subscriptions
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
