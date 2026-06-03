export { collectSvgCssReferenceSignals, type SvgCssReferenceSignals } from './css-signals.internal';
export { collectSvgDomSecuritySignals, type SvgDomSecuritySignals } from './dom-signals.internal';
export { detectSvgInspectionEnvironment, type SvgInspectionEnvironment } from './environment.internal';
export type { SvgInspectionPolicy } from './policy';
export { isReferenceAttribute, readReferenceAttribute, XLINK_NAMESPACE } from './reference-attribute.internal';
export { MAX_SAMPLE_LENGTH, MAX_SAMPLES_PER_STAGE, pushCappedSample } from './sample-utils.internal';
