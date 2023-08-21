export type Config = {
    stages: {
        [name: string]: {
            exclude?: string[]
            include?: string[]
        }
    },
    extraDatumTypes?: {
        [spendingValidatorName: string]: {
            file: string
            typeName: string
        }[]
    }
}

export const DEFAULT_CONFIG: Config = {stages: {main: {}}}