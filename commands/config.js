const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure les paramètres du bot')
        .addSubcommand(subcommand =>
            subcommand
                .setName('bienvenue')
                .setDescription('Configure le système de bienvenue')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel pour les messages de bienvenue')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('actif')
                        .setDescription('Activer ou désactiver les messages de bienvenue')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('anniversaires')
                .setDescription('Configure le système d\'anniversaires')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel pour les messages d\'anniversaire')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('actif')
                        .setDescription('Activer ou désactiver les messages d\'anniversaire')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Configure le channel des logs de modération')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel pour les logs de modération')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('tickets')
                .setDescription('Configure le système de tickets')
                .addChannelOption(option =>
                    option.setName('categorie')
                        .setDescription('Catégorie où créer les tickets')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('niveaux')
                .setDescription('Configure le système de niveaux')
                .addBooleanOption(option =>
                    option.setName('actif')
                        .setDescription('Activer ou désactiver le système de niveaux')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'bienvenue':
                    const welcomeChannel = interaction.options.getChannel('channel');
                    const welcomeActive = interaction.options.getBoolean('actif') ?? true;
                    
                    await interaction.client.db.setGuildConfig(interaction.guildId, {
                        welcome_channel_id: welcomeChannel.id,
                        welcome_enabled: welcomeActive ? 1 : 0
                    });
                    
                    await interaction.reply({
                        content: `✅ Système de bienvenue configuré !\n• Channel: ${welcomeChannel}\n• Statut: ${welcomeActive ? 'Activé' : 'Désactivé'}`,
                        flags: 64 // Ephemeral flag
                    });
                    break;

                case 'anniversaires':
                    const birthdayChannel = interaction.options.getChannel('channel');
                    const birthdayActive = interaction.options.getBoolean('actif') ?? true;
                    
                    await interaction.client.db.setGuildConfig(interaction.guildId, {
                        birthday_channel_id: birthdayChannel.id,
                        birthday_enabled: birthdayActive ? 1 : 0
                    });
                    
                    await interaction.reply({
                        content: `✅ Système d'anniversaires configuré !\n• Channel: ${birthdayChannel}\n• Statut: ${birthdayActive ? 'Activé' : 'Désactivé'}`,
                        flags: 64 // Ephemeral flag
                    });
                    break;

                case 'logs':
                    const logsChannel = interaction.options.getChannel('channel');
                    
                    await interaction.client.db.setGuildConfig(interaction.guildId, {
                        logs_channel_id: logsChannel.id
                    });
                    
                    await interaction.reply({
                        content: `✅ Channel des logs configuré : ${logsChannel}`,
                        flags: 64 // Ephemeral flag
                    });
                    break;

                case 'tickets':
                    const ticketCategory = interaction.options.getChannel('categorie');
                    
                    if (ticketCategory.type !== 4) { // 4 = CategoryChannel
                        return await interaction.reply({
                            content: '❌ Vous devez sélectionner une catégorie, pas un channel.',
                            flags: 64 // Ephemeral flag
                        });
                    }
                    
                    await interaction.client.db.setGuildConfig(interaction.guildId, {
                        ticket_category_id: ticketCategory.id
                    });
                    
                    await interaction.reply({
                        content: `✅ Catégorie des tickets configurée : ${ticketCategory.name}`,
                        flags: 64 // Ephemeral flag
                    });
                    break;

                case 'niveaux':
                    const levelsActive = interaction.options.getBoolean('actif');
                    
                    await interaction.client.db.setGuildConfig(interaction.guildId, {
                        levels_enabled: levelsActive ? 1 : 0
                    });
                    
                    await interaction.reply({
                        content: `✅ Système de niveaux ${levelsActive ? 'activé' : 'désactivé'} !`,
                        flags: 64 // Ephemeral flag
                    });
                    break;
            }
        } catch (error) {
            console.error('Erreur lors de la configuration:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la configuration.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
