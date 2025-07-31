const { EmbedBuilder } = require('discord.js');
const InstagramScraper = require('./instagramScraper');

class InstagramMonitor {
    constructor(client) {
        this.client = client;
        this.scraper = new InstagramScraper();
        this.isRunning = false;
        this.interval = null;
        this.checkInterval = 10 * 60 * 1000; // 10 minutes
    }

    async start() {
        if (this.isRunning) {
            console.log('Instagram monitor déjà en cours...');
            return;
        }

        console.log('Démarrage du moniteur Instagram...');
        this.isRunning = true;
        
        // Vérification immédiate puis toutes les 10 minutes
        await this.checkAllConfigs();
        
        this.interval = setInterval(async () => {
            await this.checkAllConfigs();
        }, this.checkInterval);
    }

    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        await this.scraper.close();
        this.isRunning = false;
        console.log('Moniteur Instagram arrêté.');
    }

    async checkAllConfigs() {
        try {
            const configs = await this.client.db.getAllInstagramConfigs();
            
            if (configs.length === 0) {
                return;
            }

            console.log(`Vérification de ${configs.length} configurations Instagram...`);

            for (const config of configs) {
                try {
                    await this.checkAccountForNewPosts(config);
                    
                    // Délai entre chaque compte pour éviter la détection
                    await this.delay(5000 + Math.random() * 5000);
                } catch (error) {
                    console.error(`Erreur vérification @${config.username}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification Instagram:', error);
        }
    }

    async checkAccountForNewPosts(config) {
        try {
            const { guild_id, username, channel_id } = config;
            
            // Vérifier que le serveur et le channel existent toujours
            const guild = this.client.guilds.cache.get(guild_id);
            if (!guild) {
                console.log(`Serveur ${guild_id} non trouvé, configuration ignorée.`);
                return;
            }

            const channel = guild.channels.cache.get(channel_id);
            if (!channel) {
                console.log(`Channel ${channel_id} non trouvé pour @${username}.`);
                return;
            }

            console.log(`Vérification des nouveaux posts de @${username}...`);

            // Scraper les derniers posts
            const result = await this.scraper.scrapeLatestPosts(username, 3);
            
            if (!result.success || result.posts.length === 0) {
                console.log(`Aucun post trouvé pour @${username} ou erreur: ${result.error || 'Inconnu'}`);
                return;
            }

            // Vérifier les nouveaux posts
            for (const post of result.posts) {
                const postId = this.extractPostId(post.postUrl);
                
                if (!postId) continue;

                // Vérifier si le post a déjà été publié
                const alreadyPosted = await this.client.db.isPostAlreadyPosted(guild_id, postId);
                
                if (!alreadyPosted) {
                    await this.postToDiscord(channel, username, post);
                    
                    // Sauvegarder le post comme publié
                    await this.client.db.saveInstagramPost(
                        guild_id, 
                        postId, 
                        post.postUrl, 
                        post.imageUrl, 
                        post.caption
                    );
                    
                    console.log(`Nouveau post de @${username} publié dans ${channel.name}`);
                    
                    // Délai entre les posts
                    await this.delay(2000);
                }
            }

        } catch (error) {
            console.error(`Erreur monitoring @${config.username}:`, error);
        }
    }

    async postToDiscord(channel, username, post) {
        try {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `@${username}`,
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/64px-Instagram_icon.png',
                    url: `https://instagram.com/${username}`
                })
                .setImage(post.imageUrl)
                .setColor(0xE4405F)
                .setTimestamp()
                .setFooter({ text: 'Instagram' });

            // Bouton pour voir le post
            const row = {
                type: 1,
                components: [{
                    type: 2,
                    style: 5,
                    label: 'Voir sur Instagram',
                    url: post.postUrl,
                    emoji: { name: '📱' }
                }]
            };

            await channel.send({
                content: `🔥||<@&1397996150023393381>|| **Nouveau post de @${username}** !`,
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error('Erreur envoi vers Discord:', error);
        }
    }

    extractPostId(postUrl) {
        try {
            const match = postUrl.match(/\/p\/([^\/]+)/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Méthode pour ajouter manuellement un post (test)
    async forceCheckAccount(username, guildId) {
        try {
            const config = await this.client.db.getInstagramConfig(guildId);
            if (!config || config.username !== username) {
                throw new Error('Configuration non trouvée');
            }

            await this.checkAccountForNewPosts(config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = InstagramMonitor;
