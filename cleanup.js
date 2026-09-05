require('./load-env');
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started clearing all application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] },
        );
        console.log('Successfully cleared global application (/) commands.');

        if (process.env.GUILD_ID && process.env.GUILD_ID !== 'your_guild_id_here') {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: [] },
            );
            console.log(`Successfully cleared application (/) commands for guild: ${process.env.GUILD_ID}`);
        } else {
            console.log('Skipping guild command cleanup (GUILD_ID not set or default).');
        }

        console.log('Cleanup complete.');
    } catch (error) {
        console.error(error);
    }
})();
