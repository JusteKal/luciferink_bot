const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Met un utilisateur en timeout')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur à mettre en timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duree')
                .setDescription('Durée en minutes (max 40320 = 28 jours)')
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison du timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur');
        const duration = interaction.options.getInteger('duree');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

        try {
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
            
            if (!targetMember) {
                return await interaction.reply({
                    content: '❌ Cet utilisateur n\'est pas sur le serveur.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (target.id === interaction.user.id) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas vous mettre en timeout vous-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (target.id === interaction.client.user.id) {
                return await interaction.reply({
                    content: '❌ Je ne peux pas me mettre en timeout moi-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas timeout quelqu\'un ayant un rôle supérieur ou égal au vôtre.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (!targetMember.moderatable) {
                return await interaction.reply({
                    content: '❌ Je ne peux pas timeout cet utilisateur. Vérifiez les permissions.',
                    flags: 64 // Ephemeral flag
                });
            }

            // Convertir la durée en millisecondes
            const timeoutDuration = duration * 60 * 1000;
            const timeoutUntil = new Date(Date.now() + timeoutDuration);

            // Mettre en timeout
            await targetMember.timeout(timeoutDuration, `${reason} | Modérateur: ${interaction.user.tag}`);

            // Log de modération
            await interaction.client.db.run(
                'INSERT INTO mod_logs (guild_id, moderator_id, target_id, action, reason, timestamp, duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [interaction.guildId, interaction.user.id, target.id, 'timeout', reason, Date.now(), duration]
            );

            // Formatage de la durée
            let durationText = '';
            if (duration >= 1440) { // Plus d'un jour
                const days = Math.floor(duration / 1440);
                const hours = Math.floor((duration % 1440) / 60);
                durationText = `${days} jour(s)`;
                if (hours > 0) durationText += ` et ${hours} heure(s)`;
            } else if (duration >= 60) { // Plus d'une heure
                const hours = Math.floor(duration / 60);
                const mins = duration % 60;
                durationText = `${hours} heure(s)`;
                if (mins > 0) durationText += ` et ${mins} minute(s)`;
            } else {
                durationText = `${duration} minute(s)`;
            }

            // Réponse de confirmation
            const embed = new EmbedBuilder()
                .setTitle('⏰ Utilisateur mis en timeout')
                .setDescription(`**${target.tag}** a été mis en timeout.`)
                .addFields(
                    { name: 'Durée', value: durationText, inline: false },
                    { name: 'Fin du timeout', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: false },
                    { name: 'Raison', value: reason, inline: false },
                    { name: 'Modérateur', value: interaction.user.tag, inline: false }
                )
                .setColor('#FF9F43')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Envoyer dans le channel de logs
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.logs_channel_id) {
                try {
                    const logsChannel = await interaction.client.channels.fetch(guildConfig.logs_channel_id);
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📋 Log de Modération - Timeout')
                        .addFields(
                            { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: false },
                            { name: 'Modérateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Durée', value: durationText, inline: false },
                            { name: 'Raison', value: reason, inline: false },
                            { name: 'Channel', value: interaction.channel.toString(), inline: false }
                        )
                        .setColor('#FF9F43')
                        .setTimestamp();

                    await logsChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du log:', error);
                }
            }

        } catch (error) {
            console.error('Erreur lors du timeout:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la mise en timeout de l\'utilisateur.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
