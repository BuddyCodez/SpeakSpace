"use client"
import React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { SmileIcon } from 'lucide-react';
import Picker from "@emoji-mart/react";
import data from '@emoji-mart/data';
interface EmojiPickerProps {
    onChange: (value: string) => void;
}
const EmojiPicker = ({ onChange }: EmojiPickerProps) => {
    return (
        <Popover>
            <PopoverTrigger>
                <SmileIcon
                    className='text-zinc-200 hover:text-zinc-300 cursor-pointer transition-colors duration-200 ease-in-out'
                    size={20} />
            </PopoverTrigger>
            <PopoverContent side='right' sideOffset={40}
                className='bg-transparent border-none shadow-none drop-shadow-sm mb-16'>
                <Picker
                    theme='light'
                    data={data}
                    onEmojiSelect={(emoji: { native: string }) => {
                        onChange(emoji.native)
                    }}
                />

            </PopoverContent>
        </Popover>
    )
}

export default EmojiPicker