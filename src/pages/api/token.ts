import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { NextApiRequest, NextApiResponse } from 'next';

// Do not cache endpoint result
export const revalidate = 0;

export default async function GET(req: NextApiRequest, res: NextApiResponse) {
    const room: string = Array.isArray(req.query?.room) ? req.query.room[0] : (req.query?.room || '');
    const username: string = Array.isArray(req.query?.username) ? req.query.username[0] : (req.query?.username || '');
    if (!room) {
        return res.status(400).json({ error: 'Missing "room" query parameter' });
    } else if (!username) {
        return res.status(400).json({ error: 'Missing "username" query parameter' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return res.status(500).json({ error: 'Missing LiveKit credentials' });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: username  });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

    return res.status(200).json({
        token: await at.toJwt(),
        wsUrl,
    });
}

