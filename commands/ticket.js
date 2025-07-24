const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Gère le système de tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Crée un panel pour ouvrir des tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fermer')
                .setDescription('Ferme le ticket actuel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription('Ajoute un utilisateur au ticket')
                .addUserOption(option =>
                    option.setName('utilisateur')
                        .setDescription('Utilisateur à ajouter')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirer')
                .setDescription('Retire un utilisateur du ticket')
                .addUserOption(option =>
                    option.setName('utilisateur')
                        .setDescription('Utilisateur à retirer')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'panel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return await interaction.reply({
                        content: '❌ Vous n\'avez pas la permission de créer un panel de tickets.',
                        flags: 64 // Ephemeral flag
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎫 Support - Tickets')
                    .setDescription('Besoin d\'aide ? Créez un ticket en cliquant sur le bouton ci-dessous.\n\n' +
                                  '**Avant de créer un ticket :**\n' +
                                  '• Vérifiez si votre question n\'a pas déjà été posée\n' +
                                  '• Consultez les règles du serveur\n' +
                                  '• Soyez précis dans votre demande\n\n' +
                                  'Un membre du staff vous répondra dès que possible.')
                    .setColor('#FF9F43')
                    .setThumbnail(interaction.guild.iconURL())
                    .setFooter({ text: 'Cliquez sur le bouton pour ouvrir un ticket' });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('create_ticket')
                            .setLabel('Créer un Ticket')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎫')
                    );

                await interaction.reply({ embeds: [embed], components: [row] });

            } else if (subcommand === 'fermer') {
                const ticket = await interaction.client.db.getTicket(interaction.channelId);
                
                if (!ticket) {
                    return await interaction.reply({
                        content: '❌ Ce channel n\'est pas un ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }

                if (ticket.status === 'closed') {
                    return await interaction.reply({
                        content: '❌ Ce ticket est déjà fermé.',
                        flags: 64 // Ephemeral flag
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔒 Fermeture du Ticket')
                    .setDescription('Ce ticket va être fermé dans 10 secondes...\nCliquez sur "Annuler" pour annuler la fermeture.')
                    .setColor('#E74C3C')
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('cancel_close')
                            .setLabel('Annuler')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    );

                await interaction.reply({ embeds: [embed], components: [row] });

                // Attendre 10 secondes puis fermer
                setTimeout(async () => {
                    try {
                        await interaction.client.db.closeTicket(interaction.channelId);
                        await interaction.channel.delete();
                    } catch (error) {
                        console.error('Erreur lors de la fermeture du ticket:', error);
                    }
                }, 10000);

            } else if (subcommand === 'ajouter') {
                const ticket = await interaction.client.db.getTicket(interaction.channelId);
                
                if (!ticket) {
                    return await interaction.reply({
                        content: '❌ Ce channel n\'est pas un ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }

                const user = interaction.options.getUser('utilisateur');
                
                try {
                    await interaction.channel.permissionOverwrites.edit(user.id, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    });

                    await interaction.reply({
                        content: `✅ ${user} a été ajouté au ticket.`
                    });
                } catch (error) {
                    await interaction.reply({
                        content: '❌ Erreur lors de l\'ajout de l\'utilisateur.',
                        flags: 64 // Ephemeral flag
                    });
                }

            } else if (subcommand === 'retirer') {
                const ticket = await interaction.client.db.getTicket(interaction.channelId);
                
                if (!ticket) {
                    return await interaction.reply({
                        content: '❌ Ce channel n\'est pas un ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }

                const user = interaction.options.getUser('utilisateur');
                
                // Empêcher de retirer le créateur du ticket
                if (user.id === ticket.user_id) {
                    return await interaction.reply({
                        content: '❌ Vous ne pouvez pas retirer le créateur du ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }

                try {
                    await interaction.channel.permissionOverwrites.delete(user.id);

                    await interaction.reply({
                        content: `✅ ${user} a été retiré du ticket.`
                    });
                } catch (error) {
                    await interaction.reply({
                        content: '❌ Erreur lors du retrait de l\'utilisateur.',
                        flags: 64 // Ephemeral flag
                    });
                }
            }
        } catch (error) {
            console.error('Erreur dans la commande ticket:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'exécution de la commande.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
