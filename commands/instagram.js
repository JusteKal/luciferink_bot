const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('instagram')
        .setDescription('Configure Instagram feed pour ce serveur')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure le feed Instagram')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Instagram (sans @)')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel où poster les nouveaux posts')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Voir la configuration actuelle'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Désactiver le feed Instagram'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Tester le scraping d\'un compte Instagram')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Nom d\'utilisateur Instagram à tester')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Vérifier les permissions
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await interaction.reply({
                content: '❌ Vous devez avoir la permission "Gérer les salons" pour utiliser cette commande.',
                flags: 64
            });
        }

        try {
            if (subcommand === 'setup') {
                const username = interaction.options.getString('username').toLowerCase().replace('@', '');
                const channel = interaction.options.getChannel('channel');

                // Valider le nom d'utilisateur Instagram
                if (!/^[a-zA-Z0-9._]+$/.test(username)) {
                    return await interaction.reply({
                        content: '❌ Nom d\'utilisateur Instagram invalide. Utilisez uniquement des lettres, chiffres, points et underscores.',
                        flags: 64
                    });
                }

                // Sauvegarder dans la base de données
                await interaction.client.db.setInstagramConfig(
                    interaction.guildId,
                    username,
                    channel.id
                );

                const embed = new EmbedBuilder()
                    .setTitle('✅ Instagram Feed Configuré')
                    .setDescription(`Le feed Instagram de **@${username}** a été configuré avec succès !`)
                    .addFields(
                        { name: '📱 Compte', value: `@${username}`, inline: true },
                        { name: '📺 Channel', value: `${channel}`, inline: true }
                    )
                    .setColor(0xE4405F)
                    .setFooter({ text: '⚠️ Le scraping Instagram peut être détecté. Utilisez avec précaution.' });

                await interaction.reply({ embeds: [embed], flags: 64 });

            } else if (subcommand === 'status') {
                const config = await interaction.client.db.getInstagramConfig(interaction.guildId);

                if (!config) {
                    return await interaction.reply({
                        content: '❌ Aucune configuration Instagram trouvée pour ce serveur.',
                        flags: 64
                    });
                }

                const channel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);
                const channelText = channel ? `<#${config.channel_id}>` : 'Channel supprimé';

                const embed = new EmbedBuilder()
                    .setTitle('📱 Configuration Instagram')
                    .addFields(
                        { name: '👤 Compte suivi', value: `@${config.username}`, inline: true },
                        { name: '📺 Channel', value: channelText, inline: true },
                        { name: '🔄 Statut', value: config.enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
                        { name: '📅 Configuré le', value: new Date(config.created_at).toLocaleDateString('fr-FR'), inline: true }
                    )
                    .setColor(0xE4405F);

                await interaction.reply({ embeds: [embed], flags: 64 });

            } else if (subcommand === 'disable') {
                const config = await interaction.client.db.getInstagramConfig(interaction.guildId);

                if (!config) {
                    return await interaction.reply({
                        content: '❌ Aucune configuration Instagram trouvée pour ce serveur.',
                        flags: 64
                    });
                }

                await interaction.client.db.run(
                    'UPDATE instagram_configs SET enabled = 0 WHERE guild_id = ?',
                    [interaction.guildId]
                );

                await interaction.reply({
                    content: '✅ Le feed Instagram a été désactivé.',
                    flags: 64
                });

            } else if (subcommand === 'test') {
                const username = interaction.options.getString('username').toLowerCase().replace('@', '');

                await interaction.deferReply({ flags: 64 });

                try {
                    const InstagramScraper = require('../utils/instagramScraper');
                    const scraper = new InstagramScraper();
                    
                    const result = await scraper.testScrape(username);
                    
                    if (result.success) {
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Test de Scraping Réussi')
                            .setDescription(`Le compte **@${username}** est accessible.`)
                            .addFields(
                                { name: '📊 Posts trouvés', value: result.postsCount.toString(), inline: true },
                                { name: '👤 Compte vérifié', value: result.isVerified ? '✅ Oui' : '❌ Non', inline: true },
                                { name: '🔒 Compte privé', value: result.isPrivate ? '🔒 Oui' : '🌐 Public', inline: true }
                            )
                            .setColor(0x00FF00);

                        await interaction.editReply({ embeds: [embed] });
                    } else {
                        await interaction.editReply({
                            content: `❌ Erreur lors du test : ${result.error}`
                        });
                    }
                } catch (error) {
                    console.error('Erreur test Instagram:', error);
                    await interaction.editReply({
                        content: '❌ Erreur lors du test de scraping Instagram.'
                    });
                }
            }
        } catch (error) {
            console.error('Erreur dans la commande Instagram:', error);
            const errorMessage = { content: '❌ Erreur lors de l\'exécution de la commande.', flags: 64 };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};
