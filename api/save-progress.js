// api/save-progress.js
// Endpoint: POST /api/save-progress

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        // L'API reçoit l'email et un objet 'data' contenant les champs à mettre à jour
        const { email, data } = req.body; 

        if (!email || !data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'Email et données à mettre à jour sont requis.' });
        }
        
        const userKey = `user:${email.toLowerCase()}`;

        // 1. Récupérer les données existantes
        let user = await kv.get(userKey);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
        }

        // 2. Fusionner les données reçues (data) avec les données existantes (user)
        const updatedUser = {
            ...user,
            ...data, // Écrase les champs existants (level, feeling, duration, lastLessonDate)
            updatedAt: new Date().toISOString() // Marque de temps de la dernière mise à jour
        };

        // 3. Sauvegarder l'objet utilisateur mis à jour
        await kv.set(userKey, updatedUser);

        return res.status(200).json({ success: true, message: 'Progression et paramètres sauvegardés avec succès.' });

    } catch (error) {
        console.error('Save Progress Error:', error);
        return res.status(500).json({ success: false, message: 'Erreur interne du serveur lors de la sauvegarde de la progression.' });
    }
}
