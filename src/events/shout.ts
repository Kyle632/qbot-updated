import { TextChannel } from 'discord.js';
import { discordClient, robloxClient } from '../main';
import { config } from '../config';
import { getShoutLogEmbed } from '../handlers/locale';
let firstShout = true;
let lastShout: string;

const recordShout = async () => {
    try {
        const group = await robloxClient.getGroup(config.groupId);
        const logChannel = await discordClient.channels.fetch(config.logChannels.shout) as TextChannel;
        if(firstShout) {
            firstShout = false;
        } else {
            // TODO: Fix shout content access for Noblox.js
            if(group.shout !== null && lastShout !== (group.shout as any).content) {
                logChannel.send({ embeds: [ await getShoutLogEmbed(group.shout) ] });
            }
        }
        setTimeout(recordShout, 60 * 1000);
        if((group.shout as any)?.content) lastShout = (group.shout as any)?.content;
    } catch (err) {
        console.error(err);
    }
}

export { recordShout };
