const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorer les bots et les messages système
        if (message.author.bot || message.system) return;
        
        // Ignorer les messages en DM
        if (!message.guild) return;

        try {
            // Vérifier si le système de niveaux est activé
            const guildConfig = await message.client.db.getGuildConfig(message.guild.id);
            if (guildConfig && guildConfig.levels_enabled === 0) {
                return;
            }

            // Gain d'XP aléatoire entre 15 et 25
            const xpGain = Math.floor(Math.random() * 11) + 15;
            
            // Mettre à jour l'XP de l'utilisateur
            const result = await message.client.db.updateUserXP(message.author.id, message.guild.id, xpGain);
            
            // Si l'utilisateur a monté de niveau
            if (result.levelUp) {
                const levelUpEmbed = new EmbedBuilder()
                    .setTitle('🎉 Niveau supérieur !')
                    .setDescription(`Félicitations ${message.author} ! Tu es maintenant **niveau ${result.level}** !`)
                    .addFields(
                        {
                            name: '⭐ XP Total',
                            value: `${result.xp.toLocaleString()}`,
                            inline: true
                        },
                        {
                            name: '💬 Messages',
                            value: `${result.messages.toLocaleString()}`,
                            inline: true
                        }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setColor('#F1C40F')
                    .setTimestamp();

                // Envoyer le message de level up dans le même channel
                await message.channel.send({ embeds: [levelUpEmbed] });

                // Log dans le channel de logs si configuré
                if (guildConfig && guildConfig.logs_channel_id) {
                    try {
                        const logsChannel = await message.client.channels.fetch(guildConfig.logs_channel_id);
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📈 Montée de niveau')
                            .addFields(
                                { name: 'Utilisateur', value: `${message.author.tag} (${message.author.id})`, inline: false },
                                { name: 'Nouveau niveau', value: `${result.level}`, inline: true },
                                { name: 'XP Total', value: `${result.xp.toLocaleString()}`, inline: true },
                                { name: 'Channel', value: message.channel.toString(), inline: false }
                            )
                            .setColor('#F1C40F')
                            .setTimestamp();

                        await logsChannel.send({ embeds: [logEmbed] });
                    } catch (error) {
                        // Channel de logs introuvable ou erreur, on continue
                    }
                }
            }

        } catch (error) {
            console.error('Erreur lors de la gestion de l\'XP:', error);
        }
    },
};
