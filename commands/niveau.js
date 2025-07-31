const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('niveau')
        .setDescription('Affiche le niveau d\'un utilisateur')
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Utilisateur dont voir le niveau')
                .setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('utilisateur') || interaction.user;
        
        try {
            // Vérifier si le système de niveaux est activé
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.levels_enabled === 0) {
                return await interaction.reply({
                    content: '❌ Le système de niveaux est désactivé sur ce serveur.',
                    flags: 64 // Ephemeral flag
                });
            }

            const userLevel = await interaction.client.db.getUserLevel(user.id, interaction.guildId);
            
            if (!userLevel) {
                const message = user.id === interaction.user.id 
                    ? '❌ Tu n\'as pas encore de niveau. Envoie des messages pour commencer à gagner de l\'XP !'
                    : `❌ ${user.displayName} n'a pas encore de niveau.`;
                
                return await interaction.reply({
                    content: message,
                    flags: 64 // Ephemeral flag
                });
            }

            // Calculer l'XP nécessaire pour le prochain niveau
            const currentLevelXP = interaction.client.db.getXPForLevel(userLevel.level);
            const nextLevelXP = interaction.client.db.getXPForLevel(userLevel.level + 1);
            const progressXP = userLevel.xp - currentLevelXP;
            const neededXP = nextLevelXP - currentLevelXP;

            // Créer une barre de progression
            const progressPercentage = Math.round((progressXP / neededXP) * 100);
            const progressBar = '█'.repeat(Math.floor(progressPercentage / 5)) + '░'.repeat(20 - Math.floor(progressPercentage / 5));

            // Obtenir le classement de l'utilisateur
            const allUsers = await interaction.client.db.all(
                'SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY xp DESC',
                [interaction.guildId]
            );
            const rank = allUsers.findIndex(u => u.user_id === user.id) + 1;

            const embed = new EmbedBuilder()
                .setTitle(`📊 Niveau de ${user.displayName}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('#9B59B6')
                .addFields(
                    {
                        name: '🏆 Niveau',
                        value: `${userLevel.level}`,
                        inline: true
                    },
                    {
                        name: '⭐ XP Total',
                        value: `${userLevel.xp.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '📈 Classement',
                        value: `#${rank}/${allUsers.length}`,
                        inline: true
                    },
                    {
                        name: '💬 Messages',
                        value: `${userLevel.messages.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '📊 Progression',
                        value: `${progressXP}/${neededXP} XP (${progressPercentage}%)`,
                        inline: true
                    },
                    {
                        name: '🎯 Prochain Niveau',
                        value: userLevel.level >= 100 ? 'Niveau maximum atteint !' : `${nextLevelXP - userLevel.xp} XP restants`,
                        inline: true
                    },
                    {
                        name: '📈 Barre de Progression',
                        value: `\`${progressBar}\` ${progressPercentage}%`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.reply({ 
                embeds: [embed], 
                flags: user.id === interaction.user.id ? 64 : 0 // Ephemeral si c'est pour soi-même
            });

        } catch (error) {
            console.error('Erreur dans la commande niveau:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'affichage du niveau.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
