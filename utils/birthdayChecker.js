const { EmbedBuilder } = require('discord.js');
const moment = require('moment');

module.exports = async function checkBirthdays(client) {
    try {
        // Format de la date d'aujourd'hui (JJ/MM)
        const today = moment().format('DD/MM');
        
        // Récupérer toutes les configurations de serveur avec anniversaires activés
        const guildConfigs = await client.db.all(
            'SELECT * FROM guild_config WHERE birthday_enabled = 1 AND birthday_channel_id IS NOT NULL'
        );

        for (const config of guildConfigs) {
            try {
                // Récupérer les anniversaires d'aujourd'hui pour ce serveur
                const todayBirthdays = await client.db.getTodayBirthdays(config.guild_id, today);
                
                if (todayBirthdays.length === 0) continue;

                // Récupérer le channel d'anniversaire
                const birthdayChannel = await client.channels.fetch(config.birthday_channel_id).catch(() => null);
                
                if (!birthdayChannel) {
                    console.log(`Channel d'anniversaire introuvable pour le serveur ${config.guild_id}`);
                    continue;
                }

                // Envoyer un message pour chaque anniversaire
                for (const birthday of todayBirthdays) {
                    try {
                        const user = await client.users.fetch(birthday.user_id).catch(() => null);
                        
                        if (!user) continue;

                        const age = moment().year() - birthday.year;
                        
                        const birthdayEmbed = new EmbedBuilder()
                            .setTitle('🎂 Joyeux Anniversaire !')
                            .setDescription(`Aujourd'hui, nous célébrons l'anniversaire de ${user} !`)
                            .addFields(
                                {
                                    name: '🎈 Âge',
                                    value: `${age} ans`,
                                    inline: true
                                },
                                {
                                    name: '📅 Date',
                                    value: birthday.birthday,
                                    inline: true
                                }
                            )
                            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                            .setColor('#FF69B4')
                            .setTimestamp();

                        // Messages d'anniversaire aléatoires
                        const birthdayMessages = [
                            'Passe une merveilleuse journée ! 🎉',
                            'Que tous tes vœux se réalisent ! ✨',
                            'Profite bien de ton jour spécial ! 🎈',
                            'Une année de plus, une année de bonheur ! 🌟',
                            'Que cette nouvelle année t\'apporte plein de joie ! 🎊'
                        ];

                        const randomMessage = birthdayMessages[Math.floor(Math.random() * birthdayMessages.length)];
                        birthdayEmbed.addFields({
                            name: '💭 Message',
                            value: randomMessage,
                            inline: false
                        });

                        await birthdayChannel.send({
                            content: `🎉 ${user} 🎂`,
                            embeds: [birthdayEmbed]
                        });

                        console.log(`Message d'anniversaire envoyé pour ${user.tag} dans ${birthdayChannel.guild.name}`);

                    } catch (error) {
                        console.error(`Erreur lors de l'envoi de l'anniversaire pour l'utilisateur ${birthday.user_id}:`, error);
                    }
                }

            } catch (error) {
                console.error(`Erreur lors de la vérification des anniversaires pour le serveur ${config.guild_id}:`, error);
            }
        }

    } catch (error) {
        console.error('Erreur lors de la vérification globale des anniversaires:', error);
    }
};
