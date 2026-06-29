import { Types } from '@ohif/core';

export const DICOM_AI_LUMBAR_SPINE_MR_PROTOCOL_ID = 'dicomAiLumbarSpineMR';

const hydrateSegSyncGroup = {
  type: 'hydrateseg',
  id: 'sameFORId',
  source: true,
  target: true,
  options: {
    matchingRules: ['sameFOR'],
  },
} as const;

const imageDisplaySetRule = {
  attribute: 'numImageFrames',
  constraint: {
    greaterThan: { value: 0 },
  },
  required: true,
};

const dicomAiLumbarSpineMR: Types.HangingProtocol.Protocol = {
  id: DICOM_AI_LUMBAR_SPINE_MR_PROTOCOL_ID,
  locked: true,
  name: 'MRI Lumbar Spine 1x2',
  description: 'Sagittal T2 left, coronal preferred right with sagittal T1 fallback',
  createdDate: '2026-06-29',
  modifiedDate: '2026-06-29',
  availableTo: {},
  editableBy: {},
  protocolMatchingRules: [
    {
      id: 'DicomAiLumbarSpineMR',
      weight: 500,
      attribute: 'DicomAiHasLumbarDefaultViewSeries',
      constraint: {
        equals: {
          value: true,
        },
      },
      required: true,
    },
  ],
  toolGroupIds: ['default'],
  imageLoadStrategy: 'interleaveCenter',
  numberOfPriorsReferenced: 0,
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
      allowUnmatchedView: false,
      syncGroups: [hydrateSegSyncGroup],
    },
    displaySets: [],
  },
  displaySetSelectors: {
    sagT2DisplaySet: {
      seriesMatchingRules: [
        imageDisplaySetRule,
        {
          weight: 100,
          attribute: 'DicomAiLumbarSeriesRole',
          constraint: {
            equals: {
              value: 'sagT2',
            },
          },
          required: true,
        },
        {
          attribute: 'isDisplaySetFromUrl',
          weight: 10,
          constraint: {
            equals: true,
          },
        },
      ],
    },
    rightDisplaySet: {
      seriesMatchingRules: [
        imageDisplaySetRule,
        {
          weight: 50,
          attribute: 'DicomAiLumbarRightCandidate',
          constraint: {
            equals: {
              value: true,
            },
          },
          required: true,
        },
        {
          weight: 100,
          attribute: 'DicomAiLumbarSeriesRole',
          constraint: {
            equals: {
              value: 'coronal',
            },
          },
        },
        {
          weight: 25,
          attribute: 'DicomAiLumbarSeriesRole',
          constraint: {
            equals: {
              value: 'sagT1',
            },
          },
        },
      ],
    },
  },
  stages: [
    {
      id: 'sagT2CoronalOrSagT1',
      name: 'Sag T2 + Cor/T1',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportId: 'lumbarSagT2',
            viewportType: 'stack',
            toolGroupId: 'default',
            initialImageOptions: {
              preset: 'middle',
            },
            syncGroups: [hydrateSegSyncGroup],
          },
          displaySets: [
            {
              id: 'sagT2DisplaySet',
            },
          ],
        },
        {
          viewportOptions: {
            viewportId: 'lumbarCoronalOrSagT1',
            viewportType: 'stack',
            toolGroupId: 'default',
            initialImageOptions: {
              preset: 'middle',
            },
          },
          displaySets: [
            {
              id: 'rightDisplaySet',
            },
          ],
        },
      ],
    },
  ],
};

export default dicomAiLumbarSpineMR;
