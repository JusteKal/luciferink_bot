const { SlashCommandBuilder } = require('discord.js');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anniversaire')
        .setDescription('Gère ton anniversaire')
        .addSubcommand(subcommand =>
            subcommand
                .setName('definir')
                .setDescription('Définit ta date d\'anniversaire')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('Ta date d\'anniversaire (format: JJ/MM/AAAA)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('voir')
                .setDescription('Voir ton anniversaire ou celui d\'un autre utilisateur')
                .addUserOption(option =>
                    option.setName('utilisateur')
                        .setDescription('Utilisateur dont voir l\'anniversaire')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('supprimer')
                .setDescription('Supprime ton anniversaire')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'definir') {
                const dateInput = interaction.options.getString('date');
                
                // Valider le format de date
                const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
                const match = dateInput.match(dateRegex);
                
                if (!match) {
                    return await interaction.reply({
                        content: '❌ Format de date invalide. Utilisez le format JJ/MM/AAAA (ex: 15/03/1995)',
                        flags: 64 // Ephemeral flag
                    });
                }

                const day = parseInt(match[1]);
                const month = parseInt(match[2]);
                const year = parseInt(match[3]);

                // Valider la date
                const date = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`, 'YYYY-MM-DD');
                
                if (!date.isValid() || day > 31 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
                    return await interaction.reply({
                        content: '❌ Date invalide. Vérifiez le jour, le mois et l\'année.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Vérifier que la personne a au moins 13 ans (règles Discord)
                const age = moment().diff(date, 'years');
                if (age < 13) {
                    return await interaction.reply({
                        content: '❌ Vous devez avoir au moins 13 ans pour utiliser Discord.',
                        flags: 64 // Ephemeral flag
                    });
                }

                // Sauvegarder dans la base de données
                const birthdayString = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
                
                await interaction.client.db.setBirthday(
                    interaction.user.id,
                    interaction.guildId,
                    birthdayString,
                    year
                );

                await interaction.reply({
                    content: `🎂 Anniversaire défini pour le ${birthdayString} ! Tu auras ${moment().year() - year + (moment().month() + 1 < month || (moment().month() + 1 === month && moment().date() < day) ? 0 : 1)} ans cette année.`,
                    flags: 64 // Ephemeral flag
                });

            } else if (subcommand === 'voir') {
                const user = interaction.options.getUser('utilisateur') || interaction.user;
                
                const birthday = await interaction.client.db.getBirthday(user.id, interaction.guildId);
                
                if (!birthday) {
                    const message = user.id === interaction.user.id 
                        ? '❌ Tu n\'as pas encore défini ton anniversaire. Utilise `/anniversaire definir` pour le faire.'
                        : `❌ ${user.displayName} n'a pas défini d'anniversaire.`;
                    
                    return await interaction.reply({
                        content: message,
                        flags: 64 // Ephemeral flag
                    });
                }

                const age = moment().year() - birthday.year;
                const nextBirthday = moment(`${moment().year()}-${birthday.birthday.split('/')[1]}-${birthday.birthday.split('/')[0]}`, 'YYYY-MM-DD');
                
                if (nextBirthday.isBefore(moment(), 'day')) {
                    nextBirthday.add(1, 'year');
                }

                const daysUntil = nextBirthday.diff(moment(), 'days');

                let message = `🎂 **Anniversaire de ${user.displayName}**\n`;
                message += `📅 Date: ${birthday.birthday}/${birthday.year}\n`;
                message += `🎈 Âge actuel: ${age} ans\n`;
                
                if (daysUntil === 0) {
                    message += `🎉 **C'est aujourd'hui !** Joyeux anniversaire !`;
                } else if (daysUntil === 1) {
                    message += `⏰ C'est demain ! Plus qu'un jour !`;
                } else {
                    message += `⏰ Dans ${daysUntil} jours`;
                }

                await interaction.reply({
                    content: message,
                    flags: user.id !== interaction.user.id ? 64 : 0 // Ephemeral si c'est pour quelqu'un d'autre
                });

            } else if (subcommand === 'supprimer') {
                const birthday = await interaction.client.db.getBirthday(interaction.user.id, interaction.guildId);
                
                if (!birthday) {
                    return await interaction.reply({
                        content: '❌ Tu n\'as pas d\'anniversaire défini.',
                        flags: 64 // Ephemeral flag
                    });
                }

                await interaction.client.db.run(
                    'DELETE FROM birthdays WHERE user_id = ? AND guild_id = ?',
                    [interaction.user.id, interaction.guildId]
                );

                await interaction.reply({
                    content: '✅ Ton anniversaire a été supprimé.',
                    flags: 64 // Ephemeral flag
                });
            }
        } catch (error) {
            console.error('Erreur dans la commande anniversaire:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'exécution de la commande.',
                flags: 64 // Ephemeral flag
            });
        }
    },
};
