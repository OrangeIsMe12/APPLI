// api/create-checkout-session.js
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { email, userId } = req.body
        if (!email) return res.status(400).json({ error: 'Email requis' })

        const priceId = process.env.STRIPE_PRICE_ID
        if (!priceId) return res.status(500).json({ error: 'STRIPE_PRICE_ID manquant dans les variables Vercel' })

        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: email,
            client_reference_id: userId || null,
            line_items: [{ price: priceId, quantity: 1 }],
            subscription_data: {
                trial_period_days: 30,  // ✅ Change ce chiffre pour modifier le trial
            },
            return_url: `${req.headers.origin || 'https://www.thegolddesk.online'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        })

        return res.status(200).json({ clientSecret: session.client_secret })

    } catch (err) {
        console.error('Stripe error:', err)
        return res.status(500).json({ error: err.message })
    }
}
