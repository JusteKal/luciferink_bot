const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class InstagramScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    }

    async init() {
        if (this.browser) return;

        try {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=site-per-process'
                ],
                executablePath: process.env.CHROME_PATH || undefined
            });

            this.page = await this.browser.newPage();
            
            // Configuration anti-détection
            await this.page.setUserAgent(this.userAgent);
            await this.page.setViewport({ width: 1366, height: 768 });
            
            // Supprimer les signatures de webdriver
            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

        } catch (error) {
            console.error('Erreur initialisation browser:', error);
            throw error;
        }
    }

    async testScrape(username) {
        try {
            await this.init();
            
            const url = `https://www.instagram.com/${username}/`;
            console.log(`Test scraping: ${url}`);

            await this.page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });

            // Attendre que la page charge
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Vérifier si le compte existe
            const pageContent = await this.page.content();
            
            if (pageContent.includes('Sorry, this page isn\'t available') || 
                pageContent.includes('Cette page n\'est pas disponible')) {
                return {
                    success: false,
                    error: 'Compte Instagram introuvable'
                };
            }

            // Extraire les informations de base
            const accountInfo = await this.page.evaluate(() => {
                try {
                    // Chercher les métadonnées JSON
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    let jsonData = null;
                    
                    for (let script of scripts) {
                        try {
                            const data = JSON.parse(script.textContent);
                            if (data['@type'] === 'Person' || data.mainEntityOfPage) {
                                jsonData = data;
                                break;
                            }
                        } catch (e) {}
                    }

                    // Fallback: chercher dans les meta tags
                    const postsElement = document.querySelector('[href$="/"] span, article');
                    const isPrivate = document.body.textContent.includes('This account is private') ||
                                     document.body.textContent.includes('Ce compte est privé');
                    
                    return {
                        postsCount: 0, // Difficile à extraire sans être connecté
                        isVerified: document.body.textContent.includes('Verified') || 
                                   document.body.textContent.includes('vérifié'),
                        isPrivate: isPrivate,
                        exists: true
                    };
                } catch (error) {
                    return {
                        postsCount: 0,
                        isVerified: false,
                        isPrivate: false,
                        exists: false
                    };
                }
            });

            return {
                success: true,
                ...accountInfo
            };

        } catch (error) {
            console.error('Erreur test scraping:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async scrapeLatestPosts(username, limit = 5) {
        try {
            await this.init();
            
            const url = `https://www.instagram.com/${username}/`;
            console.log(`Scraping posts de: ${url}`);

            await this.page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });

            // Attendre le chargement
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Extraire les posts
            const posts = await this.page.evaluate((limit) => {
                try {
                    const posts = [];
                    
                    // Chercher les articles/posts
                    const articles = document.querySelectorAll('article a[href*="/p/"]');
                    
                    for (let i = 0; i < Math.min(articles.length, limit); i++) {
                        const article = articles[i];
                        const href = article.getAttribute('href');
                        const img = article.querySelector('img');
                        
                        if (href && img) {
                            posts.push({
                                postUrl: `https://www.instagram.com${href}`,
                                imageUrl: img.src,
                                caption: img.alt || '',
                                timestamp: Date.now() // Instagram ne donne pas facilement la date
                            });
                        }
                    }
                    
                    return posts;
                } catch (error) {
                    console.error('Erreur extraction posts:', error);
                    return [];
                }
            }, limit);

            return {
                success: true,
                posts: posts
            };

        } catch (error) {
            console.error('Erreur scraping posts:', error);
            return {
                success: false,
                error: error.message,
                posts: []
            };
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
        } catch (error) {
            console.error('Erreur fermeture browser:', error);
        }
    }

    // Méthode pour éviter la détection
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = InstagramScraper;
