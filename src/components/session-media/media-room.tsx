"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2Icon } from "lucide-react";


interface MediaRoomProps {
    sessionId: string;
    roomName: string;
    username: string;
    video: boolean;
    audio: boolean;
    onDisconnect?: () => void;
}

export const MediaRoom = ({ roomName, sessionId, username, onDisconnect, video, audio }: MediaRoomProps) => {
    const [token, setToken] = useState<string>("");

    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch(`/api/token?room=${sessionId}&username=${username}`);
                const data = await resp.json();
                console.log("Token data:", data);
                setToken(data.token);
            } catch (error) {
                console.log("Error fetching token:", error);
            }
        })();
    }, [roomName, username, sessionId]);
    if (token == "") {
        return (
            <div className="flex flex-col flex-1 justify-center items-center">
                <Loader2Icon className="h-7 w-7 text-zinc-500 animate-spin my-4" size={32} />
                <p className="text-zinc-500 text-sm">Connecting to the {roomName} room...</p>
            </div>
        )
    }
    return (
        <LiveKitRoom
            data-lk-theme="light"
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            token={token}
            connect={true}
            video={video}
            audio={audio}
        >
            <VideoConference />
        </LiveKitRoom>
    )
};