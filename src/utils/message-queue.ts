"use client"

import { useState, useEffect, useRef } from "react"

type QueuedMessage = {
    id: string
    content: string
    sessionId: string
    sendFunction: () => Promise<any>
    retries: number
}

const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds

export function useMessageQueue() {
    const [queue, setQueue] = useState<QueuedMessage[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const processingRef = useRef(false)

    // Process the queue
    const processQueue = async () => {
        if (processingRef.current || queue.length === 0) return

        processingRef.current = true
        setIsProcessing(true)

        const message = queue[0]

        try {
            await message.sendFunction()
            // Remove the message from the queue on success
            setQueue((prev) => prev.filter((m) => m.id !== message.id))
        } catch (error) {
            console.error(`Failed to send message (attempt ${message.retries + 1}):`, error)

            if (message.retries < MAX_RETRIES) {
                // Increment retry count and move to the end of the queue
                setQueue((prev) => [...prev.filter((m) => m.id !== message.id), { ...message, retries: message.retries + 1 }])

                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
            } else {
                // Remove from queue after max retries
                setQueue((prev) => prev.filter((m) => m.id !== message.id))
                console.error("Message failed after maximum retries:", message)
            }
        } finally {
            processingRef.current = false
            setIsProcessing(false)
        }
    }

    // Add a message to the queue
    const queueMessage = (id: string, content: string, sessionId: string, sendFunction: () => Promise<any>) => {
        setQueue((prev) => [...prev, { id, content, sessionId, sendFunction, retries: 0 }])
    }

    // Process queue whenever it changes
    useEffect(() => {
        if (queue.length > 0 && !processingRef.current) {
            processQueue()
        }
    }, [queue, isProcessing])

    return {
        queueMessage,
        isProcessing,
        queueLength: queue.length,
    }
}
