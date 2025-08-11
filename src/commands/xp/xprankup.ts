import { discordClient, robloxClient, robloxGroup } from '../../main';
import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getInvalidRobloxUserEmbed,
    getRobloxUserIsNotMemberEmbed,
    getUnexpectedErrorEmbed,
    getNoRankAboveEmbed,
    getRoleNotFoundEmbed,
    getVerificationChecksFailedEmbed,
    getSuccessfulXPRankupEmbed,
    getNoRankupAvailableEmbed,
    getNoPermissionEmbed,
} from '../../handlers/locale';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { config } from '../../config';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { provider } from '../../database';
import { findEligibleRole } from '../../handlers/handleXpRankup';

class XPRankupCommand extends Command {
    constructor() {
        super({
            trigger: 'xprankup',
            description: 'Ranks a user up based on their XP.',
            type: 'ChatInput',
            module: 'xp',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to attempt to rankup? This defaults to yourself.',
                    required: false,
                    autocomplete: true,
                    type: 'RobloxUser',
                },
            ]
        });
    }

    async run(ctx: CommandContext) {
        let robloxUserId: number;
        let robloxUser: any;
        try {
            if(!ctx.args['roblox-user']) {
                robloxUser = await getLinkedRobloxUser(ctx.user.id);
                if(!robloxUser) throw new Error();
                robloxUserId = robloxUser.userId;
            } else {
                // Try as direct user ID first
                robloxUserId = ctx.args['roblox-user'] as number;
                const username = await robloxClient.getUsernameFromId(robloxUserId);
                robloxUser = { userId: robloxUserId, username: username };
            }
        } catch (err) {
            if(!ctx.args['roblox-user']) return ctx.reply({ embeds: [ getInvalidRobloxUserEmbed() ]});
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
        const userData = await provider.findUser(robloxUserId.toString());
        const role = await findEligibleRole({ role: { rank: currentRank } }, groupRoles, userData.xp);
        if(!role) return ctx.reply({ embeds: [ getNoRankupAvailableEmbed() ] });

        if(ctx.args['roblox-user']) {
            if(!ctx.member.roles.cache.some((role) => config.permissions.users.includes(role.id)) && (config.permissions.all ? !ctx.member.roles.cache.some((role) => config.permissions.all.includes(role.id)) : false)) {
                return ctx.reply({ embeds: [ getNoPermissionEmbed() ] });
            }
            if(config.verificationChecks) {
                const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, currentRank);
                if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
            }
        }

        try {
            await robloxClient.setRank(config.groupId, robloxUserId, role.rank);
            ctx.reply({ embeds: [ await getSuccessfulXPRankupEmbed(robloxUser, role.name) ]});
            const currentRoleName = groupRoles.find((r: any) => r.rank === currentRank)?.name || 'Unknown';
            logAction('XP Rankup', ctx.user, null, robloxUser, `${currentRoleName} (${currentRank}) → ${role.name} (${role.rank})`);
        } catch (err) {
            console.log(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default XPRankupCommand;