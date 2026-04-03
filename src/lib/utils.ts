import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from "nanoid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)

export function generateId(): string {
  return nanoid()
}
