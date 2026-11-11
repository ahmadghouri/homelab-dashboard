import { FileCogIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const EXAMPLE = `{
  "projects": [
    {
      "id": "homelab-api",
      "name": "Homelab API",
      "type": "node",
      "cwd": "C:/path/to/server",
      "command": ["npm", "run", "dev"],
      "port": 4000,
      "env": { "NODE_ENV": "development" },
      "logFile": null
    }
  ],
  "services": [
    { "id": "mongodb", "name": "MongoDB", "serviceName": "MongoDB", "port": 27017 }
  ]
}`;

const RULES = [
  'id: lowercase letters, digits and dashes, unique (for example my-api).',
  'type: node, laravel, python or other.',
  'command: the program and its arguments as a list, for example ["npm", "run", "dev"].',
  'port (optional): lets the dashboard spot port conflicts and projects started by hand.',
  'logFile (optional): a log file the agent also reads, for example storage/logs/laravel.log.',
];

// Shown when the PC has no workspace.json yet or the file is invalid.
export function WorkspaceSetupHelp({ configFound, configError }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCogIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{configError ? 'workspace.json has an error' : 'Set up the workspace on this PC'}</CardTitle>
        </div>
        <CardDescription>
          {configError
            ? 'The agent could not read the file, so no projects are shown. Fix the error below and save: the agent reloads the file by itself.'
            : 'The agent did not find a workspace.json file. Create one to list your projects and services here.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {configError && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 font-mono text-xs break-words text-danger">
            {configError}
          </p>
        )}
        {!configFound && (
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>
              Create <code className="font-mono">workspace.json</code> in the <code className="font-mono">agent</code>{' '}
              folder on the PC (or point <code className="font-mono">WORKSPACE_FILE</code> in{' '}
              <code className="font-mono">agent/.env</code> at another path).
            </li>
            <li>Copy the example below and change the paths, commands and ports.</li>
            <li>
              To start and stop from the dashboard, set <code className="font-mono">WORKSPACE_CONTROL=on</code> in{' '}
              <code className="font-mono">agent/.env</code> and restart the agent.
            </li>
          </ol>
        )}
        <pre
          className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs"
          aria-label="Example workspace.json"
          tabIndex={0}
        >
          {EXAMPLE}
        </pre>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
