import React, { useEffect } from 'react';
import html2canvas from 'html2canvas';
import {
  Enums,
  getEnabledElement,
  getOrCreateCanvas,
  StackViewport,
  BaseVolumeViewport,
  metaData,
} from '@cornerstonejs/core';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { ViewportDownloadForm } from '@ohif/ui';

import { getEnabledElement as OHIFgetEnabledElement } from '../state';

const MINIMUM_SIZE = 100;
const DEFAULT_SIZE = 512;
const MAX_TEXTURE_SIZE = 10000;
const VIEWPORT_ID = 'cornerstone-viewport-download-form';

const WORKBENCH_CAPTURE_SOURCE = 'ohif-native-camera';

function getWorkbenchConfig() {
  return (window as any).config?.dicomAiWorkbench ?? {};
}

function isWorkbenchCaptureEnabled() {
  return getWorkbenchConfig()?.keyImageCapture?.enabled !== false;
}

function getWorkbenchApiBaseUrl() {
  const configuredUrl = getWorkbenchConfig()?.apiBaseUrl;
  return typeof configuredUrl === 'string' && configuredUrl.length
    ? configuredUrl.replace(/\/$/, '')
    : window.location.origin;
}

function getWorkbenchAccessToken() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || window.sessionStorage?.getItem('dicomAiWorkbenchAccessToken');
  } catch {
    return null;
  }
}

function getStudyInstanceUid() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('StudyInstanceUIDs') ||
    params.get('studyInstanceUID') ||
    params.get('StudyInstanceUID')
  );
}

function getFileTypeValue(fileType) {
  return Array.isArray(fileType) ? fileType[0] : fileType;
}

function getImageMimeType(fileType) {
  const fileTypeValue = getFileTypeValue(fileType);
  return fileTypeValue === 'jpg' ? 'image/jpeg' : `image/${fileTypeValue}`;
}

function getActiveDisplaySet(displaySetService, cornerstoneViewportService, viewportId) {
  const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
  const viewportData = viewportInfo?.getViewportData?.();
  const viewportDataItems = Array.isArray(viewportData?.data)
    ? viewportData.data
    : [viewportData?.data];
  const displaySetInstanceUID = viewportDataItems.find(Boolean)?.displaySetInstanceUID;

  return displaySetInstanceUID
    ? displaySetService?.getDisplaySetByUID(displaySetInstanceUID)
    : null;
}

function getNumberValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function getCaptureMetadata({
  activeViewport,
  activeViewportId,
  cornerstoneViewportService,
  displaySetService,
}) {
  const displaySet = getActiveDisplaySet(
    displaySetService,
    cornerstoneViewportService,
    activeViewportId
  );
  const imageId = activeViewport.getCurrentImageId?.();
  const imageIndex = getNumberValue(activeViewport.getCurrentImageIdIndex?.());
  const numberOfSlices = getNumberValue(activeViewport.getNumberOfSlices?.());
  const generalImageModule = imageId ? metaData.get('generalImageModule', imageId) || {} : {};
  const instanceNumber = getNumberValue(generalImageModule.instanceNumber);

  return {
    series_number: getNumberValue(displaySet?.SeriesNumber ?? displaySet?.seriesNumber),
    series_description: displaySet?.SeriesDescription ?? displaySet?.seriesDescription ?? null,
    instance_number: instanceNumber,
    image_index:
      typeof imageIndex === 'number'
        ? imageIndex + 1
        : imageIndex,
    number_of_slices: numberOfSlices,
  };
}

function formatSeriesLabel(metadata) {
  const { series_number: seriesNumber, series_description: seriesDescription } = metadata;
  const labelParts = [];

  if (seriesNumber !== null && seriesNumber !== undefined) {
    labelParts.push(`S:${seriesNumber}`);
  }

  if (seriesDescription) {
    labelParts.push(seriesDescription);
  }

  return labelParts.join(' ');
}

function formatImageLabel(metadata) {
  const {
    instance_number: instanceNumber,
    image_index: imageIndex,
    number_of_slices: numberOfSlices,
  } = metadata;

  const imagePosition =
    imageIndex !== null &&
    imageIndex !== undefined &&
    numberOfSlices !== null &&
    numberOfSlices !== undefined
      ? `(${imageIndex}/${numberOfSlices})`
      : null;

  if (instanceNumber !== null && instanceNumber !== undefined) {
    return imagePosition ? `I:${instanceNumber} ${imagePosition}` : `I:${instanceNumber}`;
  }

  return imagePosition || '';
}

function truncateText(ctx, text, maxWidth) {
  if (!text || ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '...';
  let truncated = text;

  while (truncated.length > 0 && ctx.measureText(`${truncated}${ellipsis}`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}${ellipsis}`;
}

function addMetadataFooter(canvas, metadata) {
  const seriesLabel = formatSeriesLabel(metadata);
  const imageLabel = formatImageLabel(metadata);

  if (!seriesLabel && !imageLabel) {
    return canvas;
  }

  const footerCanvas = document.createElement('canvas');
  footerCanvas.width = canvas.width;
  footerCanvas.height = canvas.height;

  const ctx = footerCanvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  ctx.drawImage(canvas, 0, 0);

  const scale = Math.max(1, canvas.width / 1024);
  const fontSize = Math.round(18 * scale);
  const padding = Math.round(12 * scale);
  const footerHeight = fontSize + padding * 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, canvas.height - footerHeight, canvas.width, footerHeight);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  const y = canvas.height - footerHeight / 2;
  const rightWidth = imageLabel ? ctx.measureText(imageLabel).width : 0;
  const leftMaxWidth = Math.max(0, canvas.width - padding * 3 - rightWidth);

  if (seriesLabel) {
    ctx.textAlign = 'left';
    ctx.fillText(truncateText(ctx, seriesLabel, leftMaxWidth), padding, y);
  }

  if (imageLabel) {
    ctx.textAlign = 'right';
    ctx.fillText(imageLabel, canvas.width - padding, y);
  }

  return footerCanvas;
}

const CornerstoneViewportDownloadForm = ({
  onClose,
  activeViewportId: activeViewportIdProp,
  cornerstoneViewportService,
  displaySetService,
  uiNotificationService,
}: withAppTypes) => {
  const enabledElement = OHIFgetEnabledElement(activeViewportIdProp);
  const activeViewportElement = enabledElement?.element;
  const activeViewportEnabledElement = getEnabledElement(activeViewportElement);

  const {
    viewportId: activeViewportId,
    renderingEngineId,
    viewport: activeViewport,
  } = activeViewportEnabledElement;

  const toolGroup = ToolGroupManager.getToolGroupForViewport(activeViewportId, renderingEngineId);

  const toolModeAndBindings = Object.keys(toolGroup.toolOptions).reduce((acc, toolName) => {
    const tool = toolGroup.toolOptions[toolName];
    const { mode, bindings } = tool;

    return {
      ...acc,
      [toolName]: {
        mode,
        bindings,
      },
    };
  }, {});

  useEffect(() => {
    return () => {
      Object.keys(toolModeAndBindings).forEach(toolName => {
        const { mode, bindings } = toolModeAndBindings[toolName];
        toolGroup.setToolMode(toolName, mode, { bindings });
      });
    };
  }, []);

  const enableViewport = viewportElement => {
    if (viewportElement) {
      const { renderingEngine, viewport } = getEnabledElement(activeViewportElement);

      const viewportInput = {
        viewportId: VIEWPORT_ID,
        element: viewportElement,
        type: viewport.type,
        defaultOptions: {
          background: viewport.defaultOptions.background,
          orientation: viewport.defaultOptions.orientation,
        },
      };

      renderingEngine.enableElement(viewportInput);
    }
  };

  const disableViewport = viewportElement => {
    if (viewportElement) {
      const { renderingEngine } = getEnabledElement(viewportElement);
      return new Promise(resolve => {
        renderingEngine.disableElement(VIEWPORT_ID);
      });
    }
  };

  const updateViewportPreview = (downloadViewportElement, internalCanvas, fileType) =>
    new Promise(resolve => {
      const enabledElement = getEnabledElement(downloadViewportElement);

      const { viewport: downloadViewport, renderingEngine } = enabledElement;

      // Note: Since any trigger of dimensions will update the viewport,
      // we need to resize the offScreenCanvas to accommodate for the new
      // dimensions, this is due to the reason that we are using the GPU offScreenCanvas
      // to render the viewport for the downloadViewport.
      renderingEngine.resize();

      // Trigger the render on the viewport to update the on screen
      // downloadViewport.resetCamera();
      downloadViewport.render();

      downloadViewportElement.addEventListener(
        Enums.Events.IMAGE_RENDERED,
        function updateViewport(event) {
          const enabledElement = getEnabledElement(event.target);
          const { viewport } = enabledElement;
          const { element } = viewport;

          const downloadCanvas = getOrCreateCanvas(element);

          const type = 'image/' + fileType;
          const dataUrl = downloadCanvas.toDataURL(type, 1);

          let newWidth = element.offsetHeight;
          let newHeight = element.offsetWidth;

          if (newWidth > DEFAULT_SIZE || newHeight > DEFAULT_SIZE) {
            const multiplier = DEFAULT_SIZE / Math.max(newWidth, newHeight);
            newHeight *= multiplier;
            newWidth *= multiplier;
          }

          resolve({ dataUrl, width: newWidth, height: newHeight });

          downloadViewportElement.removeEventListener(Enums.Events.IMAGE_RENDERED, updateViewport);

          // for some reason we need a reset camera here, and I don't know why
          downloadViewport.resetCamera();
          const presentation = activeViewport.getViewPresentation();
          if (downloadViewport.setView) {
            downloadViewport.setView(activeViewport.getViewReference(), presentation);
          }
          downloadViewport.render();
        }
      );
    });

  const loadImage = (activeViewportElement, viewportElement, width, height) =>
    new Promise(resolve => {
      if (activeViewportElement && viewportElement) {
        const activeViewportEnabledElement = getEnabledElement(activeViewportElement);

        if (!activeViewportEnabledElement) {
          return;
        }

        const { viewport } = activeViewportEnabledElement;

        const renderingEngine = cornerstoneViewportService.getRenderingEngine();
        const downloadViewport = renderingEngine.getViewport(VIEWPORT_ID);

        if (downloadViewport instanceof StackViewport) {
          const imageId = viewport.getCurrentImageId();
          const properties = viewport.getProperties();

          downloadViewport.setStack([imageId]).then(() => {
            try {
              downloadViewport.setProperties(properties);
              const newWidth = Math.min(width || image.width, MAX_TEXTURE_SIZE);
              const newHeight = Math.min(height || image.height, MAX_TEXTURE_SIZE);

              resolve({ width: newWidth, height: newHeight });
            } catch (e) {
              // Happens on clicking the cancel button
              console.warn('Unable to set properties', e);
            }
          });
        } else if (downloadViewport instanceof BaseVolumeViewport) {
          const actors = viewport.getActors();
          // downloadViewport.setActors(actors);
          actors.forEach(actor => {
            downloadViewport.addActor(actor);
          });

          downloadViewport.render();

          const newWidth = Math.min(width || image.width, MAX_TEXTURE_SIZE);
          const newHeight = Math.min(height || image.height, MAX_TEXTURE_SIZE);

          resolve({ width: newWidth, height: newHeight });
        }
      }
    });

  const toggleAnnotations = (toggle, viewportElement, activeViewportElement) => {
    const activeViewportEnabledElement = getEnabledElement(activeViewportElement);

    const downloadViewportElement = getEnabledElement(viewportElement);

    const { viewportId: activeViewportId, renderingEngineId } = activeViewportEnabledElement;
    const { viewportId: downloadViewportId } = downloadViewportElement;

    if (!activeViewportEnabledElement || !downloadViewportElement) {
      return;
    }

    const toolGroup = ToolGroupManager.getToolGroupForViewport(activeViewportId, renderingEngineId);

    // add the viewport to the toolGroup
    toolGroup.addViewport(downloadViewportId, renderingEngineId);

    Object.keys(toolGroup.getToolInstances()).forEach(toolName => {
      // make all tools Enabled so that they can not be interacted with
      // in the download viewport
      if (toggle && toolName !== 'Crosshairs') {
        try {
          toolGroup.setToolEnabled(toolName);
        } catch (e) {
          console.log(e);
        }
      } else {
        toolGroup.setToolDisabled(toolName);
      }
    });
  };

  const downloadCanvas = (canvas, filename, fileType) => {
    const fileTypeValue = getFileTypeValue(fileType);
    const file = `${filename}.${fileTypeValue}`;
    const link = document.createElement('a');
    link.download = file;
    link.href = canvas.toDataURL(getImageMimeType(fileType), 1.0);
    link.click();
  };

  const uploadCanvasToWorkbench = (canvas, filename, fileType, captureMetadata) =>
    new Promise<void>((resolve, reject) => {
      const studyInstanceUid = getStudyInstanceUid();
      if (!studyInstanceUid) {
        reject(new Error('No StudyInstanceUIDs parameter was found for this viewer session.'));
        return;
      }

      canvas.toBlob(
        async blob => {
          if (!blob) {
            reject(new Error('Unable to render the key image screenshot.'));
            return;
          }

          try {
            const accessToken = getWorkbenchAccessToken();
            const formData = new FormData();
            const fileTypeValue = getFileTypeValue(fileType);
            formData.append('file', blob, `${filename}.${fileTypeValue}`);
            formData.append(
              'source_json',
              JSON.stringify({
                source: WORKBENCH_CAPTURE_SOURCE,
                file_type: fileTypeValue,
                filename,
                viewport_id: activeViewportId,
                ...captureMetadata,
                captured_at: new Date().toISOString(),
                viewer_url: window.location.href,
              })
            );

            const response = await fetch(
              `${getWorkbenchApiBaseUrl()}/studies/by-uid/${encodeURIComponent(
                studyInstanceUid
              )}/key-image-screenshots`,
              {
                method: 'POST',
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                body: formData,
              }
            );

            if (!response.ok) {
              throw new Error(`Workbench returned ${response.status}`);
            }

            window.parent?.postMessage(
              { type: 'dicom-ai:key-image-saved', studyInstanceUid },
              '*'
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        getImageMimeType(fileType),
        1.0
      );
    });

  const downloadBlob = (filename, fileType) => {
    const divForDownloadViewport = document.querySelector(
      `div[data-viewport-uid="${VIEWPORT_ID}"]`
    );

    html2canvas(divForDownloadViewport).then(async canvas => {
      const captureMetadata = getCaptureMetadata({
        activeViewport,
        activeViewportId,
        cornerstoneViewportService,
        displaySetService,
      });
      const canvasWithFooter = addMetadataFooter(canvas, captureMetadata);

      if (!isWorkbenchCaptureEnabled()) {
        downloadCanvas(canvasWithFooter, filename, fileType);
        return;
      }

      try {
        await uploadCanvasToWorkbench(canvasWithFooter, filename, fileType, captureMetadata);
        uiNotificationService?.show({
          title: 'Key image saved',
          message: 'Annotated screenshot saved to Workbench.',
          type: 'success',
        });
        onClose?.();
      } catch (error) {
        uiNotificationService?.show({
          title: 'Key image not saved',
          message: error instanceof Error ? error.message : 'Unable to save key image.',
          type: 'error',
        });
      }
    });
  };

  return (
    <ViewportDownloadForm
      onClose={onClose}
      minimumSize={MINIMUM_SIZE}
      maximumSize={MAX_TEXTURE_SIZE}
      defaultSize={DEFAULT_SIZE}
      activeViewportElement={activeViewportElement}
      enableViewport={enableViewport}
      disableViewport={disableViewport}
      updateViewportPreview={updateViewportPreview}
      loadImage={loadImage}
      toggleAnnotations={toggleAnnotations}
      submitLabel={isWorkbenchCaptureEnabled() ? 'Save to Workbench' : 'Download'}
      downloadBlob={downloadBlob}
    />
  );
};

export default CornerstoneViewportDownloadForm;
