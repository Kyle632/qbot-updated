import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getInvalidRobloxUserEmbed,
    getUnexpectedErrorEmbed,
    getSuccessfulAcceptJoinRequestEmbed,
    getNoJoinRequestEmbed,
} from '../../handlers/locale';
import { config } from '../../config';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';

class AcceptJoinCommand extends Command {
    constructor() {
        super({
            trigger: 'acceptjoin',
            description: 'Accepts the join request from a user.',
            type: 'ChatInput',
            module: 'join-requests',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Whose join request do you want to accept?',
                    autocomplete: true,
                    type: 'RobloxUser',
                },
                {
                    trigger: 'reason',
                    description: 'If you would like a reason to be supplied in the logs, put it here.',
                    isLegacyFlag: true,
                    required: false,
                    type: 'String',
                },
            ],
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.join,
                    value: true,
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        let robloxUserId: number;
        let robloxUser: any;
        try {
            // Try as direct user ID first
            robloxUserId = ctx.args['roblox-user'] as number;
            const username = await robloxClient.getUsernameFromId(robloxUserId);
            robloxUser = { userId: robloxUserId, username: username };
        } catch (err) {
            try {
                // Try as username
                robloxUserId = await robloxClient.getIdFromUsername(ctx.args['roblox-user'] as string);
                if(!robloxUserId) throw new Error();
                const username = await robloxClient.getUsernameFromId(robloxUserId);
                robloxUser = { userId: robloxUserId, username: username };
            } catch (err) {
                try {
                    // Try as Discord user mention/ID
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
        }

        // Check if user has a pending join request
        try {
            const joinRequests = await robloxClient.getJoinRequests(config.groupId, 'Asc', 100);
            const userJoinRequest = joinRequests.data.find((request: any) => request.requester.userId === robloxUserId);
            if(!userJoinRequest) return ctx.reply({ embeds: [ getNoJoinRequestEmbed() ] });
        } catch (err) {
            return ctx.reply({ embeds: [ getNoJoinRequestEmbed() ] });
        }

        try {
            await robloxGroup.acceptJoinRequest(robloxUserId);
            ctx.reply({ embeds: [ await getSuccessfulAcceptJoinRequestEmbed(robloxUser) ]});
            logAction('Accept Join Request', ctx.user, ctx.args['reason'], robloxUser);
        } catch (err) {
            console.log(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default AcceptJoinCommand;