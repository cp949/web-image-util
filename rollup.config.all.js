import { createRollupConfig } from './rollup.config.base'

export default ['es', 'cjs'].map((it) => createRollupConfig(it))
