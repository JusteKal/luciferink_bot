# LuciferInk Bot

Bot Discord complet pour la gestion d'un serveur de tatouage : modération, anniversaires, niveaux, tickets, Instagram, et plus !

## 🚀 Installation

### Prérequis
- Node.js v18+
- MariaDB ou MySQL
- Un serveur Discord et un bot Discord (token)

### 1. Clonez le projet
```bash
# Clonez le repo
https://github.com/JusteKal/luciferink_bot.git
cd luciferink_bot
```

### 2. Installez les dépendances
```bash
npm install
```

### 3. Configurez l'environnement
Créez un fichier `.env` à la racine du dossier `luciferink_bot` (ou modifiez l'existant) :
```env
DISCORD_TOKEN=VotreTokenIci
CLIENT_ID=VotreClientID
GUILD_ID=VotreGuildID
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=VotreMotDePasse
DB_NAME=luciferink_bot
BOT_CREATED_AT=2025-08-07
```

### 4. Créez la base de données
Lancez le script SQL :
```bash
mysql -u root -p luciferink_bot < setup_database.sql
```

### 5. Démarrez le bot
```bash
npm start
```

## ⚙️ Fonctionnalités principales

- **Modération** : ban, kick, timeout, clear, roles, reglement
- **Tickets** : système de support par salon dédié
- **Anniversaires** : notification automatique des anniversaires
- **Niveaux** : classement et progression des membres
- **Instagram** : monitoring des posts
- **Bienvenue** : message d'accueil personnalisé
- **Commandes slash** : toutes les commandes sont accessibles via `/`
- **Statut dynamique** : le bot alterne entre plusieurs statuts, dont "En ligne depuis ... jours"

## 📦 Structure du projet

```
├── commands/           # Commandes Discord
├── database/           # Gestion de la base de données
├── events/             # Events Discord (ready, message, etc.)
├── utils/              # Outils (scraper Instagram, checker anniversaire...)
├── luciferink_bot/     # Fichiers de config et .env
├── index.js            # Point d'entrée principal
├── setup_database.sql  # Script SQL pour la base
├── package.json        # Dépendances
```

## 🛠️ Développement
- Pour recharger les commandes slash : redémarrez le bot
- Pour modifier les statuts : éditez le tableau `statuses` dans `index.js`
- Pour ajouter des commandes : ajoutez un fichier dans `commands/`

## 📝 Contribuer
Les PR sont les bienvenues !

## 📄 Licence
MIT

---
Pour toute question, contactez JusteKal sur Discord.
