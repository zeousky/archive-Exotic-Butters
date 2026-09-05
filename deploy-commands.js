require('./load-env');
const { REST, Routes } = require('discord.js');
const { buildCommands } = require('./commands');

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.CLIENT_ID?.trim();

if (!token || !clientId) {
    console.error('DISCORD_TOKEN and CLIENT_ID are required.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        const commands = buildCommands();
        console.log(`Registering ${commands.length} global slash command(s)...`);

        await rest.put(Routes.applicationCommands(clientId), { body: commands });

        console.log('Successfully registered global commands (available in servers and DMs).');
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();