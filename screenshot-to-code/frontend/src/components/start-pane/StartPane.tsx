import React from "react";
import ImageUpload from "../ImageUpload";
import { UrlInputSection } from "../UrlInputSection";
import ImportCodeSection from "../ImportCodeSection";
import { Stack } from "../../lib/stacks";

interface Props {
  // 🔧 SIMPLIFICATION: Only image mode supported (video mode removed)
  doCreate: (images: string[]) => void;
  importFromCode: (code: string, stack: Stack) => void;
}

const StartPane: React.FC<Props> = ({ doCreate, importFromCode }) => {
  return (
    <div className="flex flex-col justify-center items-center gap-y-10">
      <ImageUpload setReferenceImages={doCreate} />
      {/* 🔒 SECURITY: screenshotOneApiKey удален - используется только на backend */}
      <UrlInputSection
        doCreate={doCreate}
      />
      <ImportCodeSection importFromCode={importFromCode} />
    </div>
  );
};

export default StartPane;
