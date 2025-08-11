import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import { discordClient, robloxClient, robloxGroup } from '../../main';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { provider } from '../../database';
import { logAction } from '../../handlers/handleLogging';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getVerificationChecksFailedEmbed,
    getUnexpectedErrorEmbed,
    getSuccessfulGroupBanEmbed,
    getNoDatabaseEmbed,
    getUserBannedEmbed
} from '../../handlers/locale';
import { config } from '../../config';

class GroupBanCommand extends Command {
    constructor() {
        super({
            trigger: 'groupban',
            description: 'Bans someone from the group',
            type: 'ChatInput',
            module: 'admin',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you wish to ban from the group?',
                    autocomplete: true,
                    required: true,
                    type: 'RobloxUser'
                },
                {
                    trigger: 'reason',
                    description: 'If you would like a reason to be supplied in the logs, put it here.',
                    required: false,
                    type: 'String'
                }
            ],
            permissions: [
                {
                    type: 'role',
                    ids: config.permissions.admin,
                    value: true,
                }
            ]
        })
    };

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

        let currentRank: number = 0;
        try {
            currentRank = await robloxClient.getRankInGroup(config.groupId, robloxUserId);
            // currentRank will be 0 if not in group
        } catch (err) {}

        if(config.verificationChecks && currentRank > 0) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, currentRank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUserId.toString());
        if(userData.isBanned) return ctx.reply({ embeds: [ getUserBannedEmbed() ] });
        
        try {
            await provider.updateUser(robloxUserId.toString(), {
                isBanned: true
            });
            if(currentRank > 0) await robloxClient.exile(config.groupId, robloxUserId);
            logAction('Group Ban', ctx.user, ctx.args['reason'], robloxUser);
            return ctx.reply({ embeds: [ getSuccessfulGroupBanEmbed(robloxUser) ]});
        } catch(e) {
            console.log(e);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }

    }
}

export default GroupBanCommand;
