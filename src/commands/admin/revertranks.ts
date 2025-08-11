import { CommandContext } from '../../structures/addons/CommandAddons';
import { Command } from '../../structures/Command';
import {
    getSuccessfulRevertRanksEmbed,
    getInvalidDurationEmbed,
    getInvalidRobloxUserEmbed,
} from '../../handlers/locale';
import { config } from '../../config';
import { discordClient, robloxClient, robloxGroup } from '../../main';
import ms from 'ms';
import { logAction } from '../../handlers/handleLogging';
import { getLinkedRobloxUser } from '../../handlers/accountLinks';

class RevertRanksCommand extends Command {
    constructor() {
        super({
            trigger: 'revertranks',
            description: 'Reverts all ranking events within the time of the specified duration.',
            type: 'ChatInput',
            module: 'admin',
            args: [
                {
                    trigger: 'duration',
                    description: 'How much time of ranking events would you like to revert?',
                    type: 'String',
                },
                {
                    trigger: 'filter',
                    description: 'Do you want to filter actions to a specific Roblox user?',
                    autocomplete: true,
                    required: false,
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
                    ids: config.permissions.admin,
                    value: true,
                }
            ]
        });
    }

    async run(ctx: CommandContext) {
        let robloxUserId: number;
        let robloxUser: any;
        if(ctx.args['filter']) {
            try {
                // Try as direct user ID first
                robloxUserId = ctx.args['filter'] as number;
                const username = await robloxClient.getUsernameFromId(robloxUserId);
                robloxUser = { userId: robloxUserId, username: username };
            } catch (err) {
                try {
                    // Try as username
                    robloxUserId = await robloxClient.getIdFromUsername(ctx.args['filter'] as string);
                    if(!robloxUserId) throw new Error();
                    const username = await robloxClient.getUsernameFromId(robloxUserId);
                    robloxUser = { userId: robloxUserId, username: username };
                } catch (err) {
                    try {
                        // Try as Discord user mention/ID
                        const idQuery = ctx.args['filter'].replace(/[^0-9]/gm, '');
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
        }
        
        const auditLog = await robloxClient.getAuditLog(config.groupId, 'ChangeRank', 100);

        let duration: number;
        try {
            duration = Number(ms(ctx.args['duration']));
            if(!duration) throw new Error();
            if(duration < 0.5 * 60000 && duration > 8.64e+7 ) return ctx.reply({ embeds: [ getInvalidDurationEmbed() ] });
        } catch (err) {
            return ctx.reply({ embeds: [ getInvalidDurationEmbed() ] });
        }
        
        const maximumDate = new Date();
        maximumDate.setMilliseconds(maximumDate.getMilliseconds() - duration);

        // Get bot user ID from noblox client
        const botUserInfo = await robloxClient.getCurrentUser();

        const affectedLogs = (auditLog as any).filter((log: any) => {
            if(log.actor.user.userId === botUserInfo.UserID && !(robloxUser && robloxUser.userId === botUserInfo.UserID)) return;
            if(robloxUser && robloxUser.userId !== log.actor.user.userId) return;
            const logCreatedDate = new Date(log.created);
            return logCreatedDate > maximumDate;
        });
        
        affectedLogs.forEach(async (log: any, index: number) => {
            setTimeout(async () => {
                await robloxClient.setRank(config.groupId, log.description['TargetId'], log.description['OldRoleSetId']);
            }, index * 1000);
        });

        logAction('Revert Ranks', ctx.user, ctx.args['reason'], null, null, maximumDate);
        return ctx.reply({ embeds: [ getSuccessfulRevertRanksEmbed(affectedLogs.length) ] });
    }
}

export default RevertRanksCommand;
