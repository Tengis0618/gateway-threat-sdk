export const Environment = {
    Sandbox: "sandbox",
    Production: 'production'
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment]
