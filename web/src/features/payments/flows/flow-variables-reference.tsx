import { flowLabelVariables } from "@/lib/payments/flow-label-variables";

/** Every variable a step label can use, what it becomes and an example (PY-12.7). */
export function FlowVariablesReference() {
  return (
    <details className="group rounded-lg border" open>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Variables
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          Use them in any label; the checkout page fills them in.
        </span>
      </summary>
      <table
        aria-label="Label variables"
        className="w-full border-t text-left text-xs"
      >
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Variable
            </th>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Becomes
            </th>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Example
            </th>
          </tr>
        </thead>
        <tbody>
          {flowLabelVariables.map((flowVariable) => (
            <tr key={flowVariable.name} className="border-t">
              <td className="px-3 py-1.5">
                <code className="font-mono">{flowVariable.token}</code>
              </td>
              <td className="px-3 py-1.5">{flowVariable.description}</td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {flowVariable.example}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
