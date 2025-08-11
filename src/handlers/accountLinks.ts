import { config } from '../config';
import { robloxClient } from '../main';
import { BloxlinkResponse } from '../structures/types';
import axios from 'axios';
require('dotenv').config();
let requestCount = 0;

const getLinkedRobloxUser = async (discordId: string) => {
    if(requestCount >= 60) return null;
    requestCount += 1;
    
    try {
        const robloxStatus: BloxlinkResponse = (await axios.get(`https://api.blox.link/v4/public/guilds/${config.bloxlinkGuildId}/discord-to-roblox/${discordId}`, { headers: { 'Authorization': process.env.BLOXLINK_KEY } })).data;
        if(robloxStatus.error) throw new Error(robloxStatus.error);
    
        const userId = parseInt(robloxStatus.robloxID);
        const username = await robloxClient.getUsernameFromId(userId);
        return { userId: userId, username: username };
    } catch (err) { return null };
}

const refreshRateLimits = () => {
    requestCount = 0;
    setTimeout(refreshRateLimits, 60000);
}
setTimeout(refreshRateLimits, 60000);

export { getLinkedRobloxUser };