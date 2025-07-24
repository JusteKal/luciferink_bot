const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildConfig = await member.client.db.getGuildConfig(member.guild.id);
            
            // Vérifier si le système de bienvenue est activé et configuré
            if (!guildConfig || !guildConfig.welcome_enabled || !guildConfig.welcome_channel_id) {
                return;
            }

            const welcomeChannel = await member.client.channels.fetch(guildConfig.welcome_channel_id).catch(() => null);
            
            if (!welcomeChannel) {
                return;
            }

            // Créer l'embed de bienvenue
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎉 Nouveau membre !')
                .setDescription(`Bienvenue sur **${member.guild.name}**, ${member} !`)
                .addFields(
                    {
                        name: '👤 Membre',
                        value: `${member.user.tag}`,
                        inline: true
                    },
                    {
                        name: '📅 Compte créé',
                        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: '📊 Membre n°',
                        value: `${member.guild.memberCount}`,
                        inline: true
                    }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setColor('#2ECC71')
                .setTimestamp()
                .setFooter({ 
                    text: `ID: ${member.user.id}`,
                    iconURL: member.guild.iconURL()
                });

            // Messages de bienvenue aléatoires
            const welcomeMessages = [
                `N'hésite pas à jeter un œil aux règles et à te présenter !`,
                `Nous espérons que tu te plairas ici !`,
                `Passe un excellent moment parmi nous !`,
                `Bienvenue dans notre communauté !`,
                `Nous sommes ravis de t'accueillir !`
            ];

            const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
            welcomeEmbed.addFields({
                name: '💭 Message',
                value: randomMessage,
                inline: false
            });

            await welcomeChannel.send({ 
                content: `👋 ${member}`, 
                embeds: [welcomeEmbed] 
            });

        } catch (error) {
            console.error('Erreur lors de l\'envoi du message de bienvenue:', error);
        }
    },
};
