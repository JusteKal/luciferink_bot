const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un utilisateur du serveur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur à expulser')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('Raison de l\'expulsion')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur');
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
                    content: '❌ Vous ne pouvez pas vous expulser vous-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (target.id === interaction.client.user.id) {
                return await interaction.reply({
                    content: '❌ Je ne peux pas m\'expulser moi-même.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas expulser quelqu\'un ayant un rôle supérieur ou égal au vôtre.',
                    flags: 64 // Ephemeral flag
                });
            }

            if (!targetMember.kickable) {
                return await interaction.reply({
                    content: '❌ Je ne peux pas expulser cet utilisateur. Vérifiez les permissions.',
                    flags: 64 // Ephemeral flag
                });
            }

            // Envoyer un message privé à l'utilisateur avant le kick
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('👢 Vous avez été expulsé')
                    .setDescription(`Vous avez été expulsé du serveur **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Raison', value: reason, inline: false },
                        { name: 'Modérateur', value: interaction.user.tag, inline: false }
                    )
                    .setColor('#F39C12')
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                // L'utilisateur a probablement ses DMs fermés
            }

            // Expulser l'utilisateur
            await targetMember.kick(`${reason} | Modérateur: ${interaction.user.tag}`);

            // Log de modération
            await interaction.client.db.run(
                'INSERT INTO mod_logs (guild_id, moderator_id, target_id, action, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
                [interaction.guildId, interaction.user.id, target.id, 'kick', reason, Date.now()]
            );

            // Réponse de confirmation
            const embed = new EmbedBuilder()
                .setTitle('👢 Utilisateur expulsé')
                .setDescription(`**${target.tag}** a été expulsé du serveur.`)
                .addFields(
                    { name: 'Raison', value: reason, inline: false },
                    { name: 'Modérateur', value: interaction.user.tag, inline: false }
                )
                .setColor('#F39C12')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Envoyer dans le channel de logs
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.logs_channel_id) {
                try {
                    const logsChannel = await interaction.client.channels.fetch(guildConfig.logs_channel_id);
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📋 Log de Modération - Kick')
                        .addFields(
                            { name: 'Utilisateur', value: `${target.tag} (${target.id})`, inline: false },
                            { name: 'Modérateur', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Raison', value: reason, inline: false },
                            { name: 'Channel', value: interaction.channel.toString(), inline: false }
                        )
                        .setColor('#F39C12')
                        .setTimestamp();

                    await logsChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    console.error('Erreur lors de l\'envoi du log:', error);
                }
            }

        } catch (error) {
            console.error('Erreur lors de l\'expulsion:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'expulsion de l\'utilisateur.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
