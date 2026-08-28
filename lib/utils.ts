import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserFriendlyErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again."
): string {
  if (!error) return fallback;

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    message = String((error as { message: unknown }).message);
  }

  if (!message) return fallback;

  const isDbError =
    message.includes("Failed query:") ||
    message.includes("file_keys") ||
    message.includes("select \"") ||
    message.includes("insert into") ||
    message.includes("update \"") ||
    message.includes("delete from") ||
    /WHERE\s+\(/i.test(message) ||
    /params:\s+/i.test(message);

  if (isDbError) {
    return fallback;
  }

  return message;
}

