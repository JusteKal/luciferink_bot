const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre spécifique de messages')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Supprimer uniquement les messages de cet utilisateur')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('nombre');
        const targetUser = interaction.options.getUser('utilisateur');

        try {
            await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral flag

            // Récupérer les messages
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            
            let messagesToDelete = messages;
            
            // Filtrer par utilisateur si spécifié
            if (targetUser) {
                messagesToDelete = messages.filter(msg => msg.author.id === targetUser.id);
            }

            // Supprimer les messages (Discord limite à 14 jours)
            const deletedMessages = await interaction.channel.bulkDelete(messagesToDelete, true);

            // Log de modération
            await interaction.client.db.run(
                'INSERT INTO mod_logs (guild_id, moderator_id, target_id, action, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    interaction.guildId, 
                    interaction.user.id, 
                    targetUser?.id || null, 
                    'clear', 
                    `${deletedMessages.size} messages supprimés`, 
                    Date.now()
                ]
            );

            // Réponse
            const embed = new EmbedBuilder()
                .setTitle('🧹 Messages supprimés')
                .setDescription(`${deletedMessages.size} message(s) supprimé(s) avec succès.`)
                .addFields(
                    { name: 'Canal', value: interaction.channel.toString(), inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setColor('#3498DB')
                .setTimestamp();

            if (targetUser) {
                embed.addFields({ name: 'Utilisateur ciblé', value: targetUser.tag, inline: true });
            }

            await interaction.editReply({ embeds: [embed] });

            // Envoyer dans le channel de logs
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.logs_channel_id) {
                try {
                    const logsChannel = await interaction.client.channels.fetch(guildConfig.logs_channel_id);
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📋 Log de Modération - Clear')
                        .addFields(
                            { name: 'Messages supprimés', value: `${deletedMessages.size}`, inline: false },
                            { name: 'Modérateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Canal', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: false }
                        )
                        .setColor('#3498DB')
                        .setTimestamp();

                    if (targetUser) {
                        logEmbed.addFields({ name: 'Utilisateur ciblé', value: `${targetUser.tag} (${targetUser.id})`, inline: false });
                    }

                    await logsChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du log:', error);
                }
            }

        } catch (error) {
            console.error('Erreur lors de la suppression des messages:', error);
            await interaction.editReply({
                content: '❌ Erreur lors de la suppression des messages. Vérifiez mes permissions et que les messages ne sont pas trop anciens (14 jours max).'
            });
        }
    },
};
