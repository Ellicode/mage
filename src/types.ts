export type IconType = "lucide-icon" | string;

export interface Icon {
    type: IconType;
    name: string;
    color: string;
}

export type IntentType = "menu" | "widget" | string;

export interface Intent {
    application?: Application;

    name: string;
    type: IntentType;
    description: string;
    src: string;
    intentScheme: string;
    aliases: string[];
}

export interface Application {
    name: string;
    description: string;
    version: string;
    author: string;
    appScheme: string;
    icon: Icon;
    intents: Intent[];
}
