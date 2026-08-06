"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = void 0;
const firebase_admin_1 = require("../lib/firebase-admin");
const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};
exports.verifyAuth = verifyAuth;
