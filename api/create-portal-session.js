// api/create-portal-session.js
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { customerId } = req.body
        if (!customerId) return res.status(400).json({ error: 'customerId requis' })

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${req.headers.origin || 'https://www.thegolddesk.online'}/dashboard.html`,
        })

        return res.status(200).json({ url: session.url })

    } catch (err) {
        console.error('Stripe portal error:', err)
        return res.status(500).json({ error: err.message })
    }
}
