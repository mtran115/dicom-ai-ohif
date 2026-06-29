const LUMBAR_PATTERN = /\b(lumbar|l[\s-]?spine|ls[\s-]?spine|lumbosacral)\b/i;
const SAGITTAL_PATTERN = /\b(sag|sagittal)\b/i;
const CORONAL_PATTERN = /\b(cor|coronal)\b/i;
const T1_PATTERN = /\bt1\b|t1w/i;
const T2_PATTERN = /\bt2\b|t2w/i;
const LOCALIZER_PATTERN = /\b(localizer|locator|scout|scano|survey)\b/i;

function normalizeText(value): string {
  return String(value ?? '')
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromMetadata(metadata: any): string {
  const firstImage = metadata?.images?.[0] ?? metadata?.instances?.[0] ?? {};

  return [
    metadata?.StudyDescription,
    metadata?.RequestedProcedureDescription,
    metadata?.BodyPartExamined,
    metadata?.SeriesDescription,
    metadata?.ProtocolName,
    metadata?.Modality,
    firstImage?.StudyDescription,
    firstImage?.SeriesDescription,
    firstImage?.ProtocolName,
    firstImage?.BodyPartExamined,
    firstImage?.Modality,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function hasMRModality(metadata: any, displaySets: any[] = []): boolean {
  const modalities = [
    metadata?.Modality,
    ...(Array.isArray(metadata?.ModalitiesInStudy) ? metadata.ModalitiesInStudy : []),
    ...displaySets.map(displaySet => displaySet?.Modality),
  ]
    .map(value => String(value ?? '').toUpperCase())
    .filter(Boolean);

  return modalities.includes('MR');
}

export function dicomAiLumbarSeriesRole(displaySet: any): 'sagT2' | 'coronal' | 'sagT1' | null {
  if (String(displaySet?.Modality ?? '').toUpperCase() !== 'MR') {
    return null;
  }

  const text = textFromMetadata(displaySet);
  if (!text || LOCALIZER_PATTERN.test(text)) {
    return null;
  }

  if (CORONAL_PATTERN.test(text)) {
    return 'coronal';
  }

  if (SAGITTAL_PATTERN.test(text) && T2_PATTERN.test(text)) {
    return 'sagT2';
  }

  if (SAGITTAL_PATTERN.test(text) && T1_PATTERN.test(text)) {
    return 'sagT1';
  }

  return null;
}

export function dicomAiLumbarRightCandidate(displaySet: any): boolean {
  const role = dicomAiLumbarSeriesRole(displaySet);
  return role === 'coronal' || role === 'sagT1';
}

export function dicomAiIsLumbarSpineMR(metadata: any, options: any = {}): boolean {
  const displaySets = options?.displaySets ?? options?.allDisplaySets ?? [];
  const studyText = [
    textFromMetadata(metadata),
    ...displaySets.map(displaySet => textFromMetadata(displaySet)),
  ].join(' ');

  return hasMRModality(metadata, displaySets) && LUMBAR_PATTERN.test(studyText);
}

export function dicomAiHasLumbarDefaultViewSeries(metadata: any, options: any = {}): boolean {
  const displaySets = options?.displaySets ?? options?.allDisplaySets ?? [];
  if (!dicomAiIsLumbarSpineMR(metadata, options)) {
    return false;
  }

  const roles = displaySets.map(displaySet => dicomAiLumbarSeriesRole(displaySet));
  return roles.includes('sagT2') && (roles.includes('coronal') || roles.includes('sagT1'));
}
