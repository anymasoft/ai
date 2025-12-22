import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";

export function PlaygroundPage() {
  const handleUpload = () => {
    console.log("Upload handler");
    // Trigger the existing generation flow
  };

  return (
    <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Playground
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload a screenshot and let AI convert it to code
          </p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload Section */}
          <Card className="p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upload Screenshot
              </h2>

              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition"
                onClick={handleUpload}
              >
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-center text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  PNG, JPG, or GIF (max. 10MB)
                </p>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    AI Model
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm">
                    <option>Claude 3.7 (Recommended)</option>
                    <option>GPT-4o</option>
                    <option>Gemini Pro</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Tech Stack
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm">
                    <option>HTML + Tailwind</option>
                    <option>HTML + CSS</option>
                    <option>React + Tailwind</option>
                    <option>Vue + Tailwind</option>
                  </select>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleUpload}
              >
                Generate Code
              </Button>
            </div>
          </Card>

          {/* Right Column - Preview Section */}
          <Card className="p-6 border border-gray-200 dark:border-zinc-800 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Output
            </h2>

            <Tabs defaultValue="code" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="flex-1 overflow-auto">
                <div className="bg-gray-100 dark:bg-zinc-900 rounded p-4 text-sm text-gray-600 dark:text-gray-400 font-mono h-full">
                  <p>Generated code will appear here...</p>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1">
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded p-4 h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  Preview will appear here...
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Copy
              </Button>
              <Button variant="outline" size="sm" disabled>
                Download
              </Button>
              <Button variant="outline" size="sm" disabled>
                Share
              </Button>
            </div>
          </Card>
        </div>

        {/* Progress Section (Hidden by default) */}
        <div className="mt-6 hidden">
          <Card className="p-4 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Generating code... (40%)
              </span>
            </div>
            <div className="mt-3 w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1">
              <div className="bg-blue-600 h-1 rounded-full" style={{ width: "40%" }} />
            </div>
          </Card>
        </div>
      </div>
  );
}
