const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const securityMiddleware = [
    helmet(),
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true
    }),
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    })
];

module.exports = securityMiddleware;