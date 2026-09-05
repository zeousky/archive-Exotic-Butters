require('./load-env');
const { REST, Routes } = require('discord.js');
const { buildCommands } = require('./commands');

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.CLIENT_ID?.trim();
const guildId = process.env.GUILD_ID?.trim();

if (!token || !clientId || !guildId) {
    console.error('DISCORD_TOKEN, CLIENT_ID, and GUILD_ID are required.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        const commands = buildCommands();
        console.log(`Registering ${commands.length} guild slash command(s) for ${guildId}...`);

        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

        console.log('Successfully registered guild commands.');
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();