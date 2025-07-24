require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('./database/database');
const cron = require('node-cron');
const InstagramMonitor = require('./utils/instagramMonitor');

// Création du client Discord avec les intents nécessaires
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration
    ]
});

// Collections pour stocker les commandes et events
client.commands = new Collection();
client.db = new Database();
client.instagramMonitor = new InstagramMonitor(client);

// Chargement des commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] La commande ${filePath} manque une propriété "data" ou "execute" requise.`);
    }
}

// Chargement des events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Gestion des interactions (slash commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Aucune commande correspondante ${interaction.commandName} trouvée.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const errorMessage = { content: 'Il y a eu une erreur en exécutant cette commande!', flags: 64 }; // 64 = Ephemeral flag
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Tâche cron pour vérifier les anniversaires (tous les jours à 0h)
cron.schedule('0 0 * * *', async () => {  // Minuit
    console.log('Vérification des anniversaires...');
    await require('./utils/birthdayChecker')(client);
});

// Statuts personnalisés
const statuses = [
    { type: ActivityType.Playing, text: 'avec l\'encre' },
    { type: ActivityType.Watching, text: 'les réservations' },
    { type: ActivityType.Playing, text: 'à tatouer' },
    { type: ActivityType.Custom, text: 'Réponds à vos mails' },
    { type: ActivityType.Listening, text: 'les demandes' },
    { type: ActivityType.Competing, text: 'dans l\'art du tatouage' },
    { type: ActivityType.Watching, text: 'les clients' }
];

let currentStatusIndex = 0;

// Fonction pour changer le statut
function updateStatus() {
    if (client.user) {
        const status = statuses[currentStatusIndex];
        client.user.setActivity(status.text, { type: status.type });
        currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
    }
}

// Changer le statut toutes les 10 minutes
cron.schedule('*/10 * * * *', () => {
    updateStatus();
});

// Initialisation de la base de données et connexion du bot
client.once(Events.ClientReady, async () => {
    
    // Initialisation de la base de données
    await client.db.init();
    
    // Déploiement des commandes slash
    await deployCommands();
    
    // Définir le statut initial
    updateStatus();
    
    // Démarrer le moniteur Instagram
    await client.instagramMonitor.start();
    
    console.log(`${client.user.tag} est connecté et prêt !`);
});

// Fonction pour déployer les commandes slash
async function deployCommands() {
    const commands = [];
    
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`Début du rechargement de ${commands.length} commandes d'application (/).`);
        
        // Utiliser les commandes globales au lieu des commandes spécifiques au serveur
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Rechargement réussi de ${data.length} commandes d'application (/).`);
    } catch (error) {
        console.error(error);
    }
}

// Connexion du bot
client.login(process.env.DISCORD_TOKEN);

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
    console.log('\nArrêt du bot en cours...');
    await client.instagramMonitor.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nArrêt du bot en cours...');
    await client.instagramMonitor.stop();
    process.exit(0);
});
