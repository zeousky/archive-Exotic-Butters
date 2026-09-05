require('./load-env');
const path = require('path');
const { Client, GatewayIntentBits, Events, ActivityType, AttachmentBuilder } = require('discord.js');
const { COMMAND_NAMES } = require('./commands');

const AUDIO_PATH = path.join(__dirname, 'exotic-butters.mp3');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    readyClient.user.setActivity('Exotic Butters', { type: ActivityType.Listening });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!COMMAND_NAMES.includes(interaction.commandName)) return;

    const name = interaction.commandName;

    if (name === 'help') {
        await handleHelp(interaction);
        return;
    }

    // The B. prefix NSFW commands
    const nsfwCommandMap = {
        'b-femboy': 'femboy',
        'b-facesit': 'facesitting',
        'b-buttfuck': 'anal',
        'b-squirt': 'squirting',
    };

    if (nsfwCommandMap[name]) {
        await handleNSFW(interaction, name, nsfwCommandMap[name]);
        return;
    }

    // Butter commands (SFW)
    const file = new AttachmentBuilder(AUDIO_PATH, { name: 'exotic-butters.mp3' });

    try {
        await interaction.reply({ files: [file] });
    } catch (error) {
        console.error('Failed to send Exotic Butters:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Could not deliver the butter. Try again.', ephemeral: true });
        }
    }
});

async function handleHelp(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const helpText = [
        '**NSFW Commands** (only visible in age-restricted channels):',
        '',
        '`/b-femboy` (B.femboy) - Random femboy NSFW (supports source + format options)',
        '`/b-facesit` (B.facesit) - Facesitting / face sitting',
        '`/b-buttfuck` (B.buttfuck) - Buttfuck / anal',
        '`/b-squirt` (B.squirt) - Squirting',
        '',
        'Use the `source` and `format` options on the B. commands.',
        'Butter commands and this help are always available.',
    ].join('\n');

    await interaction.editReply({ content: helpText });
}

async function handleNSFW(interaction, commandName, coreTag) {
    await interaction.deferReply();

    try {
        const source = interaction.options.getString('source') || 'e621';
        const format = interaction.options.getString('format') || 'any';

        const posts = await getRandomNSFWPosts(coreTag, source, format, 2);

        if (!posts.length) {
            await interaction.editReply({ content: `No ${format} results found from ${source}. Try different options.` });
            return;
        }

        const content = posts.map((p) => p.source).join('\n\n');
        await interaction.editReply({ content });
    } catch (error) {
        console.error('NSFW command failed:', error);
        try {
            await interaction.editReply({ content: 'Failed to fetch content. Try again soon.' });
        } catch {}
    }
}

async function getRandomNSFWPosts(coreTag, source = 'e621', format = 'any', count = 2) {
    let raw = [];

    // Fetch more aggressively when user wants a specific format (gifs are rarer)
    const fetchLimit = (format === 'any') ? 30 : 150;

    if (source === 'rule34') {
        const r34User = process.env.RULE34_USER_ID?.trim();
        const r34Key = process.env.RULE34_API_KEY?.trim();

        if (r34User && r34Key) {
            const r34Tags = `${coreTag} -rating:safe`;
            raw = await fetchRule34Posts(r34Tags, fetchLimit, r34User, r34Key);
        } else {
            source = 'e621';
        }
    }

    if (source === 'e621' || raw.length === 0) {
        const e621Tags = `${coreTag} order:random rating:e`;
        raw = await fetchE621Posts(e621Tags, fetchLimit);
    }

    const filtered = raw.filter(p => matchesFormat(p, format));
    if (filtered.length === 0) return [];

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function matchesFormat(post, format) {
    if (format === 'any' || !post) return true;
    const ext = (post.ext || '').toLowerCase();
    if (format === 'image') return ['png','jpg','jpeg','webp'].includes(ext);
    if (format === 'gif') return ['gif', 'webm'].includes(ext);  // webm is the modern "gif" on these sites
    if (format === 'video') return ['mp4','mov'].includes(ext);
    return true;
}

async function fetchE621Posts(tags, fetchLimit = 50) {
    const apiLimit = Math.min(320, fetchLimit);
    const url = `https://e621.net/posts.json?tags=${encodeURIComponent(tags)}&limit=${apiLimit}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'ExoticButtersBot/2.0 (nsfw command)' },
    });
    if (!res.ok) throw new Error(`e621 responded ${res.status}`);
    const json = await res.json();
    const posts = (json.posts || []).filter(p => p.file && p.file.url);
    return posts.slice(0, apiLimit).map(p => ({
        id: p.id,
        url: p.file.url,
        ext: p.file.ext || '',
        source: `https://e621.net/posts/${p.id}`,
    }));
}

async function fetchRule34Posts(tags, fetchLimit = 100, userId, apiKey) {
    const params = new URLSearchParams({
        page: 'dapi',
        s: 'post',
        q: 'index',
        tags,
        limit: '200',
        json: '1',
        user_id: userId,
        api_key: apiKey,
    });
    const apiUrl = `https://api.rule34.xxx/index.php?${params}`;
    const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'ExoticButtersBot/2.0 (nsfw command)' },
    });
    if (!res.ok) throw new Error(`rule34 http ${res.status}`);
    const text = await res.text();
    let posts;
    try {
        posts = JSON.parse(text);
    } catch {
        throw new Error('rule34 non-json (bad auth or rate limit?): ' + text.slice(0, 120));
    }
    if (!Array.isArray(posts)) {
        throw new Error('rule34 unexpected response');
    }
    // Random sample
    const shuffled = posts.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, fetchLimit).map(p => {
        const fileUrl = p.file_url || p.sample_url || p.preview_url;
        if (!fileUrl) return null;
        const m = String(fileUrl).match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
        const ext = m ? m[1] : 'jpg';
        return {
            id: p.id,
            url: fileUrl,
            ext,
            source: `https://rule34.xxx/index.php?page=post&s=view&id=${p.id}`,
        };
    }).filter(Boolean);
}

const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
    console.error('DISCORD_TOKEN is not set. Add it to Railway variables or a local .env file.');
    process.exit(1);
}

client.login(token);