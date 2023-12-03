export type ExtraDatumTypes = {
    [spendingValidatorName: string]: {
        file: string
        typeName: string
    }[]
}

export type ConstDefinitions = {[name: string]: any}

export type Config = {
    stages: {
        [name: string]: {
            exclude?: string[]
            include?: string[]
            define?: ConstDefinitions
        }
    },
    extraDatumTypes?: ExtraDatumTypes
}

export const DEFAULT_CONFIG: Config = {stages: {main: {}}}