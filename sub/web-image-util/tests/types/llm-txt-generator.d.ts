declare module '../../../scripts/llm-txt-generator.mjs' {
  export interface LlmTxtModuleInput {
    modulePath: string;
    moduleSpecifier: string;
    sourceText: string;
    keySymbols: string[];
  }

  export interface RenderLlmTxtInput {
    packageName: string;
    readmeText: string;
    modules: LlmTxtModuleInput[];
  }

  export function renderLlmTxt(input: RenderLlmTxtInput): string;
}
