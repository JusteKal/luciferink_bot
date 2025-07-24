// génère une commande help pour afficher les commandes disponibles
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles'),
    async execute(interaction) {
        const commands = interaction.client.commands;
        
        // Créer un embed pour afficher les commandes
        const embed = new EmbedBuilder()
            .setTitle('🆘 Liste des commandes')
            .setDescription('Voici les commandes disponibles :')
            .setColor('#5865F2')
            .setFooter({ text: 'Utilisez /<commande> pour exécuter une commande.' });

        // Ajouter chaque commande à l'embed
        commands.forEach(command => {
            embed.addFields({
                name: `/${command.data.name}`,
                value: command.data.description || 'Aucune description fournie',
                inline: true
            });
        });

        await interaction.reply({ embeds: [embed] });
    }
};