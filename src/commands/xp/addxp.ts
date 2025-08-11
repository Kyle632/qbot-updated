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
    getSuccessfulXPChangeEmbed,
    getInvalidXPEmbed,
    getNoRankupAvailableEmbed,
    getSuccessfulAddingAndRankupEmbed,
} from '../../handlers/locale';
import { checkActionEligibility } from '../../handlers/verificationChecks';
import { config } from '../../config';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';
import { provider } from '../../database';
import { findEligibleRole } from '../../handlers/handleXpRankup';

class AddXPCommand extends Command {
    constructor() {
        super({
            trigger: 'addxp',
            description: 'Adds XP to a user.',
            type: 'ChatInput',
            module: 'xp',
            args: [
                {
                    trigger: 'roblox-user',
                    description: 'Who do you want to add XP to?',
                    autocomplete: true,
                    type: 'RobloxUser',
                },
                {
                    trigger: 'increment',
                    description: 'How much XP would you like to add?',
                    type: 'Number',
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
                    ids: config.permissions.users,
                    value: true,
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        let enoughForRankUp: boolean;
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

        if(!Number.isInteger(Number(ctx.args['increment'])) || Number(ctx.args['increment']) < 0) return ctx.reply({ embeds: [ getInvalidXPEmbed() ] });

        if(config.verificationChecks) {
            const actionEligibility = await checkActionEligibility(ctx.user.id, ctx.guild.id, { role: { rank: currentRank } }, currentRank);
            if(!actionEligibility) return ctx.reply({ embeds: [ getVerificationChecksFailedEmbed() ] });
        }

        const userData = await provider.findUser(robloxUserId.toString());
        const xp = Number(userData.xp) + Number(ctx.args['increment']);
        await provider.updateUser(robloxUserId.toString(), { xp });

        const groupRoles = await robloxClient.getRoles(config.groupId);
        const role = await findEligibleRole({ role: { rank: currentRank } }, groupRoles, xp);
        if (role) {
            enoughForRankUp = true;
            try {
                await robloxClient.setRank(config.groupId, robloxUserId, role.rank);
                ctx.reply({ embeds: [ await getSuccessfulAddingAndRankupEmbed(robloxUser, role.name,xp.toString()) ]});
                const currentRoleName = groupRoles.find((r: any) => r.rank === currentRank)?.name || 'Unknown';
                logAction('XP Rankup', ctx.user, null, robloxUser, `${currentRoleName} (${currentRank}) → ${role.name} (${role.rank})`);
            } catch (err) {
                console.log(err);
                return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
            }
        } else {
            ctx.reply({ embeds: [ await getSuccessfulXPChangeEmbed(robloxUser, xp) ]});
        }

        try {
            logAction('Add XP', ctx.user, ctx.args['reason'], robloxUser, null, null, null, `${userData.xp} → ${xp} (+${Number(ctx.args['increment'])})`);
        } catch (err) {
            console.log(err);
            return ctx.reply({ embeds: [ getUnexpectedErrorEmbed() ]});
        }
    }
}

export default AddXPCommand;