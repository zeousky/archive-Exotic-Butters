const { SlashCommandBuilder } = require('discord.js');

const BUTTER_COMMANDS = [
    ['exotic-butters', 'Unleash the full Exotic Butters experience.'],
    ['butter', 'A shortcut to Exotic Butters.'],
    ['spread-the-butter', 'Spread Exotic Butters to the chat.'],
];

const NSFW_COMMANDS = [
    ['b-femboy', 'Random femboy NSFW (B.femboy) - with source & format options'],
    ['b-facesit', 'Facesitting content (B.facesit)'],
    ['b-buttfuck', 'Buttfuck / anal content (B.buttfuck)'],
    ['b-squirt', 'Squirting content (B.squirt)'],
    ['help', 'Lists all available NSFW commands.'],
];

const ALL_COMMANDS = [...BUTTER_COMMANDS, ...NSFW_COMMANDS];
const COMMAND_NAMES = ALL_COMMANDS.map(([name]) => name);

function buildCommands() {
    return ALL_COMMANDS.map(([name, description]) => {
        const builder = new SlashCommandBuilder()
            .setName(name)
            .setDescription(description)
            .setDMPermission(true);

        if (name.startsWith('b-')) {
            builder.setNSFW(true);

            builder.addStringOption(option =>
                option.setName('source')
                    .setDescription('Where to fetch the content from')
                    .setRequired(false)
                    .addChoices(
                        { name: 'e621', value: 'e621' },
                        { name: 'Rule34', value: 'rule34' }
                    )
            );

            builder.addStringOption(option =>
                option.setName('format')
                    .setDescription('Preferred media type')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Any', value: 'any' },
                        { name: 'Image', value: 'image' },
                        { name: 'GIF', value: 'gif' },
                        { name: 'Video', value: 'video' }
                    )
            );
        }

        return builder.toJSON();
    });
}

module.exports = { buildCommands, COMMAND_NAMES };