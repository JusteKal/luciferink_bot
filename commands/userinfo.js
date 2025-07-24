const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Affiche les informations d\'un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur dont voir les informations')
                .setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getUser('utilisateur') || interaction.user;
        
        try {
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            
            const embed = new EmbedBuilder()
                .setTitle(`👤 Informations de ${target.tag}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
                .setColor('#9B59B6')
                .addFields(
                    {
                        name: '🆔 ID',
                        value: target.id,
                        inline: true
                    },
                    {
                        name: '📅 Compte créé',
                        value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: '🤖 Bot',
                        value: target.bot ? 'Oui' : 'Non',
                        inline: true
                    }
                );

            if (member) {
                embed.addFields(
                    {
                        name: '📥 Rejoint le serveur',
                        value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: '🏷️ Surnom',
                        value: member.nickname || 'Aucun',
                        inline: true
                    },
                    {
                        name: '🔇 En timeout',
                        value: member.isCommunicationDisabled() ? `Jusqu'à <t:${Math.floor(member.communicationDisabledUntil / 1000)}:F>` : 'Non',
                        inline: true
                    }
                );

                // Rôles (limité aux 10 premiers pour éviter de dépasser la limite)
                const roles = member.roles.cache
                    .filter(role => role.id !== interaction.guild.id)
                    .sort((a, b) => b.position - a.position)
                    .first(10);

                if (roles.length > 0) {
                    embed.addFields({
                        name: `🎭 Rôles (${member.roles.cache.size - 1})`,
                        value: roles.map(role => role.toString()).join(' ') + (member.roles.cache.size > 11 ? ' ...' : ''),
                        inline: false
                    });
                }

                // Permissions importantes
                const importantPerms = [];
                if (member.permissions.has('Administrator')) importantPerms.push('Administrateur');
                if (member.permissions.has('ManageGuild')) importantPerms.push('Gérer le serveur');
                if (member.permissions.has('ManageChannels')) importantPerms.push('Gérer les salons');
                if (member.permissions.has('ManageRoles')) importantPerms.push('Gérer les rôles');
                if (member.permissions.has('KickMembers')) importantPerms.push('Expulser des membres');
                if (member.permissions.has('BanMembers')) importantPerms.push('Bannir des membres');
                if (member.permissions.has('ManageMessages')) importantPerms.push('Gérer les messages');

                if (importantPerms.length > 0) {
                    embed.addFields({
                        name: '🔑 Permissions importantes',
                        value: importantPerms.join(', '),
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '❌ Statut sur le serveur',
                    value: 'N\'est pas membre de ce serveur',
                    inline: false
                });
            }

            // Informations de niveau si disponibles
            const userLevel = await interaction.client.db.getUserLevel(target.id, interaction.guildId);
            if (userLevel) {
                embed.addFields(
                    {
                        name: '📊 Niveau',
                        value: `${userLevel.level}`,
                        inline: true
                    },
                    {
                        name: '⭐ XP',
                        value: `${userLevel.xp.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '💬 Messages',
                        value: `${userLevel.messages.toLocaleString()}`,
                        inline: true
                    }
                );
            }

            // Anniversaire si défini
            const birthday = await interaction.client.db.getBirthday(target.id, interaction.guildId);
            if (birthday) {
                const age = new Date().getFullYear() - birthday.year;
                embed.addFields({
                    name: '🎂 Anniversaire',
                    value: `${birthday.birthday}/${birthday.year} (${age} ans)`,
                    inline: true
                });
            }

            embed.setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur dans la commande userinfo:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la récupération des informations.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
