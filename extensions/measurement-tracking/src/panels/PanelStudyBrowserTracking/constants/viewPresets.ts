import type { viewPreset } from '../PanelStudyBrowserTracking/types/viewPreset';

const defaultViewPresets = [
  {
    id: 'list',
    iconName: 'ListView',
    selected: true,
  },
  {
    id: 'thumbnails',
    iconName: 'ThumbnailView',
    selected: false,
  },
] as viewPreset[];

export { defaultViewPresets };
