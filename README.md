# 🏗️ Système de Gestion de Location d'Engins - SGTM

**Une application moderne et complète pour gérer les locations d'engins de chantier.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.8%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 📋 Table des Matières

- [✨ Fonctionnalités](#-fonctionnalités)
- [🎨 Caractéristiques](#-caractéristiques)
- [💾 Architecture](#-architecture)
- [🚀 Installation](#-installation)
- [📖 Guide d'Utilisation](#-guide-dutilisation)
- [🏗️ Structure du Projet](#️-structure-du-projet)
- [🛠️ Technologies](#️-technologies)
- [🔒 Sécurité](#-sécurité)
- [📞 Support](#-support)

---

## ✨ Fonctionnalités

### 📦 Gestion des Engins
- ✅ **Ajouter** des engins avec détails complets
  - Code Engin (unique)
  - Famille (Pelle, Grue, Compacteur, etc.)
  - Catégorie (Classification)
  - Marque (CAT, Komatsu, etc.)
  - Modèle
  - Numéro de Série (unique)
  
- ✅ **Afficher** la liste complète des engins
- ✅ **Modifier** les informations des engins
- ✅ **Supprimer** des engins (avec confirmation)

### 🏗️ Gestion des Chantiers
- ✅ **Ajouter** des chantiers
  - Chef de Projet
  - Localisation
  
- ✅ **Afficher** les chantiers disponibles
- ✅ **Modifier** les informations des chantiers
- ✅ **Supprimer** des chantiers (marquage comme inactif)

### 🚚 Gestion des Locations
- ✅ **Ajouter** des locations
  - Sélection de l'engin
  - Sélection du chantier
  - Dates de location
  - Notes optionnelles
  
- ✅ **Afficher** toutes les locations avec détails complets
- ✅ **Vérifier** la disponibilité des engins automatiquement
- ✅ **Modifier** les locations et leurs statuts
- ✅ **Annuler** les locations

### 📅 Planning Dynamique
- ✅ **Calendrier** moderne et interactif
- ✅ **Visualisation** des locations par date
- ✅ **Surlignage** automatique des jours avec locations
- ✅ **Détails** des locations sélectionnées
- ✅ **Statuts** en temps réel

---

## 🎨 Caractéristiques

### Design et UX
- **Interface moderne** : Design épuré et professionnel
- **Thème élégant** : Palette de couleurs harmonieuse (bleu #1e3a8a)
- **Responsive** : Adaptation à différentes résolutions d'écran
- **Ergonomique** : Navigation intuitive par onglets
- **Accessibilité** : Emojis et icônes pour meilleure clarté

### Interface Utilisateur
- **Onglets** : Organisation logique des fonctionnalités
- **Tableaux** : Affichage structuré des données avec scrollbars
- **Boutons** : Actions claires avec codes couleurs
  - 🟢 Vert : Actions positives (Ajouter, Enregistrer)
  - 🔴 Rouge : Actions dangereuses (Supprimer, Annuler)
  - 🔵 Bleu : Actions neutres (Modifier, Actualiser)
  
- **Dialogues** : Fenêtres modales pour formulaires
- **Calendrier** : Widget interactif avec sélection de dates

### Performance
- **Base de données légère** : SQLite3 pour rapidité
- **Pas de connexion Internet** : Fonctionnement entièrement local
- **Démarrage rapide** : Application réactive
- **Gestion des erreurs** : Messages d'erreur clairs

---

## 💾 Architecture

### Structure des Données

```
Engins
├── ID (clé primaire)
├── Code Engin (unique)
├── Famille
├── Catégorie
├── Marque
├── Modèle
├── Numéro de Série (unique)
├── Statut
└── Date Création

Chantiers
├── ID (clé primaire)
├── Chef de Projet
├── Localisation
├── Statut (Actif/Inactif)
└── Date Création

Locations
├── ID (clé primaire)
├── ID Engin (clé étrangère)
├── ID Chantier (clé étrangère)
├── Date Début
├── Date Fin
├── Date Location
├── Statut (En cours/Terminée/Annulée)
└── Notes
```

### Diagramme UML Simplifié

```
┌──────────────────┐
│    ENGINS        │
├──────────────────┤
│ id (PK)          │
│ code_engin       │
│ famille          │
│ categorie        │
│ marque           │
│ modele           │
│ numero_serie     │
└──────────────────┘
       ▲
       │
       │ 1:N
       │
┌──────────────────┐         ┌──────────────────┐
│  LOCATIONS       │◄────────│   CHANTIERS      │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ engin_id (FK)────┤         │ chef_projet      │
│ chantier_id (FK)─┼────────►│ localisation     │
│ date_debut       │         │ statut           │
│ date_fin         │         └──────────────────┘
│ statut           │
│ notes            │
└──────────────────┘
```

---

## 🚀 Installation

### Prérequis
- **Python** : 3.8 ou supérieur
- **pip** : Gestionnaire de paquets Python
- **Espace disque** : 50 MB minimum

### Installation Étape par Étape

#### 1. Télécharger le Projet
```bash
git clone https://github.com/votre-repo/SGTM.git
cd SGTM
```

#### 2. Installer les Dépendances
```bash
pip install -r requirements.txt
```

#### 3. Lancer l'Application

**Windows :**
```bash
start.bat
```
ou
```bash
python main.py
```

**Linux/Mac :**
```bash
./start.sh
```
ou
```bash
python3 main.py
```

### Vérification de l'Installation
```bash
python -c "import main; print('✓ Installation réussie')"
```

---

## 📖 Guide d'Utilisation

Pour un guide complet et détaillé, consultez [`GUIDE_UTILISATION.md`](./GUIDE_UTILISATION.md)

### Démarrage Rapide

**1. Ajouter un Engin**
- Onglet "📦 Engins" → "➕ Ajouter Engin"
- Remplissez les informations
- Cliquez "💾 Enregistrer"

**2. Créer un Chantier**
- Onglet "🏗️ Chantiers" → "➕ Ajouter Chantier"
- Remplissez Chef de Projet et Localisation
- Cliquez "💾 Enregistrer"

**3. Ajouter une Location**
- Onglet "🚚 Locations" → "➕ Ajouter Location"
- Sélectionnez Engin et Chantier
- Indiquez les dates
- Cliquez "💾 Enregistrer"

**4. Consulter le Planning**
- Onglet "📅 Planning"
- Cliquez sur une date pour voir les locations

---

## 🏗️ Structure du Projet

```
mini projet/
│
├── main.py                      # Point d'entrée principal
├── setup.py                     # Script de configuration
├── requirements.txt             # Dépendances Python
│
├── database/
│   ├── __init__.py
│   ├── db_manager.py           # Gestion complète de la BD
│   └── gestion_location.db      # Fichier de BD (généré)
│
├── ui/
│   ├── __init__.py
│   ├── engins_modern.py         # Interface Engins (tkinter)
│   ├── chantiers_modern.py      # Interface Chantiers (tkinter)
│   ├── locations_modern.py      # Interface Locations (tkinter)
│   ├── planning_modern.py       # Interface Planning (tkinter)
│   └── dialogs_modern.py        # Dialogues et formulaires
│
├── start.bat                    # Script démarrage Windows
├── start.sh                     # Script démarrage Linux/Mac
│
├── README.md                    # Cette documentation
├── GUIDE_UTILISATION.md         # Guide détaillé
└── .gitignore                   # Fichiers à ignorer
```

---

## 🛠️ Technologies

### Stack Principal
- **Python** 3.8+ : Langage de programmation
- **tkinter** : Interface graphique native (incluse avec Python)
- **SQLite3** : Base de données (incluse avec Python)
- **tkcalendar** 1.6.1 : Widget calendrier moderne

### Avantages de cette Stack
- ✅ **Zéro dépendances externes lourdes** (sauf tkcalendar)
- ✅ **Portable** : Fonctionne sur Windows, Linux, macOS
- ✅ **Léger** : Peu de ressources requises
- ✅ **Rapide** : Démarrage instantané
- ✅ **Maintenu** : Python et tkinter sont très stables

---

## 🔒 Sécurité et Intégrité

### Contraintes de Données
```
✓ Codes engins : Uniques (pas de doublons)
✓ Numéros de série : Uniques (pas de doublons)
✓ Disponibilité : Vérifiée avant chaque location
✓ Dates : Format ISO (YYYY-MM-DD)
✓ Intégrité référentielle : Clés étrangères appliquées
```

### Protections
- **Confirmations** : Actions dangereuses nécessitent confirmation
- **Validation** : Vérification des champs obligatoires
- **Transactions** : Cohérence des données garantie
- **Gestion d'erreurs** : Messages clairs en cas de problème

### Backup
```bash
# Sauvegarde manuelle (optionnelle)
cp database/gestion_location.db gestion_location.db.backup
```

---

## 📊 Statistiques du Projet

| Catégorie | Nombre |
|-----------|--------|
| Fichiers Python | 8 |
| Lignes de code | ~2500 |
| Fonctionnalités | 20+ |
| Onglets/Sections | 4 |
| Tables BD | 3 |
| Dialogues | 3 |

---

## 🐛 Dépannage

### Problème : L'application ne démarre pas
**Solution :**
```bash
# Vérifiez Python
python --version

# Réinstallez les dépendances
pip install --upgrade -r requirements.txt

# Réessayez
python main.py
```

### Problème : Erreur de base de données
**Solution :**
```bash
# Supprimez la BD existante
rm database/gestion_location.db

# Relancez l'application (créera une nouvelle BD)
python main.py
```

### Problème : Le calendrier ne s'affiche pas
**Solution :**
```bash
# Réinstallez tkcalendar
pip install --upgrade tkcalendar
```

---

## 🚀 Améliorations Futures

- [ ] Export des données en PDF/Excel
- [ ] Historique complet des locations
- [ ] Rapports d'utilisation et statistiques
- [ ] Alertes de maintenance
- [ ] Système de authentification
- [ ] Dashboard statistiques
- [ ] Recherche et filtrage avancés
- [ ] Support multi-utilisateurs
- [ ] Sauvegarde cloud
- [ ] Application mobile

---

## 📝 Conventions de Code

### Nommage
```python
# Variables et fonctions : snake_case
engin_id = 1
def get_all_engins():
    pass

# Classes : PascalCase
class LocationDialog:
    pass

# Constantes : UPPER_SNAKE_CASE
PRIMARY_COLOR = "#1e3a8a"
```

### Style
```python
# PEP 8 : Respecté
# Commentaires : Clairs et concis
# Docstrings : Présentes pour les fonctions publiques
# Longueur ligne : Max 100 caractères
```

---

## 📄 Licence

MIT License - Libre d'utilisation

---

## 👥 Contribution

Les contributions sont bienvenues !

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pushez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📧 Contact et Support

- **Email** : support@sgtm.local
- **Documentation** : Consultez [`GUIDE_UTILISATION.md`](./GUIDE_UTILISATION.md)
- **Issues** : Signalez les bugs via GitHub Issues
- **Suggestions** : Vos retours sont importants !

---

## 🙏 Remerciements

- Merci aux utilisateurs pour leurs retours
- Merci à la communauté Python
- Merci à tkinter pour cette excellente bibliothèque

---

## 📅 Historique des Versions

### Version 1.0.0 (Décembre 2024)
- ✨ Première version stable
- 📦 Gestion complète des engins
- 🏗️ Gestion complète des chantiers
- 🚚 Gestion complète des locations
- 📅 Planning interactif
- 🎨 Interface moderne et ergonomique

---

**Dernière mise à jour** : Décembre 2024  
**Auteur** : SGTM Development Team  
**Status** : Production Ready ✅


