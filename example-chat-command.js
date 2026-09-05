/**
 * Discord command example for Claude text generation
 */

const { SlashCommandBuilder } = require('discord.js');
const { chat } = require('../puter-chat');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claude')
    .setDescription('Generate text using Puter Claude models')
    .addStringOption(option =>
      option.setName('prompt').setDescription('Your prompt').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('model').setDescription('Model to use').setRequired(false)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const model = interaction.options.getString('model') || 'sonnet-4-6';

    await interaction.deferReply();
    try {
      const resp = await chat(prompt, model);
      const text = resp.message?.content?.[0]?.text || resp;
      await interaction.editReply(text.slice(0, 1990));
    } catch (err) {
      await interaction.editReply('Error: ' + (err.message || err));
    }
  }
};
