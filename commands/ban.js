const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un utilisateur du serveur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur à bannir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison du bannissement')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('supprimer_messages')
                .setDescription('Nombre de jours de messages à supprimer (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        const deleteMessageDays = interaction.options.getInteger('supprimer_messages') || 0;

        try {
            // Vérifications de sécurité
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
            
            if (target.id === interaction.user.id) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas vous bannir vous-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (target.id === interaction.client.user.id) {
                return await interaction.reply({
                    content: '❌ Je ne peux pas me bannir moi-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (targetMember) {
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    return await interaction.reply({
                        content: '❌ Vous ne pouvez pas bannir quelqu\'un ayant un rôle supérieur ou égal au vôtre.',
                        flags: 64 // Ephemeral flag
                    });
                }

                if (!targetMember.bannable) {
                    return await interaction.reply({
                        content: '❌ Je ne peux pas bannir cet utilisateur. Vérifiez les permissions.',
                        flags: 64 // Ephemeral flag
                    });
                }
            }

            // Envoyer un message privé à l'utilisateur avant le ban
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔨 Vous avez été banni')
                    .setDescription(`Vous avez été banni du serveur **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Raison', value: reason, inline: false },
                        { name: 'Modérateur', value: interaction.user.tag, inline: false }
                    )
                    .setColor('#E74C3C')
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                // L'utilisateur a probablement ses DMs fermés
            }

            // Bannir l'utilisateur
            await interaction.guild.members.ban(target, {
                reason: `${reason} | Modérateur: ${interaction.user.tag}`,
                deleteMessageDays: deleteMessageDays
            });

            // Log de modération
            await interaction.client.db.run(
                'INSERT INTO mod_logs (guild_id, moderator_id, target_id, action, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                [interaction.guildId, interaction.user.id, target.id, 'ban', reason, Date.now()]
            );

            // Réponse de confirmation
            const embed = new EmbedBuilder()
                .setTitle('🔨 Utilisateur banni')
                .setDescription(`**${target.tag}** a été banni du serveur.`)
                .addFields(
                    { name: 'Raison', value: reason, inline: false },
                    { name: 'Modérateur', value: interaction.user.tag, inline: false }
                )
                .setColor('#E74C3C')
                .setTimestamp();

            if (deleteMessageDays > 0) {
                embed.addFields({ name: 'Messages supprimés', value: `${deleteMessageDays} jour(s)`, inline: false });
            }

            await interaction.reply({ embeds: [embed] });

            // Envoyer dans le channel de logs
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.logs_channel_id) {
                try {
                    const logsChannel = await interaction.client.channels.fetch(guildConfig.logs_channel_id);
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📋 Log de Modération - Ban')
                        .addFields(
                            { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: false },
                            { name: 'Modérateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Raison', value: reason, inline: false },
                            { name: 'Channel', value: interaction.channel.toString(), inline: false }
                        )
                        .setColor('#E74C3C')
                        .setTimestamp();

                    await logsChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du log:', error);
                }
            }

        } catch (error) {
            console.error('Erreur lors du bannissement:', error);
            await interaction.reply({
                content: '❌ Erreur lors du bannissement de l\'utilisateur.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
