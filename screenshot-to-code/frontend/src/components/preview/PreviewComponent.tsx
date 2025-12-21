import { useEffect, useRef, useState, useCallback } from "react";
import classNames from "classnames";
import useThrottle from "../../hooks/useThrottle";
import EditPopup from "../select-and-edit/EditPopup";
import { useAppStore } from "../../store/app-store";

interface Props {
  code: string;
  device: "mobile" | "desktop";
  doUpdate: (updateInstruction: string, selectedElement?: HTMLElement) => void;
}

function PreviewComponent({ code, device, doUpdate }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // 🔧 PARTIAL UPDATE: Check if partial update is in progress
  const { isPartialUpdateInProgress } = useAppStore();

  // Don't update code more often than every 200ms.
  const throttledCode = useThrottle(code, 200);

  // Select and edit functionality
  const [clickEvent, setClickEvent] = useState<MouseEvent | null>(null);
  const [scale, setScale] = useState(1);

  // 🔧 CRITICAL: Explicit function to set iframe content
  // This is the ONLY place where iframe.srcdoc can be modified
  const setIframeContent = useCallback((html: string) => {
    if (isPartialUpdateInProgress) {
      console.error(
        "❌ VIOLATION: Attempted to set iframe.srcdoc during partial update! This would break DOM mutations."
      );
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;

    console.warn("🔧 SET IFRAME CONTENT (full document generation)");
    iframe.srcdoc = html;

    // Set up click handler for select and edit functionality
    iframe.addEventListener("load", function () {
      iframe.contentWindow?.document.body.addEventListener(
        "click",
        setClickEvent
      );
    });
  }, [isPartialUpdateInProgress]);

  // Add scaling logic
  useEffect(() => {
    const updateScale = () => {
      const wrapper = wrapperRef.current;
      const iframe = iframeRef.current;
      if (!wrapper || !iframe) return;

      const viewportWidth = wrapper.clientWidth;
      const baseWidth = device === "desktop" ? 1440 : 375;
      const scaleValue = Math.min(1, viewportWidth / baseWidth);

      setScale(scaleValue);

      iframe.style.transform = `scale(${scaleValue})`;
      iframe.style.transformOrigin = "top left";
      // Adjust wrapper height to account for scaling
      wrapper.style.height = `${iframe.offsetHeight * scaleValue}px`;
    };

    updateScale();

    // Add event listener for window resize
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [device]);

  // 🔧 CRITICAL: useEffect that triggers setIframeContent for full document generation
  // This is the ONLY place where iframe content is updated
  useEffect(() => {
    setIframeContent(throttledCode);
  }, [throttledCode, setIframeContent]);

  return (
    <div className="flex justify-center mr-4">
      <div
        ref={wrapperRef}
        className="overflow-y-auto overflow-x-hidden w-full"
      >
        <iframe
          id={`preview-${device}`}
          ref={iframeRef}
          title="Preview"
          className={classNames(
            "border-[4px] border-black rounded-[20px] shadow-lg mx-auto",
            {
              "w-[1440px] h-[900px]": device === "desktop",
              "w-[375px] h-[812px]": device === "mobile",
            }
          )}
        ></iframe>
        <EditPopup
          event={clickEvent}
          iframeRef={iframeRef}
          doUpdate={doUpdate}
          scale={scale}
        />
      </div>
    </div>
  );
}

export default PreviewComponent;
