import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getSuccessfulSuspendEmbed,
    getUnexpectedErrorEmbed,
    getVerificationChecksFailedEmbed,
    getRoleNotFoundEmbed,
    getInvalidDurationEmbed,
    getAlreadySuspendedEmbed,
    noSuspendedRankLog,
    getNoDatabaseEmbed,
} from '../../handlers/locale';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { config } from '../../config';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import ms from 'ms';
import { provider } from '../../database';

class SuspendCommand extends Command {
    constructor() {
        super({
            trigger: 'suspend',
            description: 'Temporarily fires a user.',
            type: 'ChatInput',
            module: 'suspensions',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to suspend?',
                    autocomplete: true,
                    type: 'String',
                },
                {
                    trigger: 'duration',
                    description: 'How long should they be suspended for? (Format example: 1d, 3d12h, 3 days)',
                    type: 'String',
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

        let duration: number;
        try {
            duration = Number(ms(ctx.args['duration']));
            if(!duration) throw new Error();
            if(duration < 0.5 * 60000 && duration > 6.31138519 * (10 ^ 10) ) return ctx.reply({ embeds: [ getInvalidDurationEmbed() ] });
        } catch (err) {
            return ctx.reply({ embeds: [ getInvalidDurationEmbed() ] });
        }
        
        const endDate = new Date();
        endDate.setMilliseconds(endDate.getMilliseconds() + duration);

        const groupRoles = await robloxClient.getRoles(config.groupId);
        const role = groupRoles.find((role) => role.rank === config.suspendedRank);
        if(!role) {
            console.error(noSuspendedRankLog);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
        if(role.rank > config.maximumRank || currentRank > config.maximumRank) return ctx.reply({ embeds: [ getRoleNotFoundEmbed() ] });

        if(config.verificationChecks) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, role.rank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUserId.toString());
        if(userData.suspendedUntil) return ctx.reply({ embeds: [ getAlreadySuspendedEmbed() ] });
        const currentRole = groupRoles.find((r: any) => r.rank === currentRank);
        await provider.updateUser(robloxUserId.toString(), { suspendedUntil: endDate, unsuspendRank: currentRole.id });

        try {
            if(currentRank !== role.rank) await robloxClient.setRank(config.groupId, robloxUserId, role.rank);
            ctx.reply({ embeds: [ await getSuccessfulSuspendEmbed(robloxUser, role.name, endDate) ]});
            const currentRoleName = groupRoles.find((r: any) => r.rank === currentRank)?.name;
            logAction('Suspend', ctx.user, ctx.args['reason'], robloxUser, `${currentRoleName} (${currentRank}) → ${role.name} (${role.rank})`, endDate);
        } catch (err) {
            console.error(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default SuspendCommand;
