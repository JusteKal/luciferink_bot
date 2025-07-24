const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche les informations du serveur'),

    async execute(interaction) {
        try {
            const guild = interaction.guild;
            
            // Récupérer des statistiques
            const totalMembers = guild.memberCount;
            const botMembers = guild.members.cache.filter(member => member.user.bot).size;
            const humanMembers = totalMembers - botMembers;
            
            const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size;
            const categories = guild.channels.cache.filter(channel => channel.type === 4).size;
            
            const roles = guild.roles.cache.size - 1; // -1 pour @everyone
            
            // Niveau de boost
            const boostLevel = guild.premiumTier;
            const boostCount = guild.premiumSubscriptionCount || 0;
            
            // Propriétaire
            const owner = await guild.fetchOwner();
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 Informations du serveur`)
                .setDescription(`**${guild.name}**`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .setColor('#5865F2')
                .addFields(
                    {
                        name: '🆔 ID du serveur',
                        value: guild.id,
                        inline: true
                    },
                    {
                        name: '👑 Propriétaire',
                        value: owner.user.tag,
                        inline: true
                    },
                    {
                        name: '📅 Créé le',
                        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: '👥 Membres',
                        value: `**Total:** ${totalMembers}\n**Humains:** ${humanMembers}\n**Bots:** ${botMembers}`,
                        inline: true
                    },
                    {
                        name: '📺 Salons',
                        value: `**Texte:** ${textChannels}\n**Vocal:** ${voiceChannels}\n**Catégories:** ${categories}`,
                        inline: true
                    },
                    {
                        name: '🎭 Rôles',
                        value: `${roles}`,
                        inline: true
                    },
                    {
                        name: '💎 Niveau de boost',
                        value: `Niveau ${boostLevel}\n${boostCount} boost(s)`,
                        inline: true
                    }
                );

            // Niveau de vérification
            const verificationLevels = {
                0: 'Aucune',
                1: 'Faible',
                2: 'Moyen',
                3: 'Élevé',
                4: 'Très élevé'
            };
            
            embed.addFields({
                name: '🔒 Niveau de vérification',
                value: verificationLevels[guild.verificationLevel] || 'Inconnu',
                inline: true
            });

            // Emojis
            const emojis = guild.emojis.cache.size;
            if (emojis > 0) {
                embed.addFields({
                    name: '😀 Emojis',
                    value: `${emojis}`,
                    inline: true
                });
            }

            // Configuration du bot
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig) {
                let configStatus = [];
                if (guildConfig.welcome_enabled) configStatus.push('Bienvenue ✅');
                if (guildConfig.birthday_enabled) configStatus.push('Anniversaires ✅');
                if (guildConfig.levels_enabled) configStatus.push('Niveaux ✅');
                if (guildConfig.logs_channel_id) configStatus.push('Logs ✅');
                if (guildConfig.ticket_category_id) configStatus.push('Tickets ✅');

                if (configStatus.length > 0) {
                    embed.addFields({
                        name: '⚙️ Fonctionnalités du bot',
                        value: configStatus.join('\n'),
                        inline: false
                    });
                }
            }

            // Statistiques du système de niveaux
            const levelStats = await interaction.client.db.get(
                'SELECT COUNT(*) as total_users, MAX(level) as max_level, SUM(messages) as total_messages FROM user_levels WHERE guild_id = ?',
                [interaction.guildId]
            );

            if (levelStats && levelStats.total_users > 0) {
                embed.addFields({
                    name: '📈 Statistiques des niveaux',
                    value: `**Utilisateurs actifs:** ${levelStats.total_users}\n**Niveau max:** ${levelStats.max_level || 0}\n**Messages totaux:** ${(levelStats.total_messages || 0).toLocaleString()}`,
                    inline: false
                });
            }

            // Anniversaires du jour
            const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            const todayBirthdays = await interaction.client.db.getTodayBirthdays(interaction.guildId, today);
            if (todayBirthdays.length > 0) {
                embed.addFields({
                    name: '🎂 Anniversaires aujourd\'hui',
                    value: `${todayBirthdays.length} membre(s)`,
                    inline: true
                });
            }

            if (guild.bannerURL()) {
                embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
            }

            embed.setTimestamp()
                .setFooter({ 
                    text: `Serveur depuis ${Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24))} jours`,
                    iconURL: guild.iconURL()
                });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur dans la commande serverinfo:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la récupération des informations du serveur.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
