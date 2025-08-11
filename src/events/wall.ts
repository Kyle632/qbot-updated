import { config } from '../config';
import { logAction } from '../handlers/handleLogging';
import { robloxClient } from '../main';

const checkWallForAds = async () => {
    setTimeout(checkWallForAds, 30000);
    try {
        const group = await robloxClient.getGroup(config.groupId);
        // TODO: Fix wall post methods for Noblox.js
        const posts = await (group as any).getWallPosts({ limit: 100, sortOrder: 'Desc' });
        posts.data?.forEach((post: any, index) => {
            setTimeout(async () => {
                if(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gm.test(post.body)) {
                    await (group as any).deleteWallPost(post.id);
                }
            }, 1000 * index);
        });
    } catch (err) {
        console.error(err);
    }
}

export { checkWallForAds };
