/**
 * Example Discord Command using Puter Codex API
 * A slash command that generates code using the Codex API
 *
 * Usage: /codegen <prompt> [model]
 * Models: gpt-5.3, gpt-5.2, gpt-5.1, gpt-5.1-mini, gpt-5.1-max
 */

const { SlashCommandBuilder } = require('discord.js');
const { generateCode } = require('../puter-coder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('codegen')
    .setDescription('Generate code using Puter Codex API')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('What code do you want to generate?')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('model')
        .setDescription('Which Codex model to use (default: gpt-5.1)')
        .setRequired(false)
        .addChoices(
          { name: 'Latest (GPT-5.3)', value: 'gpt-5.3' },
          { name: 'GPT-5.2', value: 'gpt-5.2' },
          { name: 'Standard (GPT-5.1)', value: 'gpt-5.1' },
          { name: 'Mini (Fast)', value: 'gpt-5.1-mini' },
          { name: 'Max (Powerful)', value: 'gpt-5.1-max' }
        )
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const model = interaction.options.getString('model') || 'gpt-5.1';

    // Show loading message
    await interaction.deferReply();

    try {
      console.log(`[Codex] Generating code with model: ${model}`);
      console.log(`[Codex] Prompt: ${prompt}`);

      const code = await generateCode(prompt, model);

      // Format the response with code block (split if too long)
      const MAX_LENGTH = 2000;

      if (code.length > MAX_LENGTH) {
        // Send in chunks if response is too long
        await interaction.editReply({
          content: `**Code Generation Complete** (Model: ${model})\n\n\`\`\`javascript\n${code.substring(0, MAX_LENGTH - 50)}\n... (truncated - see file)\n\`\`\``,
          files: [
            {
              attachment: Buffer.from(code, 'utf-8'),
              name: 'generated-code.js',
            }
          ],
        });
      } else {
        await interaction.editReply({
          content: `**Code Generation Complete** (Model: ${model})\n\n\`\`\`javascript\n${code}\n\`\`\``,
        });
      }

    } catch (error) {
      console.error('Codex API Error:', error);

      await interaction.editReply({
        content: `**Error generating code**: ${error.message || 'Unknown error occurred'}`,
      });
    }
  },
};
