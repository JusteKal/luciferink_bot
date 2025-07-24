const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('classement')
        .setDescription('Affiche le classement des niveaux du serveur')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page du classement à afficher')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Vérifier si le système de niveaux est activé
            const guildConfig = await interaction.client.db.getGuildConfig(interaction.guildId);
            if (guildConfig && guildConfig.levels_enabled === 0) {
                return await interaction.reply({
                    content: '❌ Le système de niveaux est désactivé sur ce serveur.',
                    flags: 64 // Ephemeral flag
                });
            }

            const page = interaction.options.getInteger('page') || 1;
            const usersPerPage = 10;
            const offset = (page - 1) * usersPerPage;

            // Récupérer tous les utilisateurs triés par XP
            const allUsers = await interaction.client.db.all(
                'SELECT user_id, xp, level, messages FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ? OFFSET ?',
                [interaction.guildId, usersPerPage, offset]
            );

            const totalUsers = await interaction.client.db.get(
                'SELECT COUNT(*) as count FROM user_levels WHERE guild_id = ?',
                [interaction.guildId]
            );

            if (!allUsers || allUsers.length === 0) {
                return await interaction.reply({
                    content: '❌ Aucun utilisateur trouvé dans le classement.',
                    flags: 64 // Ephemeral flag
                });
            }

            const totalPages = Math.ceil(totalUsers.count / usersPerPage);

            if (page > totalPages) {
                return await interaction.reply({
                    content: `❌ Page invalide. Il y a seulement ${totalPages} page(s).`,
                    flags: 64 // Ephemeral flag
                });
            }

            let description = '';
            const medals = ['🥇', '🥈', '🥉'];

            for (let i = 0; i < allUsers.length; i++) {
                const userData = allUsers[i];
                const rank = offset + i + 1;
                
                try {
                    const user = await interaction.client.users.fetch(userData.user_id);
                    const medal = rank <= 3 ? medals[rank - 1] : `**#${rank}**`;
                    
                    description += `${medal} ${user.displayName}\n`;
                    description += `└ Niveau ${userData.level} • ${userData.xp.toLocaleString()} XP • ${userData.messages.toLocaleString()} messages\n\n`;
                } catch (error) {
                    // Utilisateur introuvable, ignorer
                    continue;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Classement des Niveaux - ${interaction.guild.name}`)
                .setDescription(description || 'Aucun utilisateur trouvé.')
                .setColor('#F39C12')
                .setFooter({ 
                    text: `Page ${page}/${totalPages} • ${totalUsers.count} utilisateurs au total`,
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur dans la commande classement:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'affichage du classement.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
