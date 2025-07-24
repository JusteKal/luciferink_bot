const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Bot prêt ! Connecté en tant que ${client.user.tag}`);
        console.log(`Présent sur ${client.guilds.cache.size} serveur(s)`);
    },
};
