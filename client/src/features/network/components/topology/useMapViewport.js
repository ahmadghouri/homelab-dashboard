import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
// Below this scale labels get hard to read, so small screens scroll instead of shrinking further.
const MIN_FIT_SCALE = 0.75;
const MAX_FIT_SCALE = 1.3;
const DRAG_THRESHOLD_PX = 4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Zoom and pan for a scrollable map container. Zoom resizes the SVG and the container scrolls, so touch
// scrolling, keyboard focus (scrollIntoView) and mouse drag panning all move the same scroll position.
export function useMapViewport() {
  const containerRef = useRef(null);
  const [size, setSize] = useState(null);
  const [zoom, setZoom] = useState(1);
  // Where to keep the view centered after the next resize of the SVG, as a fraction of its size.
  const anchorRef = useRef({ x: 0.5, y: 0.5 });
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current && current.width === Math.round(width) && current.height === Math.round(height)
          ? current
          : { width: Math.round(width), height: Math.round(height) },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Returns the pixel size of the SVG and the map scale for content of `contentWidth` x `contentHeight` units.
  const measure = (contentWidth, contentHeight) => {
    if (!size) {
      return null;
    }
    const fit = clamp(Math.min(size.width / contentWidth, size.height / contentHeight), MIN_FIT_SCALE, MAX_FIT_SCALE);
    const scale = fit * zoom;
    return {
      scale,
      width: Math.max(contentWidth * scale, size.width),
      height: Math.max(contentHeight * scale, size.height),
    };
  };

  const rememberCenter = () => {
    const element = containerRef.current;
    if (element && element.scrollWidth > 0) {
      anchorRef.current = {
        x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth,
        y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight,
      };
    }
  };

  const zoomBy = (factor) => {
    rememberCenter();
    setZoom((current) => clamp(current * factor, MIN_ZOOM, MAX_ZOOM));
  };

  const reset = () => {
    anchorRef.current = { x: 0.5, y: 0.5 };
    setZoom(1);
    // When zoom is already 1 nothing re-renders, so center right away as well.
    const element = containerRef.current;
    if (element) {
      element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
    }
  };

  // After the SVG changes size, scroll so the remembered point is back in the middle.
  const applyAnchor = (svgWidth, svgHeight) => {
    const element = containerRef.current;
    const anchor = anchorRef.current;
    if (!element || !anchor) {
      return;
    }
    element.scrollLeft = anchor.x * svgWidth - element.clientWidth / 2;
    element.scrollTop = anchor.y * svgHeight - element.clientHeight / 2;
    anchorRef.current = null;
  };

  // Mouse drag pans the view. Touch keeps native scrolling; pointer capture starts only after a real drag so a
  // simple click still reaches the node under the pointer.
  const panHandlers = {
    onPointerDown: (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }
      const element = containerRef.current;
      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: element.scrollLeft,
        top: element.scrollTop,
        moved: false,
      };
    },
    onPointerMove: (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const element = containerRef.current;
      if (!drag.moved) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        drag.moved = true;
        element.setPointerCapture(event.pointerId);
        element.dataset.dragging = 'true';
      }
      element.scrollLeft = drag.left - dx;
      element.scrollTop = drag.top - dy;
    },
    onPointerUp: (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const element = containerRef.current;
      if (drag.moved) {
        suppressClickRef.current = true;
        element.releasePointerCapture(event.pointerId);
        delete element.dataset.dragging;
      }
      dragRef.current = null;
    },
    onPointerCancel: () => {
      const element = containerRef.current;
      if (element) {
        delete element.dataset.dragging;
      }
      dragRef.current = null;
    },
    // A drag that ends over a node must not also select it.
    onClickCapture: (event) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        event.stopPropagation();
      }
    },
  };

  return {
    containerRef,
    // Container width / height, or null before the first measurement.
    aspect: size && size.height > 0 ? size.width / size.height : null,
    zoom,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset,
    measure,
    applyAnchor,
    panHandlers,
  };
}

// Re-centers on the remembered point after a render (before paint, so the view never jumps). The anchor is
// cleared once used, so later renders are no-ops until the next zoom or reset.
export function useApplyAnchor(viewport, svgWidth, svgHeight) {
  const { applyAnchor } = viewport;
  useLayoutEffect(() => {
    if (svgWidth && svgHeight) {
      applyAnchor(svgWidth, svgHeight);
    }
  }, [applyAnchor, svgWidth, svgHeight]);
}
