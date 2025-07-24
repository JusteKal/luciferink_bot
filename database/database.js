const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.connection = null;
    }

    async init() {
        try {
            this.connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME || 'luciferink_bot',
                charset: 'utf8mb4'
            });

            console.log('Connecté à la base de données MariaDB.');
            await this.createTables();
        } catch (error) {
            console.error('Erreur lors de la connexion à MariaDB:', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Configuration du serveur
            `CREATE TABLE IF NOT EXISTS guild_config (
                guild_id VARCHAR(20) PRIMARY KEY,
                welcome_channel_id VARCHAR(20),
                birthday_channel_id VARCHAR(20),
                logs_channel_id VARCHAR(20),
                rules_channel_id VARCHAR(20),
                rules_role_id VARCHAR(20),
                ticket_category_id VARCHAR(20),
                welcome_enabled TINYINT DEFAULT 1,
                birthday_enabled TINYINT DEFAULT 1,
                levels_enabled TINYINT DEFAULT 1
            )`,
            
            // Niveaux des utilisateurs
            `CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                xp BIGINT DEFAULT 0,
                level INT DEFAULT 0,
                messages BIGINT DEFAULT 0,
                last_message_time BIGINT DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )`,
            
            // Anniversaires
            `CREATE TABLE IF NOT EXISTS birthdays (
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                birthday VARCHAR(5),
                year INT,
                PRIMARY KEY (user_id, guild_id)
            )`,
            
            // Tickets
            `CREATE TABLE IF NOT EXISTS tickets (
                channel_id VARCHAR(20) PRIMARY KEY,
                user_id VARCHAR(20),
                guild_id VARCHAR(20),
                ticket_number INT,
                status VARCHAR(10) DEFAULT 'open',
                created_at BIGINT,
                closed_at BIGINT DEFAULT NULL
            )`,
            
            // Rôles configurables
            `CREATE TABLE IF NOT EXISTS role_menus (
                message_id VARCHAR(20) PRIMARY KEY,
                channel_id VARCHAR(20),
                guild_id VARCHAR(20),
                title VARCHAR(255),
                description TEXT
            )`,
            
            // Options de rôles pour les menus
            `CREATE TABLE IF NOT EXISTS role_options (
                id INT AUTO_INCREMENT PRIMARY KEY,
                menu_id VARCHAR(20),
                role_id VARCHAR(20),
                emoji VARCHAR(100),
                label VARCHAR(100),
                description VARCHAR(255),
                FOREIGN KEY (menu_id) REFERENCES role_menus (message_id) ON DELETE CASCADE
            )`,
            
            // Logs de modération
            `CREATE TABLE IF NOT EXISTS mod_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(20),
                moderator_id VARCHAR(20),
                target_id VARCHAR(20),
                action VARCHAR(20),
                reason TEXT,
                timestamp BIGINT,
                duration INT DEFAULT NULL
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }
    }

    async run(sql, params = []) {
        try {
            const [result] = await this.connection.execute(sql, params);
            return {
                insertId: result.insertId || 0,
                affectedRows: result.affectedRows || 0
            };
        } catch (error) {
            console.error('Erreur SQL:', error);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows[0] || null;
        } catch (error) {
            console.error('Erreur SQL:', error);
            throw error;
        }
    }

    async all(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Erreur SQL:', error);
            throw error;
        }
    }

    // Méthodes utilitaires pour la configuration
    async getGuildConfig(guildId) {
        return await this.get('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
    }

    async setGuildConfig(guildId, config) {
        const existing = await this.getGuildConfig(guildId);
        if (existing) {
            const updates = Object.keys(config).map(key => `${key} = ?`).join(', ');
            const values = Object.values(config);
            values.push(guildId);
            return await this.run(`UPDATE guild_config SET ${updates} WHERE guild_id = ?`, values);
        } else {
            const keys = ['guild_id', ...Object.keys(config)];
            const placeholders = keys.map(() => '?').join(', ');
            const values = [guildId, ...Object.values(config)];
            return await this.run(`INSERT INTO guild_config (${keys.join(', ')}) VALUES (${placeholders})`, values);
        }
    }

    // Méthodes pour les niveaux
    async getUserLevel(userId, guildId) {
        return await this.get('SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    }

    async updateUserXP(userId, guildId, xpGain) {
        const user = await this.getUserLevel(userId, guildId);
        const now = Date.now();
        
        if (user) {
            // Cooldown de 60 secondes entre les gains d'XP
            if (now - user.last_message_time < 60000) return user;
            
            const newXP = user.xp + xpGain;
            // Nouvelle formule pour 100 niveaux : chaque niveau nécessite (niveau * 100) XP
            // Niveau 1: 100 XP, Niveau 2: 200 XP, etc.
            const newLevel = this.calculateLevel(newXP);
            const newMessages = user.messages + 1;
            
            await this.run(
                'UPDATE user_levels SET xp = ?, level = ?, messages = ?, last_message_time = ? WHERE user_id = ? AND guild_id = ?',
                [newXP, newLevel, newMessages, now, userId, guildId]
            );
            
            return { ...user, xp: newXP, level: newLevel, messages: newMessages, levelUp: newLevel > user.level };
        } else {
            const initialLevel = this.calculateLevel(xpGain);
            await this.run(
                'INSERT INTO user_levels (user_id, guild_id, xp, level, messages, last_message_time) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, guildId, xpGain, initialLevel, 1, now]
            );
            return { xp: xpGain, level: initialLevel, messages: 1, levelUp: initialLevel > 0 };
        }
    }

    // Fonction pour calculer le niveau basé sur l'XP
    calculateLevel(xp) {
        // Formule: chaque niveau nécessite (niveau * 100) XP cumulé
        // Niveau 1: 100 XP, Niveau 2: 300 XP (100+200), Niveau 3: 600 XP (100+200+300), etc.
        let totalXPNeeded = 0;
        let level = 0;
        
        while (level < 100 && totalXPNeeded <= xp) {
            level++;
            totalXPNeeded += level * 100;
        }
        
        return Math.max(0, level - 1); // Retourner le dernier niveau atteint
    }

    // Fonction pour calculer l'XP nécessaire pour un niveau donné
    getXPForLevel(level) {
        if (level <= 0) return 0;
        if (level > 100) level = 100;
        
        let totalXP = 0;
        for (let i = 1; i <= level; i++) {
            totalXP += i * 100;
        }
        return totalXP;
    }

    // Méthodes pour les anniversaires
    async setBirthday(userId, guildId, birthday, year) {
        return await this.run(
            'INSERT INTO birthdays (user_id, guild_id, birthday, year) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE birthday = VALUES(birthday), year = VALUES(year)',
            [userId, guildId, birthday, year]
        );
    }

    async getBirthday(userId, guildId) {
        return await this.get('SELECT * FROM birthdays WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    }

    async getTodayBirthdays(guildId, today) {
        return await this.all('SELECT * FROM birthdays WHERE guild_id = ? AND birthday = ?', [guildId, today]);
    }

    // Méthodes pour les tickets
    async createTicket(channelId, userId, guildId, ticketNumber) {
        return await this.run(
            'INSERT INTO tickets (channel_id, user_id, guild_id, ticket_number, created_at) VALUES (?, ?, ?, ?, ?)',
            [channelId, userId, guildId, ticketNumber, Date.now()]
        );
    }

    async getTicket(channelId) {
        return await this.get('SELECT * FROM tickets WHERE channel_id = ?', [channelId]);
    }

    async closeTicket(channelId) {
        return await this.run(
            'UPDATE tickets SET status = ?, closed_at = ? WHERE channel_id = ?',
            ['closed', Date.now(), channelId]
        );
    }

    async getNextTicketNumber(guildId) {
        const result = await this.get('SELECT MAX(ticket_number) as max_num FROM tickets WHERE guild_id = ?', [guildId]);
        return (result?.max_num || 0) + 1;
    }
}

module.exports = Database;
