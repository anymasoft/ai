#!/usr/bin/env node
/**
 * AI Engine Runner
 * Простой CLI для запуска pipeline из файла
 *
 * Usage:
 *   npx tsx runner.ts <input.txt>
 *   npx tsx runner.ts < input.txt
 */

import fs from "fs";
import path from "path";
import { runPipeline } from "./pipeline";
import { OpenAIConfig, PipelineInput } from "./types";

/**
 * Читает input из файла или stdin
 */
async function getInput(argOrStdin?: string): Promise<string> {
  if (argOrStdin && fs.existsSync(argOrStdin)) {
    // Читаем из файла
    console.log(`📄 Reading from: ${argOrStdin}`);
    return fs.readFileSync(argOrStdin, "utf-8");
  }

  // Читаем из stdin
  console.log("📄 Reading from stdin...");
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

/**
 * Главная функция
 */
async function main() {
  try {
    // Проверяем API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // Читаем input
    const inputArg = process.argv[2];
    const inputText = await getInput(inputArg);

    if (!inputText || inputText.trim().length === 0) {
      throw new Error("Empty input");
    }

    // Конфиг
    const config: OpenAIConfig = {
      apiKey,
      model: "gpt-4-mini",
      temperatureMap: 0.7,
      temperatureSkeleton: 0.8,
      temperatureScript: 0.85,
    };

    // Запускаем pipeline
    const result = await runPipeline(
      {
        text: inputText,
        metadata: {
          language: "russian",
        },
      },
      config
    );

    // Формируем имена файлов вывода
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputJsonFile = `output_${timestamp}.json`;
    const outputMdFile = `output_${timestamp}.md`;

    // Сохраняем JSON
    fs.writeFileSync(outputJsonFile, JSON.stringify(result, null, 2));
    console.log(`💾 Saved JSON: ${outputJsonFile}`);

    // Сохраняем Markdown с финальным сценарием
    const mdContent = `# ${result.stages.generatedScript.title}

## Hook (First Impression)
${result.stages.generatedScript.hook}

## Outline
${result.stages.generatedScript.outline.map((point, i) => `${i + 1}. ${point}`).join("\n")}

## Script
${result.stages.generatedScript.scriptText}

## Why It Should Work
${result.stages.generatedScript.whyItShouldWork}

---

### Semantic Analysis
- Topics: ${result.stages.semanticMap.mergedTopics.join(", ")}
- Patterns: ${result.stages.semanticMap.commonPatterns.join(", ")}
- Core Conflicts: ${result.stages.semanticMap.conflicts.join(", ")}
- Emotional Spikes: ${result.stages.semanticMap.emotionalSpikes.join(", ")}

### Narrative Structure
- Core Idea: ${result.stages.narrativeSkeleton.coreIdea}
- Central Paradox: ${result.stages.narrativeSkeleton.centralParadox}
- Main Question: ${result.stages.narrativeSkeleton.mainQuestion}

---

Generated at: ${new Date(result.metadata.timestamp).toISOString()}
Total time: ${(result.metadata.totalTime! / 1000).toFixed(2)}s
`;

    fs.writeFileSync(outputMdFile, mdContent);
    console.log(`📝 Saved Markdown: ${outputMdFile}`);

    console.log("\n✨ Done! Check the output files above.");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
