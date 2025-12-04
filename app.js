// app.js

// ====================================================================
// 1. État Global et Constantes
// ====================================================================

const API_BASE = '/api'; // Endpoints Vercel Serverless
const USER_KEY = 'studyStreakUser'; // Clé pour localStorage

// État de l'application (sauvegardé côté client pour UX, synchronisé avec le serveur)
let appState = {
    isAuthenticated: false,
    user: null, // Contient: { email, level, feeling, duration, streak, lastLogin, lastLessonDate }
    currentLesson: [], // Les étapes de la leçon du jour
    currentStepIndex: 0,
    isLessonComplete: false,
};

// Messages motivateurs (Indexés par jour ou choisis aléatoirement)
const MOTTO_LIST = [
    "Le droit est une discipline, pas un sprint ! Avancez pas à pas.",
    "La jurisprudence d'aujourd'hui est la loi de demain. Soyez à jour !",
    "Nul n'est censé ignorer la loi. Mais vous, vous la maîtriserez !",
    "Un petit effort quotidien vaut mieux que de grandes peurs la veille de l'examen.",
    "Le succès est la somme de petits efforts répétés jour après jour. Continuez !",
];

// Structure des exercices (adaptés au niveau)
const EXERCISES_DATA = {
    '1ère année': {
        qcm: [
            { q: "Qu'est-ce qu'une personne morale ?", a: "Un groupement doté de la personnalité juridique.", options: ["Un citoyen", "Une personne décédée", "Un groupement doté de la personnalité juridique.", "Un bien mobilier"] },
        ],
        flashcard: [
            { front: "Définition : Force majeure", back: "Événement imprévisible, irrésistible et extérieur qui exonère de responsabilité." },
        ],
        caseStudy: [
            { q: "Votre voisin fait une fête très bruyante. Quel type de trouble cela peut-il engendrer ?", hint: "Répondez en 2 phrases." },
        ]
    },
    '2ème année': {
        qcm: [
            { q: "Quelle est la durée de la prescription en matière civile ?", a: "5 ans.", options: ["30 ans", "10 ans", "5 ans.", "1 an"] },
        ],
        flashcard: [
            { front: "Définition : Revirement de jurisprudence", back: "Changement par une Cour de cassation ou un Conseil d'État de l'interprétation d'une règle de droit qu'elle appliquait auparavant." },
        ],
        caseStudy: [
            { q: "Expliquez l'impact d'un arrêt de la Cour de Cassation sur les juridictions inférieures.", hint: "Niveau moyen. Répondez en 4-5 phrases, mentionnez la 'légitimité'." },
        ]
    },
    '3ème année': {
        qcm: [
            { q: "Quel est l'effet principal d'une QPC (Question Prioritaire de Constitutionnalité) acceptée ?", a: "Abrogation de la disposition législative si jugée contraire à la Constitution.", options: ["Modification de la Constitution", "Abrogation de la disposition législative si jugée contraire à la Constitution.", "Renvoi devant la Cour de Justice de l'Union Européenne", "Création d'une nouvelle loi"] },
        ],
        flashcard: [
            { front: "Définition : Théorie de l'imprévision (droit des contrats)", back: "Mécanisme permettant la renégociation ou la résolution d'un contrat si un changement de circonstances imprévisible rend l'exécution excessivement onéreuse pour une partie." },
        ],
        caseStudy: [
            { q: "Analysez la portée de l'arrêt Blanco de 1873 sur la dualité de juridiction en droit public.", hint: "Niveau expert. Citez la nature de la responsabilité de l'État." },
        ]
    }
};


// ====================================================================
// 2. Gestion de l'UI (Affichage des Écrans et Messages)
// ====================================================================

/**
 * Change l'écran actuellement visible.
 * @param {string} screenId - L'ID du nouvel écran (ex: 'auth-screen').
 */
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

/**
 * Affiche un message de succès ou d'erreur.
 * @param {string} message - Le texte à afficher.
 * @param {boolean} isSuccess - Vrai pour succès, Faux pour erreur.
 */
function displayMessage(message, isSuccess) {
    const messageArea = document.getElementById('message-area');
    messageArea.textContent = message;
    messageArea.className = ''; // Réinitialiser les classes
    messageArea.classList.add(isSuccess ? 'success' : 'error');
    messageArea.style.display = 'block';

    setTimeout(() => {
        messageArea.style.display = 'none';
    }, 5000);
}


// ====================================================================
// 3. Authentification & Stockage (Client & API Simulé)
// ====================================================================

/**
 * Simule un appel API (remplace `fetch`).
 * @param {string} endpoint - /api/signup, /api/login, etc.
 * @param {object} payload - Les données à envoyer.
 * @returns {Promise<object>} - La réponse du serveur.
 */
async function callApi(endpoint, payload) {
    // En production, ce serait un fetch réel :
    // const response = await fetch(API_BASE + endpoint, { 
    //     method: 'POST', 
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(payload)
    // });
    // return response.json();

    console.log(`[API Call] Endpoint: ${endpoint}, Payload:`, payload);

    // --- LOGIQUE CÔTÉ SERVEUR SIMULÉE (pour le client) ---
    // En l'absence de serveur réel, on simule l'opération en utilisant localStorage comme DB.

    if (endpoint.includes('signup')) {
        // Simuler le stockage côté serveur (vérification d'existence et création)
        if (localStorage.getItem(`user:${payload.email}`)) {
            return { success: false, message: "Cet email est déjà enregistré." };
        }
        const newUser = {
            email: payload.email,
            level: '1ère année',
            feeling: '_',
            duration: 20,
            streak: 0,
            lastLogin: null,
            lastLessonDate: null,
            passwordHash: 'dummy-hash' // En production: vrai hash
        };
        localStorage.setItem(`user:${payload.email}`, JSON.stringify(newUser));
        return { success: true, message: "Inscription réussie. Connectez-vous." };

    } else if (endpoint.includes('login')) {
        const userDataStr = localStorage.getItem(`user:${payload.email}`);
        if (!userDataStr || 'dummy-hash' !== 'dummy-hash') { 
            return { success: false, message: "Email ou mot de passe incorrect." };
        }
        let userData = JSON.parse(userDataStr);
        
        // Mettre à jour le streak (comme le ferait l'API /api/login)
        const updatedUser = updateStreak(userData); 
        localStorage.setItem(`user:${payload.email}`, JSON.stringify(updatedUser)); 

        return { success: true, user: updatedUser, message: "Connexion réussie." };

    } else if (endpoint.includes('save-progress')) {
        let userData = JSON.parse(localStorage.getItem(`user:${payload.email}`));
        if (userData) {
            userData = { ...userData, ...payload.data };
            localStorage.setItem(`user:${payload.email}`, JSON.stringify(userData));
            return { success: true, message: "Progression sauvegardée." };
        }
        return { success: false, message: "Erreur lors de la sauvegarde." };
    }

    return { success: false, message: "Erreur API inconnue." };
}

/**
 * Gère le formulaire d'authentification (Inscription/Connexion).
 * @param {Event} event - L'événement déclencheur.
 * @param {boolean} isSignup - Vrai si c'est une inscription, Faux pour la connexion.
 */
async function handleAuthForm(event, isSignup) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    // Identifier le bouton correct pour désactivation
    const btnId = isSignup ? 'signup-btn' : 'login-btn';
    const btn = document.getElementById(btnId);

    const endpoint = isSignup ? '/signup' : '/login';

    if (!email || !password) {
        displayMessage("Veuillez remplir tous les champs.", false);
        return;
    }

    btn.disabled = true;

    try {
        const result = await callApi(endpoint, { email, password });

        if (result.success) {
            displayMessage(result.message, true);
            if (!isSignup) {
                // Connexion réussie
                appState.user = result.user;
                appState.isAuthenticated = true;
                localStorage.setItem(USER_KEY, appState.user.email); 
                initializeApp();
                switchScreen('home-screen');
            } else {
                // Inscription réussie : on peut nettoyer les champs
                document.getElementById('auth-password').value = '';
            }
        } else {
            displayMessage(result.message, false);
        }
    } catch (error) {
        console.error('Erreur Auth:', error);
        displayMessage("Une erreur réseau est survenue.", false);
    } finally {
        btn.disabled = false;
    }
}

/**
 * Déconnecte l'utilisateur.
 */
function logout() {
    appState.isAuthenticated = false;
    appState.user = null;
    localStorage.removeItem(USER_KEY);
    switchScreen('auth-screen');
}


// ====================================================================
// 4. Gamification & Streaks
// ====================================================================

/**
 * Met à jour le streak de l'utilisateur (Logique côté client simulée de l'API).
 * @param {object} user - L'objet utilisateur actuel.
 * @returns {object} - L'objet utilisateur mis à jour.
 */
function updateStreak(user) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!user.lastLogin) {
        user.streak = 1; 
        user.lastLogin = today.toISOString();
        return user;
    }

    const lastLogin = new Date(user.lastLogin);
    lastLogin.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (today.getTime() === lastLogin.getTime()) {
        // Déjà connecté aujourd'hui
        return user;
    } else if (yesterday.getTime() === lastLogin.getTime()) {
        // Connexion consécutive : Incrémenter
        user.streak++;
        user.lastLogin = today.toISOString();
        displayMessage(`🔥 Streak de ${user.streak} jours ! Continuez !`, true);
    } else {
        // Connexion après une coupure : Réinitialiser
        user.streak = 1;
        user.lastLogin = today.toISOString();
        displayMessage("Le streak a été réinitialisé. Vous reprenez aujourd'hui !", false);
    }

    return user;
}

/**
 * Affiche le streak et la récompense visuelle.
 */
function renderStreak() {
    const streakElement = document.getElementById('current-streak');
    const badgeElement = document.getElementById('streak-badge');
    const currentStreak = appState.user.streak || 0;

    streakElement.textContent = currentStreak;
    badgeElement.innerHTML = '🎯'; // Symbole de base

    // Récompense visuelle simple (CSS)
    badgeElement.classList.remove('silver', 'gold');
    if (currentStreak >= 30) {
        badgeElement.classList.add('gold');
        badgeElement.innerHTML = '🌟';
    } else if (currentStreak >= 7) {
        badgeElement.classList.add('silver');
        badgeElement.innerHTML = '🏆';
    }
}


// ====================================================================
// 5. Leçon Quotidienne & Exercices
// ====================================================================

/**
 * Construit le contenu de la leçon quotidienne.
 */
function createDailyLesson() {
    const { level, feeling, duration } = appState.user;
    const lessonSteps = [];

    // Étape 1 : Explication/Leçon
    let explanationText = `Leçon sur le thème : **Le Droit des Obligations** - Année ${level}.`;
    let numExercises = Math.floor(duration / 10); // 10min = 1 exo, 20min = 2 exos, 30min = 3 exos

    if (duration == 10) explanationText += " Explication courte.";
    if (duration == 20) explanationText += " Explication modérée.";
    if (duration == 30) explanationText += " Explication détaillée.";

    lessonSteps.push({ type: 'explanation', content: explanationText, title: 'Introduction' });

    // Étapes 2 à N : Exercices (Adaptés au niveau et au ressenti)
    const availableExo = EXERCISES_DATA[level];
    const feelingMap = { '--': 0, '-': 0.5, '_': 1, '+': 1.5, '++': 2 };
    const caseStudyChance = feelingMap[feeling]; 

    const types = ['qcm', 'flashcard', 'caseStudy'];
    
    for (let i = 0; i < numExercises; i++) {
        let typeIndex = Math.floor(Math.random() * types.length);
        let type = types[typeIndex];

        // S'assurer que le niveau ressenti influence les types d'exercices
        if (type === 'caseStudy' && Math.random() < (1 - (caseStudyChance / 2))) {
            type = (Math.random() > 0.5) ? 'qcm' : 'flashcard'; // Moins de cas pratiques si niveau faible
        }

        const list = availableExo[type];
        const exo = list[Math.floor(Math.random() * list.length)];
        lessonSteps.push({ type: type, content: exo, title: `Exercice ${i + 1}` });
    }

    appState.currentLesson = lessonSteps;
    appState.currentStepIndex = 0;
    appState.isLessonComplete = false;
    document.getElementById('lesson-progress-bar').setAttribute('aria-valuemax', lessonSteps.length);
}

/**
 * Affiche l'étape courante de la leçon (explication ou exercice).
 */
function renderCurrentStep() {
    const step = appState.currentLesson[appState.currentStepIndex];
    const contentArea = document.getElementById('lesson-content');
    const nextBtn = document.getElementById('next-step-btn');
    
    // Mise à jour de la barre de progression
    const progressValue = appState.currentStepIndex;
    const progressMax = appState.currentLesson.length;
    document.getElementById('lesson-progress-bar').setAttribute('aria-valuenow', progressValue);
    document.querySelector('.progress-fill').style.width = 
        ((progressValue / progressMax) * 100) + '%';

    contentArea.innerHTML = '';
    nextBtn.disabled = true;

    if (!step) {
        // Fin de la leçon
        contentArea.innerHTML = '<h3>Félicitations ! Session Quotidienne Terminée ! 🥳</h3><p>Vous avez révisé pour aujourd\'hui. Revenez demain pour garder votre streak !</p>';
        nextBtn.textContent = 'Terminer la Session';
        nextBtn.disabled = false;
        appState.isLessonComplete = true;
        
        // Simuler la sauvegarde de la progression (marquer le jour comme fait)
        callApi('/save-progress', { 
            email: appState.user.email,
            data: { lastLessonDate: new Date().toISOString().split('T')[0] } 
        });
        return;
    }
    
    contentArea.innerHTML = `<h3>${step.title}</h3>`;

    // Rendu spécifique à chaque type
    if (step.type === 'explanation') {
        contentArea.innerHTML += `<p>${step.content}</p>`;
        nextBtn.textContent = 'Commencer les Exercices';
        nextBtn.disabled = false;
    } else if (step.type === 'qcm') {
        renderQCM(contentArea, step.content, nextBtn);
    } else if (step.type === 'flashcard') {
        renderFlashcard(contentArea, step.content, nextBtn);
    } else if (step.type === 'caseStudy') {
        renderCaseStudy(contentArea, step.content, nextBtn);
    }
    
    window.scrollTo(0, 0);
}

/**
 * Rendu d'un QCM.
 */
function renderQCM(contentArea, exo, nextBtn) {
    contentArea.innerHTML += `<p class="question">${exo.q}</p>`;
    
    const optionsHTML = exo.options.map((opt, index) => 
        `<div class="qcm-option" data-option="${opt}" role="button" tabindex="0" aria-label="Option ${index + 1}: ${opt}">${opt}</div>`
    ).join('');
    
    contentArea.innerHTML += optionsHTML;
    
    const optionsContainer = contentArea.querySelector('.card');
    let isAnswered = false;

    contentArea.querySelectorAll('.qcm-option').forEach(option => {
        option.addEventListener('click', () => {
            if (isAnswered) return;
            isAnswered = true;
            
            const selectedAnswer = option.getAttribute('data-option');
            const isCorrect = selectedAnswer === exo.a;

            if (isCorrect) {
                option.classList.add('correct');
                displayMessage("✅ Bonne réponse !", true);
            } else {
                option.classList.add('incorrect');
                contentArea.querySelector(`[data-option="${exo.a}"]`).classList.add('correct');
                displayMessage(`❌ Mauvaise réponse. La bonne réponse était : ${exo.a}`, false);
            }
            
            nextBtn.disabled = false;
        });
    });
}

/**
 * Rendu d'une Flashcard.
 */
function renderFlashcard(contentArea, exo, nextBtn) {
    contentArea.innerHTML += `
        <div class="flashcard" role="button" tabindex="0" aria-label="Flashcard : cliquez pour voir le verso">
            <div class="flashcard-inner">
                <div class="flashcard-front">${exo.front}</div>
                <div class="flashcard-back">${exo.back}</div>
            </div>
        </div>
        <p class="hint">${exo.hint || "Cliquez sur la carte pour voir la réponse !"}</p>
    `;
    
    const card = contentArea.querySelector('.flashcard');
    card.addEventListener('click', () => {
        card.classList.add('flipped');
        nextBtn.disabled = false;
    });
    
    nextBtn.textContent = 'J\'ai Révisé';
}

/**
 * Rendu d'une Étude de Cas.
 */
function renderCaseStudy(contentArea, exo, nextBtn) {
    contentArea.innerHTML += `
        <div class="case-study">
            <p class="question"><strong>Question :</strong> ${exo.q}</p>
            <p class="hint">Indice : ${exo.hint}</p>
            <textarea id="case-study-answer" placeholder="Tapez votre analyse..." aria-label="Votre réponse à l'étude de cas"></textarea>
            <button id="submit-case-btn" class="big-button secondary-button">Soumettre mon Analyse</button>
        </div>
    `;
    
    const submitBtn = document.getElementById('submit-case-btn');
    const textarea = document.getElementById('case-study-answer');

    submitBtn.addEventListener('click', () => {
        if (textarea.value.length < 20) {
            displayMessage("Veuillez écrire une analyse un peu plus longue.", false);
            return;
        }
        
        displayMessage("Analyse soumise ! L'effort est récompensé.", true);
        submitBtn.disabled = true;
        textarea.disabled = true;
        nextBtn.disabled = false;
    });
    
    nextBtn.textContent = 'Passer à l\'Étape Suivante';
}

/**
 * Passe à l'étape suivante de la leçon.
 */
function goToNextStep() {
    if (appState.isLessonComplete) {
        switchScreen('home-screen');
        // Recharger l'état de l'accueil après la session
        initializeApp(); 
        return;
    }
    
    appState.currentStepIndex++;
    renderCurrentStep();
}


// ====================================================================
// 6. Message Motivateur Quotidien
// ====================================================================

/**
 * Affiche un message motivateur aléatoire ou indexé.
 */
function displayDailyMotto() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const mottoIndex = dayOfYear % MOTTO_LIST.length;
    document.getElementById('motto-text').textContent = MOTTO_LIST[mottoIndex];
}


// ====================================================================
// 7. Initialisation de l'Application (Listeners & Chargement)
// ====================================================================

/**
 * Initialise l'interface utilisateur de l'écran d'accueil avec les données de l'utilisateur.
 */
function initializeHomeUI() {
    const user = appState.user;
    
    // Remplir les sélecteurs avec les données de l'utilisateur
    document.getElementById('select-level').value = user.level || '1ère année';
    document.getElementById('select-duration').value = user.duration || 20;

    // Rendre l'échelle de ressenti
    const feelingScale = document.getElementById('feeling-scale');
    feelingScale.innerHTML = '';
    const feelings = ['--', '-', '_', '+', '++'];
    feelings.forEach(f => {
        const option = document.createElement('div');
        option.className = 'feeling-option';
        option.textContent = f;
        option.setAttribute('data-feeling', f);
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', f === user.feeling ? 'true' : 'false');
        
        option.addEventListener('click', () => {
            document.querySelectorAll('.feeling-option').forEach(o => o.setAttribute('aria-checked', 'false'));
            option.setAttribute('aria-checked', 'true');
            appState.user.feeling = f;
        });
        feelingScale.appendChild(option);
    });

    // Afficher le streak
    renderStreak();

    // Afficher le message motivateur
    displayDailyMotto();

    // Vérifier si la leçon du jour est déjà faite
    const todayStr = new Date().toISOString().split('T')[0];
    const lessonDoneToday = user.lastLessonDate === todayStr;
    const startBtn = document.getElementById('start-lesson-btn');
    if (lessonDoneToday) {
        startBtn.textContent = 'Session Quotidienne Terminée ✅';
        startBtn.disabled = true;
    } else {
        startBtn.textContent = 'Démarrer la Leçon Quotidienne';
        startBtn.disabled = false;
    }

    switchScreen('home-screen');
}

/**
 * Ajoute tous les écouteurs d'événements principaux.
 */
function addEventListeners() {
    
    // ----------------------------------------------------------------------
    // 🔥 CORRECTION DE L'AUTHENTIFICATION 🔥
    // ----------------------------------------------------------------------
    
    // 1. Gérer l'événement SUBMIT du formulaire (déclenché par la touche Entrée ou login-btn)
    // C'est le chemin par défaut pour la CONNEXION (isSignup = false)
    document.getElementById('auth-form').addEventListener('submit', (event) => {
        event.preventDefault();
        handleAuthForm(event, false); // Mode CONNEXION
    });

    // 2. Gérer l'événement CLICK sur le bouton INSCRIPTION (type="button")
    document.getElementById('signup-btn').addEventListener('click', (event) => {
        event.preventDefault();
        handleAuthForm(event, true); // Mode INSCRIPTION
    });
    
    // ----------------------------------------------------------------------
    
    // Déconnexion
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Sauvegarde des paramètres
    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const newLevel = document.getElementById('select-level').value;
        const newDuration = parseInt(document.getElementById('select-duration').value, 10);
        const newFeeling = appState.user.feeling;

        appState.user.level = newLevel;
        appState.user.duration = newDuration;
        
        const result = await callApi('/save-progress', {
            email: appState.user.email,
            data: { 
                level: newLevel, 
                feeling: newFeeling, 
                duration: newDuration 
            }
        });

        if (result.success) {
            displayMessage("Paramètres sauvegardés avec succès.", true);
        } else {
            displayMessage("Erreur de sauvegarde des paramètres.", false);
        }
    });

    // Démarrer la leçon
    document.getElementById('start-lesson-btn').addEventListener('click', () => {
        createDailyLesson();
        renderCurrentStep();
        switchScreen('lesson-screen');
    });

    // Leçon : Étape Suivante
    document.getElementById('next-step-btn').addEventListener('click', goToNextStep);

    // Leçon : Retour à l'accueil
    document.getElementById('back-home-btn').addEventListener('click', () => {
        switchScreen('home-screen');
        initializeApp();
    });
}

/**
 * Fonction principale d'initialisation (chargement de l'utilisateur).
 */
async function initializeApp() {
    const storedEmail = localStorage.getItem(USER_KEY);
    
    if (storedEmail) {
        // Simuler la re-connexion automatique avec l'email stocké
        // Note: L'appel /login met à jour le streak côté serveur simulé
        const result = await callApi('/login', { email: storedEmail, password: 'dummy-password' });
        
        if (result.success) {
            appState.user = result.user;
            appState.isAuthenticated = true;
            initializeHomeUI();
        } else {
            localStorage.removeItem(USER_KEY);
            switchScreen('auth-screen');
            displayMessage("Session expirée. Veuillez vous reconnecter.", false);
        }
    } else {
        switchScreen('auth-screen');
    }
}


// Démarrer tout
document.addEventListener('DOMContentLoaded', () => {
    addEventListeners();
    initializeApp();
});
