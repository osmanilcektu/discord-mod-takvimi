const { MessageFlags } = require('discord.js');

const EXPIRED_INTERACTION_CODES = new Set([10062, 40060]);

function isExpiredInteractionError(error) {
    return Boolean(error && EXPIRED_INTERACTION_CODES.has(Number(error.code)));
}

async function deferEphemeral(interaction) {
    if (interaction.deferred || interaction.replied) return true;

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return true;
    } catch (error) {
        if (isExpiredInteractionError(error)) return false;
        throw error;
    }
}

async function safeEphemeralReply(interaction, payload) {
    const body = typeof payload === 'string'
        ? { content: payload }
        : { ...payload };

    body.flags = MessageFlags.Ephemeral;
    delete body.ephemeral;

    try {
        if (interaction.deferred) {
            const editBody = { ...body };
            delete editBody.flags;
            return await interaction.editReply(editBody);
        }

        if (interaction.replied) {
            return await interaction.followUp(body);
        }

        return await interaction.reply(body);
    } catch (error) {
        if (isExpiredInteractionError(error)) return null;
        throw error;
    }
}

module.exports = {
    isExpiredInteractionError,
    deferEphemeral,
    safeEphemeralReply
};
