// /api/create-portal-session.js
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const { customerId } = req.body

    // ✅ Vérifie que le customerId est bien présent
    if (!customerId) {
        return res.status(400).json({ error: 'customerId manquant.' })
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: 'https://www.thegolddesk.online/dashboard.html',
        })
        return res.json({ url: session.url })

    } catch (err) {
        console.error('create-portal-session error:', err.message)
        return res.status(500).json({ error: err.message })
    }
}
