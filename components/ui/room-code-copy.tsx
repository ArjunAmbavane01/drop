"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

interface RoomCodeCopyProps {
    code: string;
    className?: string;
}

export function RoomCodeCopy({ code, className = "" }: RoomCodeCopyProps) {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(code);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 mt-1 text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded transition-colors hover:bg-muted/80 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${className}`}
        >
            <span>{code}</span>
            <motion.div
                animate={isCopied ? { scale: 1 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
                key={isCopied ? "check" : "copy"}
            >
                {isCopied ? (
                    <motion.div
                        initial={{ scale: 0.5, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0.5, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Check className="size-4 text-green-500" />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ scale: 1 }}
                        animate={{ scale: 1 }}
                    >
                        <Copy className="size-4" />
                    </motion.div>
                )}
            </motion.div>
        </button>
    );
}