// api/create-checkout-session.js
// ─────────────────────────────────────────────────────────────
// Fonction Vercel — crée une session Stripe Embedded Checkout
// Variables d'environnement requises dans Vercel :
//   STRIPE_SECRET_KEY  → ta clé secrète Stripe (sk_live_...)
// ─────────────────────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { email, userId } = req.body

        if (!email) {
            return res.status(400).json({ error: 'Email requis' })
        }

        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: email,
            client_reference_id: userId || null,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'The Pro Xau — Premium',
                            description: 'Accès complet à toutes les éditions hebdomadaires.',
                        },
                        unit_amount: 999, // 9.99$ en cents
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            // ── FREE TRIAL ──
            subscription_data: {
                trial_period_days: 7, // Retire cette ligne si pas de trial
            },
            return_url: `${req.headers.origin || 'https://www.thegolddesk.online/'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        })

        return res.status(200).json({ clientSecret: session.client_secret })

    } catch (err) {
        console.error('Stripe error:', err)
        return res.status(500).json({ error: err.message })
    }
}
