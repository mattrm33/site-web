// api/signup.js
// Endpoint: POST /api/signup
// Rôle: Créer un nouvel utilisateur avec un mot de passe haché et des valeurs initiales.

import { kv } from '@vercel/kv'; // Nécessite l'installation du client Vercel KV
import bcrypt from 'bcryptjs'; // Nécessite l'installation de bcryptjs

// Le nombre de tours de salage (salt rounds) pour bcrypt - un bon équilibre entre sécurité et performance
const SALT_ROUNDS = 10;

export default async function handler(req, res) {
    // S'assurer que la méthode HTTP est POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe sont requis.' });
        }
        
        // Utiliser l'email en minuscules comme clé unique
        const userKey = `user:${email.toLowerCase()}`;
        
        // 1. Vérifier si l'utilisateur existe déjà
        const existingUser = await kv.get(userKey);
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Cet email est déjà enregistré.' });
        }

        // 2. Hacher le mot de passe de manière sécurisée
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 3. Créer l'objet utilisateur initial
        const newUser = {
            email: email.toLowerCase(),
            passwordHash: passwordHash, // NE JAMAIS RETOURNER CE HASH AU CLIENT
            
            // Paramètres de l'utilisateur par défaut
            level: '1ère année',
            feeling: '_',
            duration: 20,
            
            // Statistiques de Gamification
            streak: 0,
            lastLogin: null,        
            lastLessonDate: null,
            
            createdAt: new Date().toISOString(),
        };
        
        // 4. Stocker l'utilisateur dans Vercel KV
        await kv.set(userKey, newUser);

        // 5. Réponse de succès (sans mot de passe/hash)
        return res.status(201).json({ success: true, message: 'Inscription réussie. Veuillez vous connecter.' });

    } catch (error) {
        console.error('SERVERLESS - Signup Error:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur lors de l\'inscription. (Vérifiez la connexion KV).' });
    }
}
