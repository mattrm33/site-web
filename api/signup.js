// api/signup.js
// Endpoint: POST /api/signup

import { kv } from '@vercel/kv'; // Client Vercel KV
import bcrypt from 'bcryptjs'; // Pour le hachage sécurisé

// Le nombre de tours de salage (salt rounds) pour bcrypt
const SALT_ROUNDS = 10;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe sont requis.' });
        }

        const userKey = `user:${email.toLowerCase()}`;
        
        // 1. Vérifier si l'utilisateur existe déjà
        const existingUser = await kv.get(userKey);
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Cet utilisateur existe déjà.' });
        }

        // 2. Hacher le mot de passe de manière sécurisée
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 3. Créer l'objet utilisateur initial
        const newUser = {
            email: email.toLowerCase(),
            passwordHash: passwordHash,
            level: '1ère année',
            feeling: '_',
            duration: 20,
            streak: 0,
            lastLogin: null,        // Date de la dernière connexion (pour le streak)
            lastLessonDate: null,   // Date de la dernière leçon complétée (pour empêcher double session)
            createdAt: new Date().toISOString(),
        };
        
        // 4. Stocker le nouvel utilisateur dans Vercel KV
        await kv.set(userKey, newUser);

        // 5. Réponse de succès
        return res.status(201).json({ success: true, message: 'Inscription réussie. Vous pouvez maintenant vous connecter.' });

    } catch (error) {
        console.error('Signup Error:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur lors de l\'inscription.' });
    }
}
