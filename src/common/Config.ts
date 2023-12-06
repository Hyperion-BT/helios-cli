export type ExtraDatumTypes = {
    [spendingValidatorName: string]: {
        file: string
        typeName: string
    }[]
}

export type ConstDefinitions = {[name: string]: any}

type StageConfig = {
    isMainnet?: boolean // defaults to false
    exclude?: string[]
    include?: string[]
    define?: ConstDefinitions
}

export type Config = {
    stages: {
        [name: string]: StageConfig
    },
    extraDatumTypes?: ExtraDatumTypes
}

export const DEFAULT_CONFIG: Config = {stages: {main: {}}}