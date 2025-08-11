import { robloxClient } from '../main';
import { config } from '../config';
import { getLinkedRobloxUser } from './accountLinks';

const checkActionEligibility = async (discordId: string, guildId: string, targetMember: any, rankingTo: number): Promise<boolean>  => {
    let robloxUser: any;
    try {
        robloxUser = await getLinkedRobloxUser(discordId);
    } catch (err) {
        return false;
    }

    let robloxMemberRank: number;
    try {
        robloxMemberRank = await robloxClient.getRankInGroup(config.groupId, robloxUser.userId);
        if(robloxMemberRank === 0) throw new Error();
    } catch (err) {
        return false;
    }

    if(robloxMemberRank <= targetMember.role.rank) return false;
    if(robloxMemberRank <= rankingTo) return false;
    if(robloxUser.userId === targetMember.userId) return false;
    return true;
}

export { checkActionEligibility };