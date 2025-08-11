import { robloxClient } from '../main';
import { logAction } from '../handlers/handleLogging';
import { config } from '../config';

let lastRecordedDate: number;

const recordAuditLogs = async () => {
    try {
        const auditLog = await robloxClient.getAuditLog(config.groupId);
        const mostRecentDate = new Date(auditLog.data?.[0].created).getTime();
        if(lastRecordedDate) {
            const groupRoles = await robloxClient.getRoles(config.groupId);
            auditLog.data.forEach(async (log) => {
                const currentUser = await robloxClient.getCurrentUser();
                if(currentUser.UserID !== log.actor.user.userId) {
                    const logCreationDate = new Date(log.created);
                    if(Math.round(logCreationDate.getTime() / 1000) > Math.round(lastRecordedDate / 1000)) {
                        const oldRole = groupRoles.find((role) => role.id === log.description['OldRoleSetId']);
                        const newRole = groupRoles.find((role) => role.id === log.description['NewRoleSetId']);
                        const targetUsername = await robloxClient.getUsernameFromId(log.description['TargetId']);
                        const target = { userId: log.description['TargetId'], username: targetUsername };
                        logAction('Manual Set Rank', log.actor.user, null, target, `${oldRole.name} (${oldRole.rank}) → ${newRole.name} (${newRole.rank})`);
                    }
                }
            });
            lastRecordedDate = mostRecentDate;
        } else {
            lastRecordedDate = mostRecentDate;
        }
    } catch (err) {
        console.error(err);
    }
    setTimeout(recordAuditLogs, 60000);
}

export { recordAuditLogs };
