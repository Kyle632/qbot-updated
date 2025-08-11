import { robloxClient, robloxGroup } from '../main';
import { config } from '../config';
import { provider } from '../database';

const checkBans = async () => {
    try {
        const bannedUsers = await provider.findBannedUsers();
        bannedUsers.forEach(async (user) => {
            try {
                const currentRank = await robloxClient.getRankInGroup(config.groupId, Number(user.robloxId));
                if(currentRank === 0) throw new Error(); // Not in group
                await robloxClient.exile(config.groupId, Number(user.robloxId));
            } catch (err) {};
        });
    } catch (err) {
        console.error(err);
    }
    setTimeout(checkBans, 30000);
}

export { checkBans };