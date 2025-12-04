// api/login.js
// Endpoint: POST /api/login

import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { email, password } = req.body;
        const userKey = `user:${email.toLowerCase()}`;

        // 1. Récupérer les données de l'utilisateur
        let user = await kv.get(userKey);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Email ou mot de passe incorrect.' });
        }

        // 2. Vérification sécurisée du mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
        }

        // 3. LOGIQUE DE MISE À JOUR DU STREAK (Gamification)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Date du jour à minuit
        
        let updateNeeded = false;
        
        const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
        let lastLoginTime = lastLogin ? lastLogin.getTime() : 0;

        if (lastLoginTime < today.getTime()) {
            // L'utilisateur ne s'est pas connecté AUJOURD'HUI
            
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            
            if (lastLogin && lastLoginTime === yesterday.getTime()) {
                // Connexion consécutive (Hier)
                user.streak++;
                updateNeeded = true;
            } else if (lastLoginTime < yesterday.getTime()) {
                // Coupure (Avant-hier ou plus)
                user.streak = 1; // Réinitialisation
                updateNeeded = true;
            } else if (!lastLogin) {
                // Première connexion
                user.streak = 1;
                updateNeeded = true;
            }

            // Mettre à jour la date de connexion (même si le streak n'a pas changé, on log la connexion)
            user.lastLogin = today.toISOString();
            updateNeeded = true;
        }


        // 4. Sauvegarder les changements dans la base de données
        if (updateNeeded) {
            await kv.set(userKey, user);
        }
        
        // 5. Retourner l'objet utilisateur (sans le hash du mot de passe)
        const { passwordHash, ...safeUser } = user;

        return res.status(200).json({ success: true, user: safeUser, message: 'Connexion réussie.' });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur lors de la connexion.' });
    }
}
