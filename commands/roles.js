const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

// Fonction pour valider et formatter les emojis
function validateEmoji(emoji, guild) {
    if (!emoji || emoji.trim() === '') return null;
    
    emoji = emoji.trim();
    
    // Si c'est un emoji Unicode standard (couvre une large gamme)
    if (/^[\u{1F000}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]$/u.test(emoji)) {
        return emoji;
    }
    
    // Si c'est un emoji Discord standard au format :nom: (très permissif)
    if (/^:[a-zA-Z0-9_+-]+:$/.test(emoji)) {
        return emoji;
    }
    
    // Si c'est déjà au bon format Discord personnalisé (<:nom:id> ou <a:nom:id>)
    if (/^<a?:[a-zA-Z0-9_+-]+:\d+>$/.test(emoji)) {
        return emoji;
    }
    
    // Si ce n'est que le nom sans les :, l'ajouter automatiquement
    if (/^[a-zA-Z0-9_+-]+$/.test(emoji) && !emoji.match(/^\d+$/)) {
        return `:${emoji}:`;
    }
    
    // Si c'est juste l'ID d'un emoji, essayer de le convertir
    if (/^\d+$/.test(emoji)) {
        const customEmoji = guild.emojis.cache.get(emoji);
        if (customEmoji) {
            return customEmoji.toString();
        }
    }
    
    // Si c'est le nom d'un emoji personnalisé (sans les : :), essayer de le trouver
    const emojiName = emoji.replace(/^:/, '').replace(/:$/, '');
    const customEmoji = guild.emojis.cache.find(e => e.name === emojiName);
    if (customEmoji) {
        return customEmoji.toString();
    }
    
    // Si rien ne fonctionne, retourner null
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Gère les menus de rôles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('creer')
                .setDescription('Crée un nouveau menu de rôles')
                .addStringOption(option =>
                    option.setName('titre')
                        .setDescription('Titre du menu de rôles')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description du menu de rôles')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription('Ajoute un rôle à un menu existant')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID du message du menu de rôles')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Rôle à ajouter')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji pour ce rôle')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('label')
                        .setDescription('Nom affiché pour ce rôle')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description de ce rôle')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('supprimer')
                .setDescription('Supprime un rôle d\'un menu existant')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID du message du menu de rôles')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Rôle à supprimer')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'creer') {
                const titre = interaction.options.getString('titre');
                const description = interaction.options.getString('description') || 'Sélectionnez un rôle dans le menu déroulant ci-dessous.';

                const embed = new EmbedBuilder()
                    .setTitle(`🎭 ${titre}`)
                    .setDescription(description)
                    .setColor('#4ECDC4')
                    .setFooter({ text: 'Sélectionnez un rôle dans le menu ci-dessous' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('role_select')
                            .setPlaceholder('Choisissez un rôle...')
                            .setMinValues(0)
                            .setMaxValues(1)
                            .addOptions([
                                {
                                    label: 'Aucun rôle configuré',
                                    description: 'Utilisez /roles ajouter pour ajouter des rôles',
                                    value: 'placeholder',
                                    emoji: '❌'
                                }
                            ])
                    );

                const message = await interaction.reply({ 
                    embeds: [embed], 
                    components: [row]
                });
                
                const fetchedMessage = await interaction.fetchReply();

                // Sauvegarder le menu dans la base de données
                await interaction.client.db.run(
                    'INSERT INTO role_menus (message_id, channel_id, guild_id, title, description) VALUES (?, ?, ?, ?, ?)',
                    [fetchedMessage.id, interaction.channelId, interaction.guildId, titre, description]
                );

            } else if (subcommand === 'ajouter') {
                const messageId = interaction.options.getString('message_id');
                const role = interaction.options.getRole('role');
                const rawEmoji = interaction.options.getString('emoji') || '🔸';
                const label = interaction.options.getString('label') || role.name;
                const roleDescription = interaction.options.getString('description') || `Obtenez le rôle ${role.name}`;

                // Valider l'emoji
                const emoji = validateEmoji(rawEmoji, interaction.guild);
                if (!emoji) {
                    return await interaction.reply({
                        content: '❌ Emoji invalide. Utilisez un emoji Unicode standard, un emoji personnalisé du serveur, ou l\'ID/nom d\'un emoji personnalisé.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Vérifier que le menu existe
                const menu = await interaction.client.db.get(
                    'SELECT * FROM role_menus WHERE message_id = ? AND guild_id = ?',
                    [messageId, interaction.guildId]
                );

                if (!menu) {
                    return await interaction.reply({
                        content: '❌ Menu de rôles introuvable. Vérifiez l\'ID du message.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Vérifier si le rôle existe déjà dans ce menu
                const existingRole = await interaction.client.db.get(
                    'SELECT * FROM role_options WHERE menu_id = ? AND role_id = ?',
                    [messageId, role.id]
                );

                if (existingRole) {
                    return await interaction.reply({
                        content: `❌ Le rôle ${role} est déjà dans ce menu.`,
                        flags: 64 // Ephemeral flag
                    });
                }

                // Ajouter le rôle aux options
                await interaction.client.db.run(
                    'INSERT INTO role_options (menu_id, role_id, emoji, label, description) VALUES (?, ?, ?, ?, ?)',
                    [messageId, role.id, emoji, label, roleDescription]
                );

                // Récupérer toutes les options pour ce menu
                const options = await interaction.client.db.all(
                    'SELECT * FROM role_options WHERE menu_id = ?',
                    [messageId]
                );

                // Supprimer les doublons potentiels en gardant seulement les entrées uniques par role_id
                const uniqueOptions = [];
                const seenRoles = new Set();
                
                for (const option of options) {
                    if (!seenRoles.has(option.role_id)) {
                        seenRoles.add(option.role_id);
                        uniqueOptions.push(option);
                    }
                }

                // Reconstruire le menu
                const selectOptions = uniqueOptions.map(option => {
                    const selectOption = {
                        label: option.label,
                        description: option.description,
                        value: option.role_id
                    };
                    
                    // Valider et ajouter l'emoji
                    const validEmoji = validateEmoji(option.emoji, interaction.guild);
                    if (validEmoji) {
                        selectOption.emoji = validEmoji;
                    }
                    
                    return selectOption;
                });

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('role_select')
                            .setPlaceholder('Choisissez un rôle...')
                            .setMinValues(0)
                            .setMaxValues(selectOptions.length)
                            .addOptions(selectOptions)
                    );

                // Mettre à jour le message
                try {
                    const channel = await interaction.client.channels.fetch(menu.channel_id);
                    const message = await channel.messages.fetch(messageId);
                    
                    await message.edit({ components: [newRow] });
                    
                    await interaction.reply({
                        content: `✅ Rôle ${role} ajouté au menu avec succès !`,
                        flags: 64 // Ephemeral flag
                    });
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du message:', error);
                    await interaction.reply({
                        content: '❌ Erreur lors de la mise à jour du menu. Le message existe-t-il encore ?',
                        flags: 64 // Ephemeral flag
                    });
                }

            } else if (subcommand === 'supprimer') {
                const messageId = interaction.options.getString('message_id');
                const role = interaction.options.getRole('role');

                // Vérifier si le menu existe
                const menu = await interaction.client.db.get('SELECT * FROM role_menus WHERE message_id = ?', [messageId]);
                if (!menu) {
                    return await interaction.reply({
                        content: '❌ Aucun menu de rôles trouvé avec cet ID.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Supprimer le rôle de la base de données
                const result = await interaction.client.db.run(
                    'DELETE FROM role_options WHERE menu_id = ? AND role_id = ?',
                    [messageId, role.id]
                );

                if (result.affectedRows === 0) {
                    return await interaction.reply({
                        content: '❌ Ce rôle n\'est pas dans ce menu.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Récupérer les rôles mis à jour
                const roleOptions = await interaction.client.db.all(
                    'SELECT * FROM role_options WHERE menu_id = ?',
                    [messageId]
                );

                if (roleOptions.length === 0) {
                    return await interaction.reply({
                        content: '⚠️ Le menu est maintenant vide. Ajoutez des rôles avec `/roles ajouter`.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Supprimer les doublons potentiels
                const uniqueRoleOptions = [];
                const seenRoles = new Set();
                
                for (const option of roleOptions) {
                    if (!seenRoles.has(option.role_id)) {
                        seenRoles.add(option.role_id);
                        uniqueRoleOptions.push(option);
                    }
                }

                // Reconstruire le menu
                const selectOptions = uniqueRoleOptions.map(option => {
                    const selectOption = {
                        label: option.label || `@${interaction.guild.roles.cache.get(option.role_id)?.name || 'Rôle inconnu'}`,
                        value: option.role_id,
                        description: option.description || undefined
                    };
                    
                    // Valider et ajouter l'emoji
                    const validEmoji = validateEmoji(option.emoji, interaction.guild);
                    if (validEmoji) {
                        selectOption.emoji = validEmoji;
                    }
                    
                    return selectOption;
                });

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('role_select')
                            .setPlaceholder('Choisissez un rôle...')
                            .setMinValues(0)
                            .setMaxValues(selectOptions.length)
                            .addOptions(selectOptions)
                    );

                // Mettre à jour le message
                try {
                    const channel = await interaction.client.channels.fetch(menu.channel_id);
                    const message = await channel.messages.fetch(messageId);
                    
                    await message.edit({ components: [newRow] });
                    
                    await interaction.reply({
                        content: `✅ Rôle ${role} supprimé du menu avec succès !`,
                        flags: 64 // Ephemeral flag
                    });
                } catch (error) {
                    console.error('Erreur lors de la mise à jour du message:', error);
                    await interaction.reply({
                        content: '❌ Erreur lors de la mise à jour du menu.',
                        flags: 64 // Ephemeral flag
                    });
                }
            }
        } catch (error) {
            console.error('Erreur dans la commande roles:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'exécution de la commande.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
