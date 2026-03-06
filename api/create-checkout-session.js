// api/create-portal-session.js
// ─────────────────────────────────────────────────────────────
// Fonction Vercel — ouvre le portail Stripe pour gérer
// la carte de paiement et résilier l'abonnement
// Variables d'environnement requises dans Vercel :
//   STRIPE_SECRET_KEY      → sk_live_...
//   NEXT_PUBLIC_SITE_URL   → https://www.thegolddesk.online
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
        const { customerId } = req.body
        if (!customerId) {
            return res.status(400).json({ error: 'customerId requis' })
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${req.headers.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thegolddesk.online'}/dashboard.html`,
        })

        return res.status(200).json({ url: session.url })

    } catch (err) {
        console.error('Stripe portal error:', err)
        return res.status(500).json({ error: err.message })
    }
}
