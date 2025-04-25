"use client"

import { Check } from 'lucide-react'
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error"

interface MessageStatusProps {
    status: MessageStatus
    className?: string
}

export function MessageStatus({ status, className }: MessageStatusProps) {
    if (status === "error") {
        return (
            <span className={cn("text-red-500 text-xs flex items-center", className)}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Error
            </span>
        )
    }

    return (
        <div className={cn("flex items-center", className)}>
            {status === "sending" && (
                <motion.div
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    <Check size={16} className="text-blue-100" />
                </motion.div>
            )}

            {status === "sent" && (
                <div className="flex">
                    <Check size={16} className="text-blue-100" />
                </div>
            )}

            {status === "delivered" && (
                <div className="flex">
                    <Check size={16} className="text-blue-100" />
                    <Check size={16} className="-ml-2 text-blue-100" />
                </div>
            )}

            {status === "read" && (
                <div className="flex">
                    <Check size={16} className="text-blue-300" />
                    <Check size={16} className="-ml-2 text-blue-300" />
                </div>
            )}
        </div>
    )
}
