import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { config } from '../../config';
import {
    getInvalidRobloxUserEmbed,
    getNoDatabaseEmbed,
    getPartialUserInfoEmbed,
    getRobloxUserIsNotMemberEmbed,
    getUnexpectedErrorEmbed,
    getUserInfoEmbed,
} from '../../handlers/locale';
import { provider } from '../../database';

class InfoCommand extends Command {
    constructor() {
        super({
            trigger: 'info',
            description: 'Displays information about a group member, and gives you some quick actions.',
            type: 'ChatInput',
            module: 'information',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to view the information of?',
                    required: false,
                    type: 'String',
                },
            ]
        });
    }

    async run(ctx: CommandContext) {
        let robloxUserId: number;
        let robloxUser: any;
        try {
            if(ctx.args['roblox-user']) {
                // Try as direct user ID first
                try {
                    robloxUserId = ctx.args['roblox-user'] as number;
                    const username = await robloxClient.getUsernameFromId(robloxUserId);
                    robloxUser = { userId: robloxUserId, username: username };
                } catch (err) {
                    // Try as username
                    robloxUserId = await robloxClient.getIdFromUsername(ctx.args['roblox-user'] as string);
                    if(!robloxUserId) throw new Error();
                    const username = await robloxClient.getUsernameFromId(robloxUserId);
                    robloxUser = { userId: robloxUserId, username: username };
                }
            } else {
                robloxUser = await getLinkedRobloxUser(ctx.user.id);
                robloxUserId = robloxUser.userId;
            }
            if(!robloxUser) throw new Error();
        } catch (err) {
            try {
                const idQuery = ctx.args['roblox-user'].replace(/[^0-9]/gm, '');
                const discordUser = await discordClient.users.fetch(idQuery);
                const linkedUser = await getLinkedRobloxUser(discordUser.id);
                if(!linkedUser) throw new Error();
                robloxUser = linkedUser;
                robloxUserId = linkedUser.userId;
            } catch (err) {
                return ctx.reply({ embeds: [ getInvalidRobloxUserEmbed() ]});
            }
        }

        const userData = await provider.findUser(robloxUserId.toString());

        let currentRank: number;
        try {
            currentRank = await robloxClient.getRankInGroup(config.groupId, robloxUserId);
            if(currentRank === 0) throw new Error();
        } catch (err) {
            return ctx.reply({ embeds: [ await getPartialUserInfoEmbed(robloxUser, userData) ]});
        }

        return ctx.reply({ embeds: [ await getUserInfoEmbed(robloxUser, { role: { rank: currentRank } }, userData) ] });
    }
}

export default InfoCommand;