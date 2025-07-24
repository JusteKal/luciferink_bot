const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Gestion du bouton d'acceptation des règlements
        if (interaction.isButton() && interaction.customId.startsWith('accept_rules_')) {
            const roleId = interaction.customId.replace('accept_rules_', '');
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (!role) {
                return await interaction.reply({
                    content: '❌ Le rôle configuré n\'existe plus.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (interaction.member.roles.cache.has(roleId)) {
                return await interaction.reply({
                    content: '✅ Tu as déjà accepté le règlement !',
                    flags: 64 // Ephemeral flag
                });
            }

            try {
                await interaction.member.roles.add(role);
                await interaction.reply({
                    content: `✅ Règlement accepté ! Tu as reçu le rôle ${role}.`,
                    flags: 64 // Ephemeral flag
                });
            } catch (error) {
                console.error('Erreur lors de l\'attribution du rôle:', error);
                await interaction.reply({
                    content: '❌ Erreur lors de l\'attribution du rôle.',
                    flags: 64 // Ephemeral flag
                });
            }
            return;
        }

        // Gestion des menus déroulants pour les rôles
        if (interaction.isStringSelectMenu() && interaction.customId === 'role_select') {
            try {
                const selectedRoles = interaction.values;
                const member = interaction.member;

                // Récupérer toutes les options de rôles pour ce menu
                const roleOptions = await interaction.client.db.all(
                    'SELECT role_id FROM role_options WHERE menu_id = ?',
                    [interaction.message.id]
                );

                const availableRoles = roleOptions.map(option => option.role_id);

                // Retirer tous les rôles du menu que l'utilisateur possède
                const rolesToRemove = member.roles.cache.filter(role => 
                    availableRoles.includes(role.id)
                );

                for (const role of rolesToRemove.values()) {
                    try {
                        await member.roles.remove(role);
                    } catch (error) {
                        console.error(`Erreur lors du retrait du rôle ${role.name}:`, error);
                    }
                }

                // Ajouter les nouveaux rôles sélectionnés
                const rolesToAdd = [];
                for (const roleId of selectedRoles) {
                    try {
                        const role = await interaction.guild.roles.fetch(roleId);
                        if (role) {
                            await member.roles.add(role);
                            rolesToAdd.push(role.name);
                        }
                    } catch (error) {
                        console.error(`Erreur lors de l'ajout du rôle ${roleId}:`, error);
                    }
                }

                let responseMessage = '';
                if (rolesToAdd.length > 0) {
                    responseMessage = `✅ Rôle(s) ajouté(s): ${rolesToAdd.join(', ')}`;
                } else {
                    responseMessage = '✅ Tous les rôles ont été retirés.';
                }

                await interaction.reply({
                    content: responseMessage,
                    flags: 64 // Ephemeral flag
                });

            } catch (error) {
                console.error('Erreur lors de la gestion des rôles:', error);
                await interaction.reply({
                    content: '❌ Erreur lors de la modification des rôles.',
                    flags: 64 // Ephemeral flag
                });
            }
        }

        // Gestion des boutons pour les tickets
        if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket') {
                try {
                    // Vérifier la configuration des tickets
                    const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
                    if (!guildConfig || !guildConfig.ticket_category_id) {
                        return await interaction.reply({
                            content: '❌ Le système de tickets n\'est pas configuré. Contactez un administrateur.',
                            flags: 64 // Ephemeral flag
                        });
                    }

                    // Vérifier si l'utilisateur a déjà un ticket ouvert
                    const existingTicket = await interaction.client.db.get(
                        'SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = ?',
                        [interaction.user.id, interaction.guildId, 'open']
                    );

                    if (existingTicket) {
                        return await interaction.reply({
                            content: `❌ Vous avez déjà un ticket ouvert: <#${existingTicket.channel_id}>`,
                            flags: 64 // Ephemeral flag
                        });
                    }

                    const category = await interaction.client.channels.fetch(guildConfig.ticket_category_id);
                    const ticketNumber = await interaction.client.db.getNextTicketNumber(interaction.guildId);

                    // Créer le channel de ticket
                    const ticketChannel = await interaction.guild.channels.create({
                        name: `ticket-${ticketNumber.toString().padStart(4, '0')}`,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.roles.everyone.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            },
                            {
                                id: interaction.client.user.id,
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.SendMessages,
                                    PermissionFlagsBits.ReadMessageHistory
                                ]
                            }
                        ]
                    });

                    // Enregistrer le ticket dans la base de données
                    await interaction.client.db.createTicket(
                        ticketChannel.id,
                        interaction.user.id,
                        interaction.guildId,
                        ticketNumber
                    );

                    // Message d'accueil dans le ticket
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle(`🎫 Ticket #${ticketNumber.toString().padStart(4, '0')}`)
                        .setDescription(`Bonjour ${interaction.user} !\n\nMerci d'avoir créé un ticket. Un membre du staff vous répondra bientôt.\n\n**Veuillez décrire votre problème ou votre demande en détail.**`)
                        .setColor('#3498DB')
                        .setTimestamp();

                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('close_ticket')
                                .setLabel('Fermer le Ticket')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🔒')
                        );

                    await ticketChannel.send({
                        content: `${interaction.user}`,
                        embeds: [welcomeEmbed],
                        components: [actionRow]
                    });

                    await interaction.reply({
                        content: `✅ Ticket créé: ${ticketChannel}`,
                        flags: 64 // Ephemeral flag
                    });

                } catch (error) {
                    console.error('Erreur lors de la création du ticket:', error);
                    await interaction.reply({
                        content: '❌ Erreur lors de la création du ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }
            }

            if (interaction.customId === 'close_ticket') {
                const ticket = await interaction.client.db.getTicket(interaction.channelId);
                
                if (!ticket) {
                    return await interaction.reply({
                        content: '❌ Ce channel n\'est pas un ticket.',
                        flags: 64 // Ephemeral flag
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔒 Fermeture du Ticket')
                    .setDescription('Ce ticket va être fermé dans 5 secondes...')
                    .setColor('#E74C3C')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                setTimeout(async () => {
                    try {
                        await interaction.client.db.closeTicket(interaction.channelId);
                        await interaction.channel.delete();
                    } catch (error) {
                        console.error('Erreur lors de la fermeture du ticket:', error);
                    }
                }, 5000);
            }

            if (interaction.customId === 'cancel_close') {
                try {
                    await interaction.update({
                        content: '✅ Fermeture du ticket annulée.',
                        embeds: [],
                        components: []
                    });
                } catch (error) {
                    console.error('Erreur lors de l\'annulation:', error);
                }
            }
        }
    },
};
