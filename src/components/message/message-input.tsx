"use client"

import React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Paperclip, PlusIcon } from "lucide-react"
import { trpc } from "@/utils/trpc"
import { useSession } from "next-auth/react"

// Import the message queue
import { useMessageQueue } from "@/utils/message-queue"
import { UploadButton, UploadDropzone } from "@/utils/uploadthing"
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@radix-ui/react-dialog"
import EmojiPicker from "./emoji-picker"

interface MessageInputProps {
    sessionId: string
    onMessageSent: (optimisticMessage?: any) => void
    disabled?: boolean
}

export function MessageInput({ sessionId, onMessageSent, disabled }: MessageInputProps) {
    const { data: session } = useSession()
    const [messageText, setMessageText] = useState("")
    const [enterToPost, setEnterToPost] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [DropzoneOpen, setDropzoneOpen] = useState(false)

    // Typing indicator mutation
    const isTypingMutation = trpc.message.isTyping.useMutation()

    // Send message mutation
    const sendMessageMutation = trpc.message.send.useMutation({
        onSuccess: () => {
            setMessageText("")
            setIsSending(false)
            // onMessageSent() // No longer needed because of optimistic updates

            // Focus back on input after sending
            setTimeout(() => {
                inputRef.current?.focus()
            }, 0)
        },
        onError: (error) => {
            setIsSending(false)
            console.error("Failed to send message:", error)
        },
    })

    // Add the message queue to the component
    const { queueMessage } = useMessageQueue()

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsSending(true)
        const reader = new FileReader()
        reader.onload = async (event) => {
            if (event.target?.result) {
                const fileData = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: event.target.result.toString().split(",")[1],
                }

                sendMessageMutation.mutate({
                    sessionId,
                    mediaFile: fileData,
                    mediaType: file.type,
                })
            }
        }
        reader.readAsDataURL(file)
    }

    // Send message handler with optimistic updates
    const sendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        if (!messageText.trim() || disabled) return

        const tempMessage = messageText.trim()
        const tempId = `temp-${Date.now()}`

        // Clear input immediately for better UX
        setMessageText("")

        // Create optimistic message
        const optimisticMessage = {
            id: tempId,
            content: tempMessage,
            mediaUrl: null,
            mediaType: null,
            senderId: session?.user?.id || "",
            sessionId,
            createdAt: new Date(),
            sender: {
                id: session?.user?.id || "",
                username: session?.user?.name || "You",
                imageUrl: session?.user?.image || null,
            },
        }

        // Notify that user stopped typing
        isTypingMutation.mutate({ sessionId, typing: false })

        // Add optimistic message to UI immediately
        onMessageSent(optimisticMessage)

        // Focus back on input after sending
        setTimeout(() => {
            inputRef.current?.focus()
        }, 0)

        // Queue the message for sending
        queueMessage(tempId, tempMessage, sessionId, async () => {
            setIsSending(true)
            try {
                await sendMessageMutation.mutateAsync({
                    sessionId,
                    content: tempMessage,
                })
                return true
            } finally {
                setIsSending(false)
            }
        })
    }

    // Handle typing indicator
    const handleTyping = () => {
        if (messageText.trim().length > 0) {
            isTypingMutation.mutate({ sessionId, typing: true })
        } else {
            isTypingMutation.mutate({ sessionId, typing: false })
        }
    }

    // Set up debounced typing indicator
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            handleTyping()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [messageText])

    // Clean up typing indicator when component unmounts
    useEffect(() => {
        return () => {
            isTypingMutation.mutate({ sessionId, typing: false })
        }
    }, [])

    if (!session?.user) {
        return null
    }

    return (
        <React.Fragment>
            <Dialog open={DropzoneOpen} onOpenChange={() => setDropzoneOpen(!DropzoneOpen)}>
                <DialogContent className="bg-muted/50">
                    <UploadDropzone
                        endpoint="imageUploader"
                        onUploadError={(error) => {
                            console.log("Upload error:", error)
                        }
                        }
                    />
                </DialogContent>
            </Dialog>
            <form onSubmit={sendMessage} className="flex items-center gap-2 border-t-[2px] p-4">


                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => setDropzoneOpen(true)}
                    // disabled={isSending || disabled}
                    className="text-zinc-200 hover:text-zinc-300 cursor-pointer transition-colors duration-200 ease-in-out rounded-full"
                >
                    <PlusIcon className="h-5 w-5" />
                </Button>
                <div className="flex-1 relative">
                    <Input
                        ref={inputRef}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-muted/50 rounded-2xl focus:border-none"
                        style={{
                            border: "none",
                        }}
                        // disabled={isSending || disabled}
                        onKeyDown={(e) => {
                            if (e.key === "Shift") {
                                setEnterToPost(false)
                            }
                            if (e.key === "Enter" && enterToPost && !e.shiftKey) {
                                void sendMessage();
                            }
                        }}
                        onKeyUp={(e) => {
                            if (e.key === "Shift") {
                                setEnterToPost(true)
                            }
                        }}
                    />
                </div>
                <EmojiPicker
                    onChange={(value) => {
                        setMessageText((prev) => prev + value)
                        inputRef.current?.focus()
                    }}
                />
            </form>
        </React.Fragment>
    )
}
