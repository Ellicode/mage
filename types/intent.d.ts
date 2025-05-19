export interface Intent {
    name: string;
    type: string;
    description: string;
    src?: string;
    intentScheme?: string;
    aliases?: string[];
    regexPatterns?: string[]; // Array of regex patterns for more advanced matching
    appPath?: string;
    application?: {
        name: string;
        icon: {
            type: string;
            value?: string;
            name?: string;
            color?: string;
        };
        appScheme: string;
        description?: string;
        version?: string;
        author?: string;
    };
}

export interface AppManifest {
    name: string;
    description: string;
    version: string;
    author: string;
    appScheme: string;
    icon: {
        type: string;
        name?: string;
        value?: string;
        color?: string;
    };
    intents: Intent[];
}
