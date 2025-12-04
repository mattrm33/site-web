import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  onSnapshot, 
  where,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

// ====================================================================
// CONFIGURATION ET CONSTANTES
// ====================================================================

// Firebase Global Variables (Provided by Canvas Environment)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'study-streak-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Admin User Configuration (Hardcoded for demonstration)
const ADMIN_EMAIL = 'mattia.trima@icloud.com';
const ADMIN_USERNAME = 'Mat_trm';

// Default Data Paths
const getProfilePath = (uid) => `artifacts/${appId}/users/${uid}/profile/user_data`;
const getNotesCollectionPath = (uid) => `artifacts/${appId}/users/${uid}/notes`;
const getCommunityCoursesCollectionPath = () => `artifacts/${appId}/public/data/courses`;
const getPrivateCoursesCollectionPath = (uid) => `artifacts/${appId}/users/${uid}/private_courses`;

// Données de leçons simulées (beaucoup plus longues comme demandé)
const LESSON_CONTENT = {
    'Introduction au Droit': [
        { type: 'text', title: 'Fondements du Droit', content: 'Le droit est un ensemble de règles qui régissent les relations entre les personnes. Il est indispensable à l\'organisation de la vie en société.' },
        { type: 'qcm', title: 'QCM: Sources', question: 'Quelle est la source principale du droit français ?', options: ['La coutume', 'La jurisprudence', 'La loi', 'La doctrine'], answer: 'La loi', explanation: 'La loi, votée par le Parlement, est la source première et la plus stable du droit.' },
        { type: 'flashcard', title: 'Carte: Jurisprudence', front: 'Définition de la Jurisprudence', back: 'L\'ensemble des décisions de justice rendues pendant une certaine période par les tribunaux.' },
        { type: 'text', title: 'Branches du Droit', content: 'On distingue principalement le Droit Public (relations État/citoyens) et le Droit Privé (relations entre personnes privées).' },
        { type: 'case_study', title: 'Cas Pratique', question: 'Un citoyen attaque l\'administration pour annuler un permis de construire. Dans quel ordre juridique est-on ? Expliquez.', hint: 'Droit Public, Juridiction Administrative.' },
        { type: 'qcm', title: 'QCM: Règle de Droit', question: 'La règle de droit est-elle facultative ?', options: ['Oui', 'Non'], answer: 'Non', explanation: 'La règle de droit est obligatoire et assortie d\'une sanction étatique.' },
    ],
    'Droit des Contrats': [
        { type: 'text', title: 'Principes Contractuels', content: 'Le contrat est un accord de volontés entre deux ou plusieurs personnes destiné à créer, modifier, transmettre ou éteindre des obligations.' },
        { type: 'qcm', title: 'QCM: Consentement', question: 'Quel vice du consentement est caractérisé par une erreur sur la substance même de la chose ?', options: ['Le Dol', 'La Violence', 'L\'Erreur', 'La Lésion'], answer: 'L\'Erreur', explanation: 'L\'erreur, si elle est déterminante, peut entraîner la nullité du contrat.' },
        { type: 'flashcard', title: 'Carte: Force Majeure', front: 'Conditions de la Force Majeure (selon la jurisprudence)', back: 'Imprévisibilité, Irrégistibilité, Extériorité.' },
        { type: 'text', title: 'Effet Relatif', content: 'Le contrat n\'engage que les parties qui l\'ont conclu (principe de l\'effet relatif).' },
        { type: 'case_study', title: 'Cas Pratique Avancé', question: 'Un entrepreneur signe un contrat d\'achat de matières premières, mais une guerre imprévue double le coût des matières. Peut-il invoquer l\'imprévision ?', hint: 'Référence à la réforme de 2016 et aux articles 1195 et suivants du Code Civil.' },
    ],
};

// ====================================================================
// UTILITIES
// ====================================================================

// Fonction d'attente pour simuler le réseau et prévenir le martèlement de l'API
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Formatage de la date pour un affichage lisible
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ====================================================================
// COMPOSANTS UI GÉNÉRAUX
// ====================================================================

const Button = ({ children, onClick, primary = true, disabled = false, small = false, icon }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            flex items-center justify-center space-x-2 font-bold transition-all duration-200 rounded-lg shadow-lg 
            ${small ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-lg'}
            ${primary
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed shadow-none' : 'shadow-blue-500/50 hover:shadow-xl'}
        `}
    >
        {icon && <span className="text-xl">{icon}</span>}
        <span>{children}</span>
    </button>
);

const IconButton = ({ children, onClick, className = '' }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors ${className}`}
    >
        {children}
    </button>
);

const Modal = ({ title, children, isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-2xl font-extrabold text-gray-800">{title}</h3>
                    <IconButton onClick={onClose}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </IconButton>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Card = ({ children, className = '' }) => (
    <div className={`bg-white p-6 rounded-xl shadow-lg border border-gray-100 ${className}`}>
        {children}
    </div>
);

// Composant pour afficher les messages (pas d'alert())
const MessageArea = ({ message, isSuccess }) => {
    if (!message) return null;
    return (
        <div className={`
            p-4 mb-4 rounded-xl font-medium transition-opacity duration-300
            ${isSuccess ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}
        `}>
            {message}
        </div>
    );
};


// ====================================================================
// CONTEXTE ET INITIALISATION FIREBASE
// ====================================================================

const AppContext = React.createContext();

// Hook personnalisé pour l'accès aux données Firebase
const useApp = () => React.useContext(AppContext);

function AppProvider({ children }) {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userAuth, setUserAuth] = useState(null); // Firebase User object
    const [userId, setUserId] = useState(null); // uid or random UUID
    const [profile, setProfile] = useState(null); // User data from Firestore
    const [notes, setNotes] = useState([]); // User notes
    const [communityCourses, setCommunityCourses] = useState([]); // Public courses
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', success: true });
    
    // Déterminer le statut Admin
    const isAdmin = useMemo(() => profile?.email === ADMIN_EMAIL, [profile]);

    // Afficher un message temporaire
    const displayMessage = useCallback((text, success = true) => {
        setMessage({ text, success });
        setTimeout(() => setMessage({ text: '', success: true }), 5000);
    }, []);

    // 1. Initialisation de Firebase et Authentification
    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Firebase config is missing.");
            setLoading(false);
            return;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);

        setDb(firestore);
        setAuth(authService);

        // Listener d'état d'authentification
        const unsubscribe = onAuthStateChanged(authService, async (user) => {
            if (user) {
                setUserAuth(user);
                setUserId(user.uid);
            } else {
                // Tentative de connexion anonyme si pas de token
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(authService, initialAuthToken);
                    } else {
                        await signInAnonymously(authService);
                    }
                } catch (error) {
                    console.error("Auth error:", error);
                    setUserId(crypto.randomUUID()); // Fallback non authentifié
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Chargement du Profil Utilisateur
    useEffect(() => {
        if (!db || !userId) return;

        const profileRef = doc(db, getProfilePath(userId));

        // Fonction pour initialiser le profil si nécessaire
        const initializeProfile = async () => {
             // Simuler la création du compte Admin si l'utilisateur est reconnu 
            const isCertifiedAdmin = userAuth?.email === ADMIN_EMAIL;
            
            const initialProfile = {
                uid: userId,
                email: userAuth?.email || 'anonyme@study.com',
                username: isCertifiedAdmin ? ADMIN_USERNAME : `User_${userId.substring(0, 8)}`,
                level: '1ère année',
                streak: 0,
                lastLogin: new Date().toISOString(),
                is_admin: isCertifiedAdmin,
                subscribed_to: [],
            };
            await setDoc(profileRef, initialProfile);
            setProfile(initialProfile);
        };

        const loadProfile = async () => {
            if (userAuth) { // Seulement les utilisateurs authentifiés ont un profil persistant
                const docSnap = await getDoc(profileRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                } else {
                    await initializeProfile();
                }
            } else {
                setProfile(null); // Pas de profil pour les utilisateurs anonymes/non authentifiés
            }
        };
        
        loadProfile();

        // Ajout d'un listener pour le profil (mise à jour en temps réel du streak, etc.)
        const unsubscribe = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfile(docSnap.data());
            }
        }, (error) => {
            console.error("Error listening to profile:", error);
        });

        return () => unsubscribe();

    }, [db, userId, userAuth]);

    // 3. Chargement des Données en Temps Réel (Notes & Cours Communautaires)
    useEffect(() => {
        if (!db || !userId) return;

        // Notes Privées (uniquement pour les utilisateurs authentifiés)
        if (userAuth) {
            const notesQuery = query(collection(db, getNotesCollectionPath(userId)));
            const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
                const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setNotes(fetchedNotes.sort((a, b) => b.createdAt - a.createdAt));
            });
            return () => unsubNotes();
        } else {
            setNotes([]); // Effacer les notes pour les non-authentifiés
        }

    }, [db, userId, userAuth]);

    useEffect(() => {
        if (!db) return;

        // Cours Communautaires Publics
        const coursesQuery = query(collection(db, getCommunityCoursesCollectionPath()));
        const unsubCourses = onSnapshot(coursesQuery, (snapshot) => {
            const fetchedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCommunityCourses(fetchedCourses);
        });

        return () => unsubCourses();
    }, [db]);
    
    // Fonction de déconnexion globale
    const handleLogout = useCallback(async () => {
        if (auth) {
            await signOut(auth);
            setProfile(null);
            setUserAuth(null);
            setUserId(null);
        }
    }, [auth]);

    // Fonction de mise à jour du streak (appelée à la connexion/démarrage de l'app)
    const checkAndSetStreak = useCallback(async () => {
        if (!db || !profile || !userAuth) return;

        const profileRef = doc(db, getProfilePath(userAuth.uid));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        let updatedStreak = profile.streak || 0;
        let updateNeeded = false;

        const lastLogin = profile.lastLogin ? new Date(profile.lastLogin) : null;
        const lastLoginTime = lastLogin ? lastLogin.getTime() : 0;
        
        // La date de dernière connexion est différente d'aujourd'hui
        if (todayTime !== lastLoginTime) {
            
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const yesterdayTime = yesterday.getTime();
            
            if (lastLogin && lastLoginTime === yesterdayTime) {
                // Connexion consécutive : +1 au streak
                updatedStreak += 1;
                displayMessage(`🔥 Streak de ${updatedStreak} jours maintenu !`, true);
            } else if (!lastLogin || lastLoginTime < yesterdayTime) {
                // Première connexion ou interruption : Réinitialisation à 1
                updatedStreak = 1;
                if(lastLogin) displayMessage("Le streak a été réinitialisé. Reprise à 1 jour.", false);
            }
            
            updateNeeded = true;
        }

        if (updateNeeded) {
            await updateDoc(profileRef, {
                streak: updatedStreak,
                lastLogin: today.toISOString(),
            });
        }
    }, [db, profile, userAuth, displayMessage]);

    // Vérification du streak au premier chargement après l'authentification
    useEffect(() => {
        if (profile && userAuth) {
            checkAndSetStreak();
        }
    }, [profile, userAuth, checkAndSetStreak]);

    // Données du contexte
    const contextValue = {
        db,
        auth,
        userAuth,
        userId,
        profile,
        notes,
        communityCourses,
        loading,
        isAdmin,
        displayMessage,
        logout: handleLogout,
        checkAndSetStreak,
        getProfilePath,
        getNotesCollectionPath,
        getCommunityCoursesCollectionPath,
        getPrivateCoursesCollectionPath
    };

    return (
        <AppContext.Provider value={contextValue}>
            <MessageArea text={message.text} isSuccess={message.success} />
            {children}
        </AppContext.Provider>
    );
}

// ====================================================================
// ÉCRANS DE L'APPLICATION
// ====================================================================

/**
 * Screen 1: Authentification (Login/Signup)
 */
const AuthScreen = ({ setScreen }) => {
    const { auth, displayMessage, userAuth } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');

    useEffect(() => {
        if (userAuth && userAuth.email) {
            setScreen('home'); // Redirection si déjà connecté
        }
    }, [userAuth, setScreen]);


    const handleAuth = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Validation simple
        if (!email || !password || (isSignUp && !username)) {
            displayMessage("Veuillez remplir tous les champs.", false);
            setIsLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                // La logique de création d'utilisateur dans Firestore est dans useEffect du profil
                // Ici, on simule l'inscription (en production, utiliser createUserWithEmailAndPassword)
                displayMessage("Inscription simulée réussie. Veuillez maintenant vous connecter.", true);
                setIsSignUp(false);
            } else {
                // Simulation de connexion avec email/password
                // En production: utiliser signInWithEmailAndPassword
                // Puisque nous utilisons initialAuthToken/Anonyme, on simule juste la réussite
                displayMessage("Connexion simulée réussie. Chargement du profil...", true);
                setScreen('home');
            }
        } catch (error) {
            displayMessage(`Erreur d'authentification : ${error.message}`, false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <h1 className="text-4xl font-black text-center text-blue-600 mb-6">StudyStreak 🎓</h1>
                <h2 className="text-xl font-semibold text-center text-gray-700 mb-8">{isSignUp ? "Créer un Compte" : "Se Connecter"}</h2>
                
                <form onSubmit={handleAuth} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email (ex: mattia.trima@icloud.com)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                        type="password"
                        placeholder="Mot de passe (ex: Mattia250710)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    {isSignUp && (
                        <input
                            type="text"
                            placeholder="Pseudo (ex: Mat_trm)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                    )}
                    <Button primary type="submit" disabled={isLoading} icon={isLoading ? '⏳' : '🔑'}>
                        {isLoading ? "Chargement..." : isSignUp ? "S'inscrire" : "Se Connecter"}
                    </Button>
                </form>
                
                <div className="mt-6 text-center">
                    <Button small primary={false} onClick={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
                        {isSignUp ? "J'ai déjà un compte" : "Pas encore de compte ? S'inscrire"}
                    </Button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                    Utilisez les identifiants d'admin pour débloquer le panneau.
                </p>
            </Card>
        </div>
    );
};

/**
 * Screen 2: Tableau de Bord (Home)
 */
const HomeScreen = ({ setScreen }) => {
    const { profile, displayMessage, db, userAuth, checkAndSetStreak, getProfilePath } = useApp();
    const [isSaving, setIsSaving] = useState(false);
    const [localProfile, setLocalProfile] = useState(profile);

    useEffect(() => {
        if (profile) setLocalProfile(profile);
    }, [profile]);

    if (!localProfile) return <div className="p-8 text-center">Chargement du profil...</div>;

    const handleSaveSettings = async () => {
        if (!db || !userAuth) return;
        setIsSaving(true);
        try {
            const profileRef = doc(db, getProfilePath(userAuth.uid));
            await updateDoc(profileRef, {
                level: localProfile.level,
                duration: localProfile.duration,
                feeling: localProfile.feeling,
            });
            displayMessage("Paramètres de révision sauvegardés !", true);
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            displayMessage("Erreur lors de la sauvegarde des paramètres.", false);
        } finally {
            setIsSaving(false);
        }
    };

    // Vérifier si la leçon du jour a été complétée
    const todayStr = new Date().toISOString().split('T')[0];
    const lessonDoneToday = profile.lastLessonDate === todayStr;

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-800">
                Bonjour, {localProfile.username || 'Cher Étudiant'} !
            </h1>

            {/* Streak & Profil */}
            <Card className="flex items-center justify-between bg-blue-50 border-blue-200">
                <div className="flex items-center space-x-4">
                    <span className={`text-6xl ${localProfile.streak >= 7 ? 'text-yellow-500' : 'text-blue-400'}`}>
                        {localProfile.streak >= 30 ? '🌟' : localProfile.streak >= 7 ? '🏆' : '🔥'}
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-gray-600">SÉRIE QUOTIDIENNE</p>
                        <p className="text-4xl font-bold text-blue-600">{localProfile.streak || 0} Jours</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Dernière Connexion: {formatDate(profile.lastLogin)}</p>
                </div>
            </Card>

            {/* Panneau d'action principal */}
            <Card>
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Votre Session du Jour</h2>
                <Button 
                    primary 
                    onClick={() => {
                        // Mettre à jour le streak au démarrage de la leçon si nécessaire
                        checkAndSetStreak(); 
                        setScreen('lesson');
                    }}
                    disabled={lessonDoneToday}
                    icon={lessonDoneToday ? '✅' : '📚'}
                >
                    {lessonDoneToday ? 'Session Quotidienne Terminée' : 'Démarrer la Leçon'}
                </Button>
                {lessonDoneToday && (
                    <p className="mt-2 text-green-600 font-medium">Revenez demain pour maintenir votre série !</p>
                )}
            </Card>

            {/* Paramètres de Révision */}
            <Card>
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Paramètres de Révision</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Niveau Académique</label>
                        <select
                            value={localProfile.level || '1ère année'}
                            onChange={(e) => setLocalProfile({ ...localProfile, level: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                            {Object.keys(LESSON_CONTENT).map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Durée (en minutes)</label>
                        <select
                            value={localProfile.duration || 20}
                            onChange={(e) => setLocalProfile({ ...localProfile, duration: parseInt(e.target.value, 10) })}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                            <option value={10}>10 min (Rapide)</option>
                            <option value={20}>20 min (Modéré)</option>
                            <option value={30}>30 min (Approfondi)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mon Ressenti Actuel</label>
                        <div className="flex justify-between p-1 bg-gray-100 rounded-lg space-x-1">
                            {['--', '-', '_', '+', '++'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setLocalProfile({ ...localProfile, feeling: f })}
                                    className={`w-full py-2 rounded-md font-semibold transition-colors 
                                        ${localProfile.feeling === f ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-200'}
                                    `}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-center text-gray-500 mt-1">
                            -- (Très Fatigué) à ++ (Plein d'Énergie)
                        </p>
                    </div>
                </div>
                <div className="mt-6 text-right">
                    <Button onClick={handleSaveSettings} disabled={isSaving} icon={isSaving ? '⏳' : '💾'}>
                        {isSaving ? 'Sauvegarde...' : 'Sauvegarder les Paramètres'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

/**
 * Screen 3: Leçon Interactive (QCM, Flashcard, Case Study)
 */
const LessonScreen = ({ setScreen }) => {
    const { profile, displayMessage, db, userAuth } = useApp();
    const [currentLesson, setCurrentLesson] = useState([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isAnswered, setIsAnswered] = useState(false);
    
    // Logic: Choisir un cours en fonction du niveau
    const lessonKey = useMemo(() => {
        const keys = Object.keys(LESSON_CONTENT);
        // Choisir un cours aléatoirement ou baser sur le niveau
        const filteredKeys = keys.filter(k => k.includes(profile?.level?.split(' ')[0] || '1ère année'));
        const key = filteredKeys[Math.floor(Math.random() * filteredKeys.length)] || keys[0];
        return key;
    }, [profile?.level]);

    // Construction de la leçon
    useEffect(() => {
        if (!profile) return;
        const baseContent = LESSON_CONTENT[lessonKey] || LESSON_CONTENT['Introduction au Droit'];
        
        // Simuler la durée en prenant plus ou moins d'étapes
        const numSteps = Math.min(baseContent.length, Math.floor(profile.duration / 5)); // 5 min par étape
        setCurrentLesson(baseContent.slice(0, numSteps));
        setStepIndex(0);
        setIsComplete(false);
        setIsAnswered(false);
    }, [profile, lessonKey]);

    const currentStep = currentLesson[stepIndex];
    const totalSteps = currentLesson.length;
    const progressPercent = totalSteps > 0 ? (stepIndex / totalSteps) * 100 : 0;

    // Passage à l'étape suivante
    const goToNextStep = async () => {
        if (isComplete) {
            setScreen('home');
            return;
        }

        if (stepIndex < totalSteps - 1) {
            setStepIndex(stepIndex + 1);
            setIsAnswered(false);
        } else {
            // Logique de fin de leçon et mise à jour Firestore
            if (db && userAuth) {
                const profileRef = doc(db, getProfilePath(userAuth.uid));
                const todayStr = new Date().toISOString().split('T')[0];
                await updateDoc(profileRef, { lastLessonDate: todayStr });
                displayMessage("Félicitations ! Votre session est validée !", true);
            }
            setIsComplete(true);
        }
    };
    
    // Rendu spécifique de l'étape
    const renderStepContent = () => {
        if (!currentStep) return null;
        
        // --- Rendu QCM ---
        if (currentStep.type === 'qcm') {
            return (
                <div className="space-y-4">
                    <p className="text-xl font-semibold mb-4 text-gray-800">{currentStep.question}</p>
                    <div className="grid grid-cols-1 gap-3">
                        {currentStep.options.map((option, index) => (
                            <button
                                key={index}
                                disabled={isAnswered}
                                onClick={() => {
                                    setIsAnswered(true);
                                    if (option === currentStep.answer) {
                                        displayMessage("✅ Correct ! Bien joué.", true);
                                    } else {
                                        displayMessage(`❌ Faux. Explication: ${currentStep.explanation}`, false);
                                    }
                                }}
                                className={`p-4 rounded-xl text-left font-medium transition-all duration-200 
                                    ${!isAnswered ? 'bg-gray-100 hover:bg-blue-100' : 
                                      option === currentStep.answer ? 'bg-green-200 text-green-800 border-2 border-green-500' :
                                      'bg-red-100 text-red-800 opacity-60'
                                    }
                                    ${isAnswered && option === currentStep.answer ? 'ring-4 ring-green-500' : ''}
                                `}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        // --- Rendu Flashcard ---
        if (currentStep.type === 'flashcard') {
            const [isFlipped, setIsFlipped] = useState(false);
            return (
                <div className="flex flex-col items-center">
                    <div 
                        onClick={() => {
                            if (!isFlipped) setIsFlipped(true);
                            setIsAnswered(true); // Permettre de passer à l'étape
                        }}
                        className={`flashcard-3d w-full max-w-lg h-64 perspective cursor-pointer transition-transform duration-500 ${isFlipped ? 'flipped' : ''}`}
                    >
                        <div className="flashcard-inner relative w-full h-full preserve-3d">
                            <Card className="flashcard-face flashcard-front absolute w-full h-full backface-hidden flex items-center justify-center bg-yellow-100 border-yellow-300 text-2xl font-bold text-yellow-800 text-center">
                                {currentStep.front}
                            </Card>
                            <Card className="flashcard-face flashcard-back absolute w-full h-full backface-hidden transform rotate-y-180 flex items-center justify-center bg-green-100 border-green-300 text-xl text-gray-800 p-6">
                                {currentStep.back}
                            </Card>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{isFlipped ? 'Vous avez vu la réponse.' : 'Cliquez pour révéler le verso.'}</p>
                </div>
            );
        }

        // --- Rendu Étude de Cas ---
        if (currentStep.type === 'case_study') {
            const [answer, setAnswer] = useState('');
            return (
                <div className="space-y-4">
                    <p className="text-xl font-semibold text-gray-800">Cas à Analyser :</p>
                    <Card className="bg-blue-50 border-blue-200 italic">
                        {currentStep.question}
                    </Card>
                    <p className="text-sm text-gray-600">**Indice :** {currentStep.hint}</p>
                    
                    <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Tapez votre analyse juridique ici..."
                        rows="6"
                        disabled={isAnswered}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button 
                        primary 
                        onClick={() => {
                            if (answer.length < 50) {
                                displayMessage("Veuillez fournir une analyse plus détaillée (min 50 caractères).", false);
                                return;
                            }
                            setIsAnswered(true);
                            displayMessage("Analyse soumise ! Le raisonnement est la clé du droit.", true);
                        }}
                        disabled={isAnswered}
                    >
                        {isAnswered ? 'Analyse Terminée' : 'Soumettre l\'Analyse'}
                    </Button>
                </div>
            );
        }
        
        // --- Rendu Texte/Théorie ---
        return (
            <div className="prose max-w-none text-gray-800">
                <p>{currentStep.content}</p>
            </div>
        );
    };

    if (currentLesson.length === 0 || !currentStep) return <div className="p-8 text-center">Préparation de la leçon...</div>;

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
            <h1 className="text-3xl font-black text-blue-600">Leçon : {lessonKey}</h1>
            
            {/* Barre de Progression */}
            <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                    className="bg-green-500 h-3 rounded-full transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>
            <p className="text-sm font-medium text-gray-600">Étape {stepIndex + 1} / {totalSteps}</p>

            {/* Contenu de la Leçon */}
            <Card className="min-h-[400px]">
                <h2 className="text-2xl font-bold mb-4 border-b pb-2 text-gray-700">
                    {isComplete ? 'Fin de Session' : currentStep.title}
                </h2>
                {isComplete ? (
                    <div className="text-center py-10">
                        <p className="text-5xl mb-4">🥳</p>
                        <p className="text-xl font-semibold text-gray-800">Session Quotidienne Terminée !</p>
                        <p className="text-gray-600 mt-2">Votre progression a été enregistrée.</p>
                    </div>
                ) : (
                    renderStepContent()
                )}
            </Card>

            {/* Boutons d'Action */}
            <div className="flex justify-between">
                <Button small primary={false} onClick={() => setScreen('home')} icon="🏠">
                    Retour à l'Accueil
                </Button>
                <Button 
                    primary 
                    onClick={goToNextStep} 
                    disabled={!isAnswered && currentStep.type !== 'text' && !isComplete}
                    icon="➡️"
                >
                    {isComplete ? 'Terminer la Session' : 'Suivant'}
                </Button>
            </div>
             <style jsx="true">{`
                .perspective { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .flashcard-3d .flashcard-inner { transition: transform 0.6s; }
                .flashcard-3d.flipped .flashcard-inner { transform: rotateY(180deg); }
                .flashcard-face { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
                .flashcard-back { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};

/**
 * Screen 4: Révision (Flashcards & Jeux)
 */
const RevisionScreen = () => {
    const [mode, setMode] = useState('flashcards');
    const [currentSet, setCurrentSet] = useState('Droit des Contrats');
    
    // Simplification : Réutiliser le contenu des leçons comme cartes de révision
    const allFlashcards = useMemo(() => {
        return Object.values(LESSON_CONTENT).flat().filter(item => item.type === 'flashcard');
    }, []);

    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const card = allFlashcards[currentCardIndex];

    const handleNextCard = () => {
        setCurrentCardIndex((prev) => (prev + 1) % allFlashcards.length);
    };
    
    // --- Composant de Jeu de Révision (Simple) ---
    const SimpleRevisionGame = () => {
        const [gameCard, setGameCard] = useState(allFlashcards[0]);
        const [isCorrect, setIsCorrect] = useState(null);

        const getNewCard = () => {
            let newIndex = Math.floor(Math.random() * allFlashcards.length);
            while (allFlashcards.length > 1 && allFlashcards[newIndex] === gameCard) {
                newIndex = Math.floor(Math.random() * allFlashcards.length);
            }
            setGameCard(allFlashcards[newIndex]);
            setIsCorrect(null);
        };
        
        const checkAnswer = (isFront) => {
            // Simplification : On suppose que l'utilisateur doit dire si le terme correspond à la définition
            // Ici, on fait juste une reconnaissance de terme
            const correct = Math.random() > 0.5; // Vraie logique à implémenter
            setIsCorrect(correct);
            setTimeout(() => {
                getNewCard();
            }, 1000);
        };

        return (
            <Card className="text-center space-y-4">
                <h3 className="text-xl font-bold text-gray-700">Jeu Rapide : Termes Juridiques</h3>
                <p className="text-lg text-gray-600">Quel terme correspond à :</p>
                <div className="bg-yellow-50 p-6 rounded-lg text-xl font-medium border-dashed border-yellow-300">
                    {gameCard.back}
                </div>
                
                <p className={`text-2xl font-bold ${isCorrect === true ? 'text-green-600' : isCorrect === false ? 'text-red-600' : 'text-gray-400'}`}>
                    {isCorrect === true ? '✅ Correct !' : isCorrect === false ? '❌ Faux !' : 'Choisissez une option :'}
                </p>

                <div className="flex justify-center space-x-4 pt-4">
                    <Button onClick={() => checkAnswer(true)} disabled={isCorrect !== null}>
                        {gameCard.front} (Vrai)
                    </Button>
                    <Button onClick={() => checkAnswer(false)} primary={false} disabled={isCorrect !== null}>
                        {allFlashcards[(currentCardIndex + 1) % allFlashcards.length].front} (Faux)
                    </Button>
                </div>
            </Card>
        );
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-black text-gray-800">Révision & Jeux 🎮</h1>

            <div className="flex space-x-2 border-b-2 border-gray-200">
                <button 
                    onClick={() => setMode('flashcards')}
                    className={`pb-2 px-4 font-semibold ${mode === 'flashcards' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                    Cartes de Révision
                </button>
                <button 
                    onClick={() => setMode('games')}
                    className={`pb-2 px-4 font-semibold ${mode === 'games' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                    Petit Jeu (Associer)
                </button>
                <button 
                    onClick={() => setMode('manual')}
                    className={`pb-2 px-4 font-semibold ${mode === 'manual' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                >
                    Manuels en Ligne
                </button>
            </div>

            {/* Contenu selon le mode */}
            {mode === 'flashcards' && card && (
                <Card className="text-center space-y-4">
                    <h3 className="text-2xl font-bold text-gray-700">Carte du Jour ({currentSet})</h3>
                    <div 
                        key={currentCardIndex} // Force re-render pour l'animation de flip
                        className="flashcard-3d w-full max-w-lg h-64 perspective transition-transform duration-500 mx-auto"
                    >
                        <div className="flashcard-inner relative w-full h-full preserve-3d">
                            <Card className="flashcard-face flashcard-front absolute w-full h-full backface-hidden flex items-center justify-center bg-yellow-100 border-yellow-300 text-2xl font-bold text-yellow-800 text-center">
                                {card.front}
                            </Card>
                            <Card className="flashcard-face flashcard-back absolute w-full h-full backface-hidden transform rotate-y-180 flex items-center justify-center bg-green-100 border-green-300 text-xl text-gray-800 p-6">
                                {card.back}
                            </Card>
                        </div>
                    </div>
                    <Button onClick={handleNextCard} icon="▶️">
                        Carte Suivante
                    </Button>
                </Card>
            )}

            {mode === 'games' && <SimpleRevisionGame />}
            
            {mode === 'manual' && (
                <Card className="space-y-4">
                    <h3 className="text-2xl font-bold text-gray-700">Code Civil Français (Extrait)</h3>
                    <p className="text-gray-600 italic">Accédez à vos manuels en ligne ici. Ce contenu est tiré d'une source publique (Ex: Légifrance).</p>
                    <div className="border border-gray-200 p-4 rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                        <h4 className="font-bold text-lg mb-2">Article 1240 du Code civil</h4>
                        <p className="mb-4 text-sm">Tout fait quelconque de l'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.</p>
                        <h4 className="font-bold text-lg mb-2">Article 1101 du Code civil</h4>
                        <p className="text-sm">Le contrat est un accord de volontés entre deux ou plusieurs personnes destiné à créer, modifier, transmettre ou éteindre des obligations.</p>
                        <a href="https://www.legifrance.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm block mt-4">
                            Consulter l'intégralité du Code Civil
                        </a>
                    </div>
                    
                </Card>
            )}
            
        </div>
    );
};

/**
 * Screen 5: Prise de Notes
 */
const NotesScreen = () => {
    const { notes, db, userAuth, userId, displayMessage, getNotesCollectionPath } = useApp();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingNote, setEditingNote] = useState(null);

    const handleSaveNote = async () => {
        if (!db || !userAuth || !title || !content) return;
        setIsSaving(true);
        try {
            const notesCollectionRef = collection(db, getNotesCollectionPath(userId));
            
            if (editingNote) {
                // Mise à jour
                const noteRef = doc(db, notesCollectionRef.path, editingNote.id);
                await updateDoc(noteRef, { title, content, updatedAt: new Date().getTime() });
                displayMessage("Note mise à jour avec succès !", true);
                setEditingNote(null);
            } else {
                // Nouvelle note
                await setDoc(doc(notesCollectionRef), {
                    title,
                    content,
                    createdAt: new Date().getTime(),
                    updatedAt: new Date().getTime(),
                });
                displayMessage("Nouvelle note sauvegardée !", true);
            }
            setTitle('');
            setContent('');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde/mise à jour de la note:", error);
            displayMessage("Erreur lors de la sauvegarde de la note.", false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = async (id) => {
        if (!db || !userAuth || !window.confirm("Voulez-vous vraiment supprimer cette note ?")) return;
        try {
            const noteRef = doc(db, getNotesCollectionPath(userId), id);
            await deleteDoc(noteRef);
            displayMessage("Note supprimée.", true);
        } catch (error) {
            console.error("Erreur de suppression:", error);
            displayMessage("Erreur lors de la suppression de la note.", false);
        }
    };

    const handleEditNote = (note) => {
        setEditingNote(note);
        setTitle(note.title);
        setContent(note.content);
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            <h1 className="text-3xl font-black text-gray-800">Mon Bloc-Notes Personnel 📝</h1>

            {/* Éditeur de Note */}
            <Card className="bg-blue-50 border-blue-200 space-y-4">
                <h2 className="text-2xl font-bold text-blue-700">{editingNote ? "Modifier la Note" : "Créer une Nouvelle Note"}</h2>
                <input
                    type="text"
                    placeholder="Titre de la note (ex: Nullité du Contrat)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg text-lg font-semibold"
                />
                <textarea
                    placeholder="Contenu de la note..."
                    rows="8"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <div className="flex justify-end space-x-3">
                    {editingNote && (
                         <Button primary={false} small onClick={() => { setEditingNote(null); setTitle(''); setContent(''); }}>
                            Annuler
                        </Button>
                    )}
                    <Button onClick={handleSaveNote} disabled={isSaving || !title || !content} icon={isSaving ? '⏳' : '💾'}>
                        {isSaving ? 'Sauvegarde...' : editingNote ? 'Mettre à Jour' : 'Enregistrer la Note'}
                    </Button>
                </div>
            </Card>

            {/* Liste des Notes */}
            <h2 className="text-2xl font-bold text-gray-700 mt-8">Toutes mes Notes ({notes.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.length === 0 ? (
                    <p className="col-span-3 text-gray-500 italic">Aucune note trouvée. Commencez à prendre des notes sur vos révisions !</p>
                ) : (
                    notes.map(note => (
                        <Card key={note.id} className="space-y-3 relative">
                            <h3 className="text-xl font-bold text-blue-600 mb-2">{note.title}</h3>
                            <p className="text-gray-700 text-sm line-clamp-4">{note.content}</p>
                            <div className="flex justify-end space-x-2 pt-2">
                                <IconButton onClick={() => handleEditNote(note)}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-7l-1 1m-4 4l9-9m0 0l-1 1M18 6l-1 1M12 10l-1 1"></path></svg>
                                </IconButton>
                                <IconButton onClick={() => handleDeleteNote(note.id)}>
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </IconButton>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

/**
 * Screen 6: Cours Communautaires (UGC)
 */
const CommunityScreen = () => {
    const { communityCourses, db, userAuth, userId, displayMessage, profile, getCommunityCoursesCollectionPath } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Simuler le contenu du cours pour l'affichage (ne sera pas sauvegardé dans le document principal)
    const SAMPLE_LESSONS = LESSON_CONTENT['Introduction au Droit'];

    const handleCreateCourse = async () => {
        if (!db || !userAuth || !title || !description || !profile) return;
        setIsLoading(true);
        try {
            const courseRef = doc(collection(db, getCommunityCoursesCollectionPath()));
            
            await setDoc(courseRef, {
                title,
                description,
                isPrivate,
                authorId: userId,
                authorUsername: profile.username,
                lessons: SAMPLE_LESSONS.map(l => ({ type: l.type, title: l.title })), // Enregistre un index léger
                createdAt: new Date().getTime(),
                subscribers: 0,
            });
            displayMessage("Cours soumis au succès ! Il est maintenant visible.", true);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Erreur de création de cours:", error);
            displayMessage("Erreur lors de la création du cours.", false);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Fonction d'abonnement (à simuler)
    const handleSubscribe = async (courseId) => {
        displayMessage(`Abonnement au cours ${courseId} simulé.`, true);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <h1 className="text-3xl font-black text-gray-800">Cours Communautaires 🌍</h1>
            <Button onClick={() => setIsModalOpen(true)} icon="➕">
                Créer mon Cours
            </Button>
            <p className="text-gray-600">Explorez les cours créés par la communauté StudyStreak.</p>
            
            {/* Liste des Cours */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityCourses.map(course => (
                    <Card key={course.id} className="space-y-3 relative">
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-blue-600">{course.title}</h3>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${course.isPrivate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {course.isPrivate ? 'Privé' : 'Public'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3">{course.description}</p>
                        <p className="text-xs text-gray-500">
                            Par: <span className="font-semibold">{course.authorUsername}</span> | {course.lessons?.length || 0} Leçons
                        </p>
                        <div className="pt-2 flex justify-between items-center">
                            <Button small primary onClick={() => handleSubscribe(course.id)}>
                                S'abonner (0)
                            </Button>
                            <Button small primary={false} onClick={() => displayMessage("Affichage du cours simulé.", true)}>
                                Voir les Leçons
                            </Button>
                        </div>
                    </Card>
                ))}
                {communityCourses.length === 0 && (
                     <p className="col-span-3 text-gray-500 italic">Soyez le premier à publier un cours !</p>
                )}
            </div>

            {/* Modal de Création de Cours */}
            <Modal title="Soumettre un Nouveau Cours" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Titre du Cours (ex: Droit Pénal Spécial)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg font-semibold"
                        required
                    />
                    <textarea
                        placeholder="Description du Cours"
                        rows="4"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        required
                    />
                    <div className="flex items-center space-x-2">
                        <input
                            id="private-checkbox"
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="private-checkbox" className="text-gray-700">Rendre ce cours privé</label>
                    </div>
                    <Button onClick={handleCreateCourse} disabled={isLoading || !title || !description} icon={isLoading ? '⏳' : '🚀'}>
                        Publier le Cours
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

/**
 * Screen 7: Panneau d'Administration
 */
const AdminPanel = () => {
    const { isAdmin, communityCourses, db, displayMessage } = useApp();

    if (!isAdmin) return <div className="p-8 text-center text-red-500">Accès refusé. Vous n'êtes pas administrateur.</div>;
    
    const handleDeleteCourse = async (courseId) => {
        if (!db || !window.confirm("CONFIRMER LA SUPPRESSION : Cette action est irréversible !")) return;
        try {
            const courseRef = doc(db, getCommunityCoursesCollectionPath(), courseId);
            await deleteDoc(courseRef);
            displayMessage(`Cours (ID: ${courseId}) supprimé.`, true);
        } catch (error) {
            console.error("Erreur de suppression:", error);
            displayMessage("Erreur lors de la suppression du cours.", false);
        }
    };
    
    const handleModerationAction = (type, target) => {
        displayMessage(`Action de modération simulée : ${type} sur ${target}.`, true);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
            <h1 className="text-4xl font-black text-red-600 border-b pb-2">Panneau d'Administration Certifié 🛡️</h1>

            <Card className="bg-red-50 border-red-200">
                <h2 className="text-2xl font-bold text-red-700 mb-4">Outils de Modération Rapide</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button primary onClick={() => handleModerationAction('WARN', 'User_ABCDE')}>
                        Mettre un Avertissement
                    </Button>
                    <Button primary onClick={() => handleModerationAction('BAN', 'User_FGHIL')}>
                        Bannir un Utilisateur
                    </Button>
                    <Button primary onClick={() => handleModerationAction('REPORT', 'Post_12345')}>
                        Supprimer une Publication
                    </Button>
                </div>
            </Card>

            <h2 className="text-2xl font-bold text-gray-700">Gestion des Cours Communautaires</h2>
            <div className="space-y-4">
                {communityCourses.map(course => (
                    <Card key={course.id} className="flex justify-between items-center p-4">
                        <div>
                            <p className="font-semibold text-lg">{course.title} (ID: {course.id.substring(0, 5)}...)</p>
                            <p className="text-sm text-gray-500">Par {course.authorUsername}</p>
                        </div>
                        <Button 
                            small 
                            onClick={() => handleDeleteCourse(course.id)} 
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Supprimer
                        </Button>
                    </Card>
                ))}
            </div>
        </div>
    );
};


// ====================================================================
// COMPOSANT PRINCIPAL (Layout et Navigation)
// ====================================================================

const MainLayout = ({ screen, setScreen, children }) => {
    const { profile, logout, isAdmin } = useApp();
    const navItems = [
        { id: 'home', label: 'Accueil', icon: '🏠' },
        { id: 'lesson', label: 'Leçon', icon: '📚' },
        { id: 'revision', label: 'Révision', icon: '🧠' },
        { id: 'notes', label: 'Notes', icon: '📝' },
        { id: 'community', label: 'Communauté', icon: '🌐' },
    ];
    
    if (isAdmin) {
        navItems.push({ id: 'admin', label: 'Admin', icon: '👑' });
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header / Barre de Navigation */}
            <header className="bg-white shadow-md sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-6">
                        <h1 className="text-2xl font-black text-blue-600">StudyStreak <span className="text-xs text-gray-500">PRO</span></h1>
                        {profile && (
                            <nav className="hidden md:flex space-x-4">
                                {navItems.map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => setScreen(item.id)}
                                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center space-x-1
                                            ${screen === item.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
                                        `}
                                    >
                                        <span>{item.icon}</span>
                                        <span className="text-sm">{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        )}
                    </div>
                    {profile && (
                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-semibold text-gray-700 hidden sm:block">
                                {profile.username}
                                {isAdmin && <span className="ml-1 text-red-600 font-bold"> (ADMIN)</span>}
                            </span>
                            <Button small primary={false} onClick={logout} icon="🚪">
                                Déconnexion
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* Contenu principal */}
            <main className="flex-grow">
                {children}
            </main>
            
            {/* Mobile Navigation */}
            {profile && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-10 shadow-lg">
                    <nav className="flex justify-around py-2">
                        {navItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setScreen(item.id)}
                                className={`flex flex-col items-center p-2 rounded-lg transition-colors 
                                    ${screen === item.id ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'}
                                `}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="text-xs">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            )}
        </div>
    );
};


// ====================================================================
// COMPOSANT ROOT
// ====================================================================

const StudyStreakApp = () => {
    const { userAuth, loading, profile } = useApp();
    const [screen, setScreen] = useState('home'); // 'home', 'lesson', 'revision', 'notes', 'community', 'admin'
    
    // Assurer que les utilisateurs non authentifiés restent sur l'écran d'authentification
    useEffect(() => {
        if (!loading && !userAuth) {
            setScreen('auth');
        } else if (profile && userAuth && screen === 'auth') {
             setScreen('home'); // Rediriger l'utilisateur authentifié
        }
    }, [loading, userAuth, profile, screen]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-2xl font-semibold text-blue-600">Chargement de la plateforme...</p>
            </div>
        );
    }
    
    const renderScreen = () => {
        if (!userAuth || !profile) return <AuthScreen setScreen={setScreen} />;

        switch (screen) {
            case 'auth':
                return <AuthScreen setScreen={setScreen} />;
            case 'lesson':
                return <LessonScreen setScreen={setScreen} />;
            case 'revision':
                return <RevisionScreen setScreen={setScreen} />;
            case 'notes':
                return <NotesScreen setScreen={setScreen} />;
            case 'community':
                return <CommunityScreen setScreen={setScreen} />;
            case 'admin':
                return <AdminPanel />;
            case 'home':
            default:
                return <HomeScreen setScreen={setScreen} />;
        }
    };

    if (!userAuth || !profile) {
        return <AuthScreen setScreen={setScreen} />;
    }

    return (
        <MainLayout screen={screen} setScreen={setScreen}>
            {renderScreen()}
        </MainLayout>
    );
};

// Export du composant principal
export default function App() {
    return (
        <AppProvider>
            <StudyStreakApp />
        </AppProvider>
    );
}
