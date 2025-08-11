import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getSuccessfulFireEmbed,
    getUnexpectedErrorEmbed,
    getVerificationChecksFailedEmbed,
    getAlreadyFiredEmbed,
    getRoleNotFoundEmbed,
    noFiredRankLog,
    getUserSuspendedEmbed,
} from '../../handlers/locale';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { config } from '../../config';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { provider } from '../../database';

class FireCommand extends Command {
    constructor() {
        super({
            trigger: 'fire',
            description: 'Sets a users rank in the Roblox group to 1.',
            type: 'ChatInput',
            module: 'ranking',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to fire?',
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
        const role = groupRoles.find((role: any) => role.rank === config.firedRank);
        if(!role) {
            console.error(noFiredRankLog);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
        if(currentRank === config.firedRank) return ctx.reply({ embeds: [ getAlreadyFiredEmbed() ] });
        if(role.rank > config.maximumRank || currentRank > config.maximumRank) return ctx.reply({ embeds: [ getRoleNotFoundEmbed() ] });

        if(config.verificationChecks) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, role.rank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUserId.toString());
        if(userData.xp !== 0) await provider.updateUser(robloxUserId.toString(), { xp: 0 });
        if(userData.suspendedUntil) return ctx.reply({ embeds: [ getUserSuspendedEmbed() ] });

        try {
            await robloxClient.setRank(config.groupId, robloxUserId, role.rank);
            ctx.reply({ embeds: [ await getSuccessfulFireEmbed(robloxUser, role.name) ]});
            const currentRoleIndex = groupRoles.findIndex((r: any) => r.rank === currentRank);
            const currentRoleName = groupRoles[currentRoleIndex].name;
            logAction('Fire', ctx.user, ctx.args['reason'], robloxUser, `${currentRoleName} (${currentRank}) → ${role.name} (${role.rank})`);
        } catch (err) {
            console.error(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default FireCommand;
