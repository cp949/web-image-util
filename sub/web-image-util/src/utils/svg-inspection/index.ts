export { collectSvgCssReferenceSignals, type SvgCssReferenceSignals } from './css-signals.internal';
export { collectSvgDomSecuritySignals, type SvgDomSecuritySignals } from './dom-signals.internal';
export {
  isReferenceAttribute,
  readReferenceAttribute,
  type SvgInspectionPolicy,
  XLINK_NAMESPACE,
} from './reference-attribute.internal';
export { MAX_SAMPLE_LENGTH, MAX_SAMPLES_PER_STAGE, pushCappedSample } from './sample-utils.internal';
