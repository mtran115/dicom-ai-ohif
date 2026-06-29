import viewCode from './viewCode';
import laterality from './laterality';
import {
  dicomAiHasLumbarDefaultViewSeries,
  dicomAiIsLumbarSpineMR,
  dicomAiLumbarRightCandidate,
  dicomAiLumbarSeriesRole,
} from './dicomAiLumbarAttributes';

export default function registerHangingProtocolAttributes({ servicesManager }) {
  const { hangingProtocolService } = servicesManager.services;
  hangingProtocolService.addCustomAttribute('ViewCode', 'View Code Designator:Value', viewCode);
  hangingProtocolService.addCustomAttribute('Laterality', 'Laterality of object', laterality);
  hangingProtocolService.addCustomAttribute(
    'DicomAiIsLumbarSpineMR',
    'DICOM AI lumbar spine MR study',
    dicomAiIsLumbarSpineMR
  );
  hangingProtocolService.addCustomAttribute(
    'DicomAiHasLumbarDefaultViewSeries',
    'DICOM AI lumbar default view series availability',
    dicomAiHasLumbarDefaultViewSeries
  );
  hangingProtocolService.addCustomAttribute(
    'DicomAiLumbarSeriesRole',
    'DICOM AI lumbar series role',
    dicomAiLumbarSeriesRole
  );
  hangingProtocolService.addCustomAttribute(
    'DicomAiLumbarRightCandidate',
    'DICOM AI lumbar right viewport candidate',
    dicomAiLumbarRightCandidate
  );
}
