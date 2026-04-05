import { dark } from "@clerk/themes"

/**
 * Clerk's `baseTheme: dark` alone can still render a light UserButton popover in some setups.
 * We set variables + `elements` overrides so the menu matches the app shell.
 *
 * Tailwind: use literal arbitrary color classes so they are included in the build.
 */
export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "oklch(0.6 0.23 300)",
    colorBackground: "oklch(0.17 0 0)",
    colorForeground: "oklch(0.97 0 0)",
    colorText: "oklch(0.97 0 0)",
    colorTextSecondary: "oklch(0.62 0 0)",
    colorInputBackground: "oklch(0.17 0 0)",
    /** Digits in email/SMS code fields — must contrast with input background (Clerk OTP can inherit poorly on dark). */
    colorInputForeground: "oklch(0.99 0 0)",
    colorNeutral: "oklch(0.62 0 0)",
    borderRadius: "0.75rem",
  },
  elements: {
    userButtonPopoverCard:
      "!bg-[oklch(0.17_0_0)] !border !border-[oklch(0.25_0_0)] !text-[oklch(0.97_0_0)] !shadow-2xl",
    userButtonPopoverMain: "!bg-[oklch(0.17_0_0)]",
    userButtonPopoverActions: "!bg-[oklch(0.17_0_0)]",
    userButtonPopoverFooter:
      "!bg-[oklch(0.14_0_0)] !border-t !border-[oklch(0.25_0_0)]",
    userButtonPopoverActionButton:
      "!text-[oklch(0.97_0_0)] hover:!bg-white/10",
    userButtonPopoverActionButtonIconBox: "!text-[oklch(0.62_0_0)]",
    userButtonPopoverActionButtonIcon: "!text-[oklch(0.62_0_0)]",
    userPreview: "!bg-[oklch(0.17_0_0)]",
    userPreviewMainIdentifierText: "!text-[oklch(0.97_0_0)]",
    userPreviewSecondaryIdentifier: "!text-[oklch(0.62_0_0)]",
    userButtonPopoverRootBox: "!text-[oklch(0.97_0_0)]",
    formFieldInput:
      "!bg-[oklch(0.17_0_0)] !text-[oklch(0.99_0_0)] !caret-[oklch(0.99_0_0)] placeholder:!text-[oklch(0.55_0_0)] !border-[oklch(0.38_0_0)]",
    otpCodeFieldInput:
      "!bg-[oklch(0.14_0_0)] !text-[oklch(0.99_0_0)] !caret-[oklch(0.99_0_0)] !border-2 !border-[oklch(0.42_0_0)] !font-semibold !text-lg",
    otpCodeFieldInputContainer: "!gap-2",
  },
}
