import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getSuccessfulSetRankEmbed,
    getUnexpectedErrorEmbed,
    getRoleNotFoundEmbed,
    getVerificationChecksFailedEmbed,
    getAlreadyRankedEmbed,
    getUserSuspendedEmbed,
} from '../../handlers/locale';
import { config } from '../../config';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { provider } from '../../database';

class SetRankCommand extends Command {
    constructor() {
        super({
            trigger: 'setrank',
            description: 'Changes the rank of a user in the Roblox group.',
            type: 'ChatInput',
            module: 'ranking',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Whose rank would you like to change?',
                    autocomplete: true,
                    type: 'RobloxUser',
                },
                {
                    trigger: 'roblox-role',
                    description: 'What role would you like to change them to?',
                    autocomplete: true,
                    type: 'RobloxRole',
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
                    ids: config.permissions.ranking,
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

        let currentRank: number;
        try {
            currentRank = await robloxClient.getRankInGroup(config.groupId, robloxUserId);
            if(currentRank === 0) throw new Error(); // 0 means not in group
        } catch (err) {
            return ctx.reply({ embeds: [ getRobloxUserIsNotMemberEmbed() ]});
        }

        const groupRoles = await robloxClient.getRoles(config.groupId);
        const role = groupRoles.find((role: any) => role.id == ctx.args['roblox-role'] || role.rank == ctx.args['roblox-role'] || role.name.toLowerCase().startsWith(ctx.args['roblox-role'].toLowerCase()));
        if(!role || !role.rank || role.rank === 0 || role.rank > config.maximumRank || currentRank > config.maximumRank) return ctx.reply({ embeds: [ getRoleNotFoundEmbed() ]});
        if(currentRank === role.rank) return ctx.reply({ embeds: [ getAlreadyRankedEmbed() ] });

        if(config.verificationChecks) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, role.rank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUserId.toString());
        if(userData.suspendedUntil) return ctx.reply({ embeds: [ getUserSuspendedEmbed() ] });

        try {
            await robloxClient.setRank(config.groupId, robloxUserId, role.rank);
            ctx.reply({ embeds: [ await getSuccessfulSetRankEmbed(robloxUser, role.name) ]});
            const currentRoleIndex = groupRoles.findIndex((r: any) => r.rank === currentRank);
            const currentRoleName = groupRoles[currentRoleIndex].name;
            logAction('Update Rank', ctx.user, ctx.args['reason'], robloxUser, `${currentRoleName} (${currentRank}) → ${role.name} (${role.rank})`);
        } catch (err) {
            console.log(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default SetRankCommand;
