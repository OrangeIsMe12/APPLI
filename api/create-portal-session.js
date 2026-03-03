// /api/create-portal-session.js
const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

module.exports.default = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const { customerId } = req.body
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: 'https://www.thegolddesk.online/dashboard.html',
    })

    res.json({ url: session.url })
}
