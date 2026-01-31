require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Sert les fichiers statiques (index.html, app.js, css)

// Génération d'une clé secrète aléatoire à chaque démarrage pour forcer la reconnexion
const JWT_SECRET = crypto.randomBytes(64).toString('hex');

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgtm_web')
    .then(() => console.log('✅ Connecté à MongoDB'))
    .catch(err => console.error('❌ Erreur MongoDB:', err));

// --- MODÈLES (Basés sur le README.md) ---

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Observateur', enum: ['Admin', 'Gestionnaire', 'Observateur'] },
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

const EnginSchema = new mongoose.Schema({
    code_engin: { type: String, required: true, unique: true },
    famille: String,
    categorie: String,
    marque: String,
    modele: String,
    numero_serie: { type: String, unique: true },
    statut: { type: String, default: 'Disponible', enum: ['Disponible', 'Loué', 'Maintenance', 'En panne'] },
    photo: String, // URL de la photo
    intervalle_maintenance: { type: Number, default: 6 }, // En mois
    cout_jour: { type: Number, default: 0 }, // Coût location / jour
    date_derniere_maintenance: Date,
    date_derniere_location: Date,
    date_creation: { type: Date, default: Date.now }
});

const ChantierSchema = new mongoose.Schema({
    chef_projet: String,
    localisation: String,
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    statut: { type: String, default: 'Actif', enum: ['Actif', 'Inactif'] },
    date_creation: { type: Date, default: Date.now }
});

const LocationSchema = new mongoose.Schema({
    engin: { type: mongoose.Schema.Types.ObjectId, ref: 'Engin', required: true },
    chantier: { type: mongoose.Schema.Types.ObjectId, ref: 'Chantier', required: true },
    date_debut: { type: Date, required: true },
    date_fin: Date,
    date_location: { type: Date, default: Date.now },
    cout_total: { type: Number, default: 0 },
    statut: { type: String, default: 'En cours', enum: ['En cours', 'Terminée', 'Annulée'] }
});

const MaintenanceSchema = new mongoose.Schema({
    engin: { type: mongoose.Schema.Types.ObjectId, ref: 'Engin', required: true },
    date: { type: Date, default: Date.now },
    type_maintenance: String, // Ex: Vidange, Réparation
    cout: { type: Number, default: 0 },
    technicien: String,
    notes: String
});

const PanneSchema = new mongoose.Schema({
    engin: { type: mongoose.Schema.Types.ObjectId, ref: 'Engin', required: true },
    description: String,
    gravite: { type: String, enum: ['Faible', 'Moyenne', 'Critique'], required: true },
    date: { type: Date, default: Date.now },
    statut: { type: String, default: 'En cours', enum: ['En cours', 'Résolue'] },
    date_resolution: Date
});

const LogSchema = new mongoose.Schema({
    user: String,
    action: String,
    description: String,
    date: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
    message: String,
    type: { type: String, default: 'info' }, // info, warning, success
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Engin = mongoose.model('Engin', EnginSchema);
const Chantier = mongoose.model('Chantier', ChantierSchema);
const Location = mongoose.model('Location', LocationSchema);
const Maintenance = mongoose.model('Maintenance', MaintenanceSchema);
const Panne = mongoose.model('Panne', PanneSchema);
const Log = mongoose.model('Log', LogSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// Helper pour les logs
async function logAction(username, action, description) {
    try {
        await new Log({ user: username || 'Système', action, description }).save();
    } catch(e) { console.error("Erreur Log:", e); }
}

async function createNotification(message, type = 'info') {
    try {
        await new Notification({ message, type }).save();
    } catch(e) { console.error("Erreur Notif:", e); }
}

// --- CONSTANTES MÉTIER (COÛTS MAINTENANCE) ---
const COUTS_MAINTENANCE = {
    'Pelle': { 'Préventive': 800, 'Corrective': 2000, 'Révision générale': 3000, 'Changement pièce': 2500, 'Urgence': 4000 },
    'Pelle mécanique': { 'Préventive': 800, 'Corrective': 2000, 'Révision générale': 3000, 'Changement pièce': 2500, 'Urgence': 4000 }, // Alias
    'Grue': { 'Préventive': 1500, 'Corrective': 3500, 'Révision générale': 5000, 'Changement pièce': 4500, 'Urgence': 7000 },
    'Bulldozer': { 'Préventive': 1200, 'Corrective': 2800, 'Révision générale': 4200, 'Changement pièce': 3800, 'Urgence': 6000 },
    'Chargeuse': { 'Préventive': 900, 'Corrective': 2200, 'Révision générale': 3500, 'Changement pièce': 3000, 'Urgence': 5000 },
    'Compacteur': { 'Préventive': 700, 'Corrective': 1800, 'Révision générale': 2500, 'Changement pièce': 2200, 'Urgence': 3500 },
    'Camion': { 'Préventive': 600, 'Corrective': 1500, 'Révision générale': 2000, 'Changement pièce': 1800, 'Urgence': 3000 }
};

// --- MIDDLEWARES SÉCURITÉ ---

// Limiteur de tentatives de connexion (Brute Force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 tentatives max
    message: { error: "Trop de tentatives de connexion. Veuillez réessayer plus tard." }
});

// Vérification du Token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return res.status(401).json({ error: 'Accès refusé : Token manquant' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Accès refusé : Token invalide' });
        req.user = user;
        next();
    });
};

// Middleware de vérification de rôle (RBAC)
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès interdit : Droits insuffisants' });
        }
        next();
    };
};

// --- ROUTES API (Correspondance avec app.js) ---

// Inscription
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (await User.findOne({ username })) {
            return res.status(400).json({ error: 'Cet utilisateur existe déjà' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();
        await logAction(username, 'Inscription', `Nouvel utilisateur: ${username}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login (Vérification en base de données)
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (user && await bcrypt.compare(password, user.password)) {
            // Génération du Token JWT
            const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            
            res.json({ success: true, token, role: user.role, username: user.username });
        } else {
            res.status(401).json({ error: 'Identifiants incorrects' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Changer mot de passe
app.put('/api/users/:id/password', async (req, res) => {
    try {
        const { password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mot de passe oublié (Génération de token)
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        
        // Sécurité : on ne dit pas si l'utilisateur existe ou non, mais on loggue le lien si c'est le cas
        if (user) {
            const token = crypto.randomBytes(20).toString('hex');
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 heure
            await user.save();

            const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
            console.log(`\n📧 [SIMULATION EMAIL] Lien de réinitialisation pour ${username} : ${resetLink}\n`);
        }

        res.json({ success: true, message: 'Si ce compte existe, un lien a été envoyé (voir console serveur).' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Réinitialisation du mot de passe
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const user = await User.findOne({ 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ error: 'Le lien est invalide ou a expiré.' });

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Logs (Admin)
app.get('/api/logs', authenticateToken, authorizeRole(['Admin', 'Gestionnaire', 'Observateur']), async (req, res) => {
    const logs = await Log.find().sort({ date: -1 }).limit(100);
    res.json(logs);
});

// Profil utilisateur connecté (Info + Logs personnels)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id, '-password');
        const logs = await Log.find({ user: user.username }).sort({ date: -1 }).limit(20);
        res.json({ user, logs });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications (Polling)
app.get('/api/notifications/unread', async (req, res) => {
    try {
        const notifs = await Notification.find({ read: false }).sort({ date: 1 });
        // Marquer comme lues
        await Notification.updateMany({ _id: { $in: notifs.map(n => n._id) } }, { read: true });
        res.json(notifs);
    } catch(e) { res.status(500).json([]); }
});

// Dashboard Stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalEngins = await Engin.countDocuments();
        const availableEngins = await Engin.countDocuments({ statut: 'Disponible' });
        const rentedEngins = await Engin.countDocuments({ statut: 'Loué' });
        const maintenanceEngins = await Engin.countDocuments({ statut: 'Maintenance' });

        // --- GESTION DES COÛTS ---
        // Revenu total (Locations non annulées)
        const revenueData = await Location.aggregate([
            { $match: { statut: { $ne: 'Annulée' } } },
            { $group: { _id: null, total: { $sum: '$cout_total' } } }
        ]);
        const totalRevenue = revenueData[0] ? revenueData[0].total : 0;

        // Coût maintenance total
        const maintCostData = await Maintenance.aggregate([
            { $group: { _id: null, total: { $sum: '$cout' } } }
        ]);
        const totalMaintCost = maintCostData[0] ? maintCostData[0].total : 0;

        // Coût maintenance par famille
        const maintByFamily = await Maintenance.aggregate([
            {
                $lookup: {
                    from: 'engins',
                    localField: 'engin',
                    foreignField: '_id',
                    as: 'enginDetails'
                }
            },
            { $unwind: '$enginDetails' },
            {
                $group: {
                    _id: '$enginDetails.famille',
                    total: { $sum: '$cout' }
                }
            }
        ]);

        // --- ALERTES AUTOMATIQUES ---
        const alerts = [];
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0,0,0,0);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        // 1. Locations finissant demain
        const endingLocations = await Location.find({
            statut: 'En cours',
            date_fin: { $gte: tomorrow, $lt: dayAfter }
        }).populate('engin').populate('chantier');
        endingLocations.forEach(l => alerts.push({ type: 'info', message: `Retour prévu demain : ${l.engin.code_engin} (${l.chantier.chef_projet})` }));

        // 2. Maintenance trop longue (> 7 jours)
        const longMaintDate = new Date(today);
        longMaintDate.setDate(longMaintDate.getDate() - 7);
        const longMaintEngins = await Engin.find({ statut: 'Maintenance', date_derniere_maintenance: { $lt: longMaintDate } });
        longMaintEngins.forEach(e => alerts.push({ type: 'warning', message: `Maintenance longue (>7j) : ${e.code_engin}` }));

        // 3. Engins non utilisés (> 30 jours)
        const unusedDate = new Date(today);
        unusedDate.setDate(unusedDate.getDate() - 30);
        const unusedEngins = await Engin.find({
            statut: 'Disponible',
            $or: [{ date_derniere_location: { $lt: unusedDate } }, { date_derniere_location: { $exists: false }, date_creation: { $lt: unusedDate } }]
        });
        unusedEngins.forEach(e => alerts.push({ type: 'suggestion', message: `Suggestion : ${e.code_engin} est libre depuis >30j` }));

        // 4. Maintenance préventive dépassée (Niveau 3)
        const engins = await Engin.find({ statut: { $ne: 'En panne' } });
        engins.forEach(e => {
            if (e.date_derniere_maintenance) {
                const nextMaint = new Date(e.date_derniere_maintenance);
                nextMaint.setMonth(nextMaint.getMonth() + (e.intervalle_maintenance || 6));
                if (nextMaint < today) {
                    alerts.push({ type: 'warning', message: `Maintenance préventive requise : ${e.code_engin}` });
                }
            }
        });

        res.json({ totalEngins, availableEngins, rentedEngins, maintenanceEngins, totalRevenue, totalMaintCost, maintByFamily, alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Engins
app.get('/api/engins', async (req, res) => {
    const { search, statut, famille, marque } = req.query;
    let query = {};
    
    if (statut) query.statut = statut;
    if (famille) query.famille = new RegExp(famille, 'i');
    if (marque) query.marque = new RegExp(marque, 'i');
    if (search) query.$or = [
        { code_engin: new RegExp(search, 'i') }, 
        { famille: new RegExp(search, 'i') }
    ];

    const engins = await Engin.find(query).sort({ date_creation: -1 });
    res.json(engins);
});

// Engin par ID (pour modification)
app.get('/api/engins/:id', async (req, res) => {
    try {
        const engin = await Engin.findById(req.params.id);
        if (!engin) return res.status(404).json({ error: 'Engin non trouvé' });
        res.json(engin);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/engins', authenticateToken, async (req, res) => {
    try {
        const newEngin = new Engin(req.body);
        await newEngin.save();
        await logAction(req.user.username, 'Ajout Engin', `Code: ${newEngin.code_engin}`);
        res.status(201).json(newEngin);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/engins/:id', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const updated = await Engin.findByIdAndUpdate(req.params.id, req.body, { new: true });
        await logAction(req.user.username, 'Modif Engin', `ID: ${req.params.id}`);
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/engins/:id', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        await Engin.findByIdAndDelete(req.params.id);
        await logAction(req.user.username, 'Suppression Engin', `ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chantiers
app.get('/api/chantiers', async (req, res) => {
    const chantiers = await Chantier.find().sort({ date_creation: -1 });
    res.json(chantiers);
});

// Chantier par ID (pour modification)
app.get('/api/chantiers/:id', async (req, res) => {
    try {
        const chantier = await Chantier.findById(req.params.id);
        if (!chantier) return res.status(404).json({ error: 'Chantier non trouvé' });
        res.json(chantier);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chantiers', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const newChantier = new Chantier(req.body);
        await newChantier.save();
        await logAction(req.user.username, 'Ajout Chantier', `Projet: ${newChantier.chef_projet}`);
        res.status(201).json(newChantier);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/chantiers/:id', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const updated = await Chantier.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/chantiers/:id', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        await Chantier.findByIdAndUpdate(req.params.id, { statut: 'Inactif' });
        await logAction(req.user.username, 'Archivage Chantier', `ID: ${req.params.id}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Locations
app.get('/api/locations', async (req, res) => {
    const locations = await Location.find().populate('engin').populate('chantier').sort({ date_debut: -1 });
    res.json(locations);
});

app.post('/api/locations', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const { engin, chantier, date_debut, date_fin, notes } = req.body;
        
        // Récupérer l'engin pour le coût
        const enginDoc = await Engin.findById(engin);
        if (!enginDoc) return res.status(404).json({ error: 'Engin introuvable' });

        // Validation dates
        if (date_fin && new Date(date_fin) <= new Date(date_debut)) {
            return res.status(400).json({ error: 'La date de fin doit être postérieure à la date de début.' });
        }

        // Vérification disponibilité (Logique README)
        // On vérifie s'il existe une location "En cours" qui chevauche les dates demandées
        const conflict = await Location.findOne({
            engin: engin,
            statut: 'En cours',
            $or: [
                // La nouvelle date de début est pendant une location existante
                { date_debut: { $lte: new Date(date_fin) }, date_fin: { $gte: new Date(date_debut) } }
            ]
        });

        if (conflict) {
            return res.status(400).json({ error: 'Cet engin est déjà loué sur cette période.' });
        }

        // Calcul du coût total
        const start = new Date(date_debut);
        const end = new Date(date_fin);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de fin
        const cout_total = diffDays * (enginDoc.cout_jour || 0);

        const newLocation = new Location({ engin, chantier, date_debut, date_fin, notes, cout_total });
        await newLocation.save();
        
        // Mise à jour automatique du statut de l'engin (comme spécifié dans le README)
        await Engin.findByIdAndUpdate(engin, { statut: 'Loué' });

        await logAction(req.user.username, 'Nouvelle Location', `Engin: ${engin} -> Chantier: ${chantier}`);
        await createNotification(`Nouvelle location créée pour l'engin ${enginDoc.code_engin}`, 'success');
        res.status(201).json(newLocation);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Mise à jour statut location (Terminée/Annulée)
app.put('/api/locations/:id/status', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const { statut } = req.body;
        const location = await Location.findById(req.params.id);
        if (!location) return res.status(404).json({ error: 'Location introuvable' });

        location.statut = statut;
        if (statut === 'Terminée') location.date_fin = new Date(); // Date fin réelle
        await location.save();

        // Libérer l'engin si la location est finie ou annulée
        if (['Terminée', 'Annulée'].includes(statut)) {
            await Engin.findByIdAndUpdate(location.engin, { statut: 'Disponible', date_derniere_location: new Date() });
        }
        await logAction(req.user.username, 'Modif Location', `Statut: ${statut}`);
        res.json(location);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// Maintenance
app.get('/api/maintenances', async (req, res) => {
    const maintenances = await Maintenance.find().populate('engin').sort({ date: -1 });
    res.json(maintenances);
});

app.post('/api/maintenances', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const { engin, date, type_maintenance, technicien, notes } = req.body;
        
        // 1. Récupérer l'engin pour déterminer sa famille
        const enginDoc = await Engin.findById(engin);
        if (!enginDoc) return res.status(404).json({ error: 'Engin introuvable' });

        // 2. Calcul automatique du coût
        // On cherche la famille dans la table, sinon on prend une valeur par défaut (ex: Camion)
        let famille = enginDoc.famille;
        // Petit hack pour gérer les noms approximatifs si besoin, ou on prend la valeur exacte
        const grilleTarifs = COUTS_MAINTENANCE[famille] || COUTS_MAINTENANCE['Camion'];
        
        const cout = grilleTarifs[type_maintenance] || 0;

        const newMaint = new Maintenance({ engin, date, type_maintenance, cout, technicien, notes });
        await newMaint.save();

        // Mise à jour statut engin
        await Engin.findByIdAndUpdate(engin, { 
            statut: 'Maintenance',
            date_derniere_maintenance: date
        });

        await logAction(req.user.username, 'Ajout Maintenance', `Engin: ${engin}`);
        await createNotification(`Maintenance ajoutée pour l'engin ${enginDoc.code_engin}`, 'info');
        res.status(201).json(newMaint);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- PANNES (Niveau 3) ---
app.get('/api/pannes', async (req, res) => {
    const pannes = await Panne.find().populate('engin').sort({ date: -1 });
    res.json(pannes);
});

app.post('/api/pannes', authenticateToken, authorizeRole(['Admin', 'Gestionnaire', 'Observateur']), async (req, res) => {
    try {
        const { engin, description, gravite, date } = req.body;
        const newPanne = new Panne({ engin, description, gravite, date });
        await newPanne.save();

        // Si panne critique, on bloque l'engin
        if (gravite === 'Critique') {
            await Engin.findByIdAndUpdate(engin, { statut: 'En panne' });
        }

        await logAction(req.user.username, 'Signalement Panne', `Engin: ${engin} - ${gravite}`);
        await createNotification(`Panne ${gravite} signalée sur l'engin ${engin}`, 'warning');
        res.status(201).json(newPanne);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/pannes/:id/resolve', authenticateToken, authorizeRole(['Admin', 'Gestionnaire']), async (req, res) => {
    try {
        const panne = await Panne.findById(req.params.id);
        if (!panne) return res.status(404).json({ error: 'Panne non trouvée' });

        panne.statut = 'Résolue';
        panne.date_resolution = new Date();
        await panne.save();

        // On tente de libérer l'engin (si pas d'autres pannes critiques) - Simplification: on remet dispo
        await Engin.findByIdAndUpdate(panne.engin, { statut: 'Disponible' });
        
        await logAction(req.user.username, 'Résolution Panne', `ID: ${req.params.id}`);
        res.json(panne);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// Utilisateurs (Admin)
app.get('/api/users', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    const users = await User.find({}, '-password'); // Ne pas renvoyer les mots de passe
    res.json(users);
});

app.delete('/api/users/:id', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    await logAction(req.user.username, 'Suppression Utilisateur', `ID: ${req.params.id}`);
    res.json({ success: true });
});

// --- SAUVEGARDE & RESTAURATION (Niveau 5) ---

app.get('/api/admin/backup', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Vérification rôle Admin (via le token décodé dans req.user)
        // Note: Pour simplifier, on suppose que l'accès à cette route est protégé par l'UI, 
        // mais idéalement on vérifierait req.user.role === 'Admin'

        const backup = {
            users: await User.find(),
            engins: await Engin.find(),
            chantiers: await Chantier.find(),
            locations: await Location.find(),
            maintenances: await Maintenance.find(),
            pannes: await Panne.find(),
            logs: await Log.find(),
            date: new Date()
        };
        res.json(backup);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/restore', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.engins) return res.status(400).json({ error: "Fichier de sauvegarde invalide" });

        // Nettoyage complet
        await Promise.all([User.deleteMany({}), Engin.deleteMany({}), Chantier.deleteMany({}), Location.deleteMany({}), Maintenance.deleteMany({}), Panne.deleteMany({}), Log.deleteMany({})]);

        // Restauration
        if(data.users) await User.insertMany(data.users);
        if(data.engins) await Engin.insertMany(data.engins);
        if(data.chantiers) await Chantier.insertMany(data.chantiers);
        if(data.locations) await Location.insertMany(data.locations);
        if(data.maintenances) await Maintenance.insertMany(data.maintenances);
        if(data.pannes) await Panne.insertMany(data.pannes);
        if(data.logs) await Log.insertMany(data.logs);

        await logAction(req.user.username, 'Restauration BD', 'Base de données restaurée depuis une sauvegarde');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ROUTE DE PEUPLEMENT (SEED) ---
app.get('/api/seed', authenticateToken, authorizeRole(['Admin']), async (req, res) => {
    try {
        // Nettoyage préventif
        await Engin.deleteMany({});
        await Chantier.deleteMany({});
        await Location.deleteMany({});
        await Maintenance.deleteMany({});
        await Panne.deleteMany({});
        await User.deleteMany({}); // On nettoie aussi les users pour recréer l'admin par défaut

        // 0. Admin par défaut
        const hashedAdminPassword = await bcrypt.hash('admin', 10);
        await User.create({ username: 'admin', password: hashedAdminPassword, role: 'Admin' });

        // 1. Engins
        const engins = await Engin.insertMany([
            { code_engin: 'E-101', famille: 'Pelle', categorie: 'Chenilles', marque: 'Caterpillar', modele: '320', numero_serie: 'CAT-320-A1', statut: 'Disponible', cout_jour: 500 },
            { code_engin: 'E-102', famille: 'Grue', categorie: 'Mobile', marque: 'Liebherr', modele: 'LTM 1060', numero_serie: 'LIEB-60-X2', statut: 'Loué', cout_jour: 1200 },
            { code_engin: 'E-103', famille: 'Camion', categorie: 'Benne', marque: 'Volvo', modele: 'FMX', numero_serie: 'VOL-FMX-99', statut: 'Maintenance', cout_jour: 350, date_derniere_maintenance: new Date() },
            { code_engin: 'E-104', famille: 'Chargeuse', categorie: 'Pneus', marque: 'Komatsu', modele: 'WA 470', numero_serie: 'KOM-WA-47', statut: 'Disponible', cout_jour: 450 }
        ]);

        // 2. Chantiers
        const chantiers = await Chantier.insertMany([
            { chef_projet: 'M. Dupont', localisation: 'Paris - Stade', latitude: 48.8566, longitude: 2.3522, statut: 'Actif' },
            { chef_projet: 'Mme. Martin', localisation: 'Lyon - Autoroute A7', latitude: 45.7640, longitude: 4.8357, statut: 'Actif' },
            { chef_projet: 'M. Bernard', localisation: 'Bordeaux - Pont', latitude: 44.8378, longitude: -0.5792, statut: 'Inactif' }
        ]);

        // 3. Locations
        await Location.insertMany([
            { 
                engin: engins[1]._id, // Grue (Loué)
                chantier: chantiers[0]._id, // Paris
                date_debut: new Date(), 
                date_fin: new Date(new Date().setDate(new Date().getDate() + 15)), // +15 jours
                statut: 'En cours',
                notes: 'Montage structure métallique',
                cout_total: 18000
            },
            { 
                engin: engins[0]._id, // Pelle (Disponible maintenant, mais a une loc passée)
                chantier: chantiers[1]._id, // Lyon
                date_debut: new Date('2023-01-01'), 
                date_fin: new Date('2023-02-01'), 
                statut: 'Terminée',
                notes: 'Terrassement initial',
                cout_total: 15500
            }
        ]);

        // 4. Maintenance
        await Maintenance.insertMany([
            {
                engin: engins[2]._id, // Camion (Maintenance)
                date: new Date(),
                cout: 250,
                type_maintenance: 'Curative',
                technicien: 'Atelier Central',
                notes: 'Révision complète'
            }
        ]);

        await logAction('Admin', 'Seed Data', 'Réinitialisation de la base de données');
        res.json({ success: true, message: 'Données de test ajoutées avec succès !' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route par défaut pour le frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur SGTM Web lancé sur http://localhost:${PORT}`);
});