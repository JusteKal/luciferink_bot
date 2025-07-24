const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reglement')
        .setDescription('Génère un embed de règlement pour le serveur')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Le channel où envoyer le règlement')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Rôle à donner en acceptant le règlement')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const acceptRole = interaction.options.getRole('role');

        const rulesEmbed = new EmbedBuilder()
            .setTitle('📋 Règlement du Serveur')
            .setDescription('Merci de respecter ces règles pour maintenir une bonne ambiance sur le serveur !')
            .setColor('#FF6B6B')
            .addFields(
                {
                    name: '🔹 Règle 1 : Respect',
                    value: 'Respectez tous les membres du serveur. Aucun harcèlement, insulte ou comportement toxique ne sera toléré.',
                    inline: false
                },
                {
                    name: '🔹 Règle 2 : Contenu approprié',
                    value: 'Pas de contenu NSFW, violent ou inapproprié.',
                    inline: false
                },
                {
                    name: '🔹 Règle 3 : Spam et flood',
                    value: 'Évitez le spam, le flood et les messages répétitifs. Un message toutes les quelques secondes est suffisant.',
                    inline: false
                },
                {
                    name: '🔹 Règle 4 : Channels appropriés',
                    value: 'Utilisez les bons channels pour vos discussions. Respectez le sujet de chaque salon.',
                    inline: false
                },
                {
                    name: '🔹 Règle 5 : Pseudonymes',
                    value: 'Utilisez un pseudonyme approprié et évitez les caractères spéciaux excessifs.',
                    inline: false
                },
                {
                    name: '🔹 Règle 6 : Publicité',
                    value: 'La publicité non autorisée est interdite. Demandez la permission avant de partager des liens.',
                    inline: false
                },
                {
                    name: '🔹 Règle 7 : Modération',
                    value: 'Respectez les décisions des modérateurs. En cas de problème, contactez-les en privé.',
                    inline: false
                }
            )
            .addFields(
                {
                    name: '⚠️ Sanctions',
                    value: 'Le non-respect de ces règles peut entraîner :\n• Avertissement\n• Timeout temporaire\n• Exclusion du serveur\n• Bannissement définitif',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'En restant sur ce serveur, vous acceptez ces règles.', 
                iconURL: interaction.guild.iconURL() 
            })
            .setTimestamp();

        try {
            const components = [];
            
            if (acceptRole) {
                const acceptButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_rules_${acceptRole.id}`)
                            .setLabel('✅ J\'accepte le règlement')
                            .setStyle(ButtonStyle.Success)
                    );
                components.push(acceptButton);
            }

            await channel.send({ 
                embeds: [rulesEmbed], 
                components: components 
            });
            
            // Sauvegarder le channel de règlement dans la config
            const configUpdate = { rules_channel_id: channel.id };
            if (acceptRole) {
                configUpdate.rules_role_id = acceptRole.id;
            }
            
            await interaction.client.db.setGuildConfig(interaction.guildId, configUpdate);

            await interaction.reply({ 
                content: `✅ Règlement envoyé dans ${channel}!${acceptRole ? ` Les membres recevront le rôle ${acceptRole} en acceptant.` : ''}`, 
                flags: 64 // Ephemeral flag 
            });
        } catch (error) {
            console.error('Erreur lors de l\'envoi du règlement:', error);
            await interaction.reply({ 
                content: '❌ Erreur lors de l\'envoi du règlement.', 
                flags: 64 // Ephemeral flag 
            });
        }
    },
};
