import { TextChannel, User as DiscordUser } from 'discord.js';
import { discordClient } from '../main';
import { getLogEmbed } from './locale';
import { config } from '../config';
import { recordAction } from './abuseDetection';

let actionLogChannel: TextChannel;
const getLogChannels = async () => {
    if(config.logChannels.actions) {
        actionLogChannel = await discordClient.channels.fetch(config.logChannels.actions) as TextChannel;
    }
}

const logAction = async (action: string, moderator: DiscordUser | any, reason?: string, target?: any, rankChange?: string, endDate?: Date, body?: string, xpChange?: string) => {
    if(moderator.id !== discordClient.user.id) recordAction(moderator);
    if(!actionLogChannel) return;
    actionLogChannel.send({ embeds: [ await getLogEmbed(action, moderator, reason, target, rankChange, endDate, body, xpChange) ] });
}

export { logAction, getLogChannels };