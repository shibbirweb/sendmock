import { DownloadIcon, FileUpIcon, FileTextIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scenarioExamples } from "@/features/scenarios/scenario-examples";

/** Load example, Upload a .toml file and Download the current text. */
export function ScenarioFileActions({
  scenarioText,
  onLoad,
}: {
  scenarioText: string;
  onLoad: (nextScenarioText: string) => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <FileTextIcon />
            Load example
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {scenarioExamples.map((scenarioExample) => (
            <DropdownMenuItem
              key={scenarioExample.exampleKey}
              onSelect={() => onLoad(scenarioExample.scenarioText)}
            >
              {scenarioExample.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUpIcon />
        Upload
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".toml,application/toml,text/plain"
        aria-label="Upload a scenario file"
        className="hidden"
        onChange={(changeEvent) => {
          void changeEvent.target.files?.[0]?.text().then(onLoad);
        }}
      />
      <Button type="button" variant="outline" size="sm" asChild>
        <a
          href={`data:application/toml;charset=utf-8,${encodeURIComponent(scenarioText)}`}
          download="scenario.toml"
        >
          <DownloadIcon />
          Download
        </a>
      </Button>
    </div>
  );
}
