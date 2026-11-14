/**
 * The checks that keep every code example honest against the contract
 * (docs/plan/21-reference-and-examples.md, WS-08.3).
 */
import type { JsonSchema, SchemaComponents } from "@/lib/openapi/openapi-types";

import {
  type ContractOperation,
  type ExampleContract,
  resolveContractSchema,
} from "./example-contract";
import {
  type ApiStep,
  type CodeExample,
  isFieldReference,
  splitFieldPath,
  type StepValue,
} from "./example-types";

/** The schema of `items.0.status` inside a schema, or undefined when there is none. */
export function readFieldSchema(
  schema: JsonSchema,
  fieldPath: string,
  schemas: SchemaComponents,
): JsonSchema | undefined {
  let currentSchema: JsonSchema | undefined = schema;
  for (const pathPart of splitFieldPath(fieldPath)) {
    const resolvedSchema: JsonSchema = resolveContractSchema(
      currentSchema ?? {},
      schemas,
    );
    currentSchema =
      typeof pathPart === "number"
        ? resolvedSchema.items
        : resolvedSchema.properties?.[pathPart];
    if (currentSchema === undefined) {
      return undefined;
    }
  }

  return currentSchema;
}

function isNullable(schema: JsonSchema | undefined): boolean {
  return (
    (Array.isArray(schema?.type) && schema.type.includes("null")) ||
    (schema?.anyOf ?? schema?.oneOf ?? []).some(
      (variant) => variant.type === "null",
    )
  );
}

function collectReferences(
  stepValue: StepValue | undefined,
): { answerName: string; fieldPath: string }[] {
  if (isFieldReference(stepValue)) {
    return [stepValue];
  }
  if (Array.isArray(stepValue)) {
    return stepValue.flatMap(collectReferences);
  }
  if (stepValue !== null && typeof stepValue === "object") {
    return Object.values(stepValue).flatMap(collectReferences);
  }

  return [];
}

function checkApiStep(
  apiStep: ApiStep,
  contractOperation: ContractOperation,
  schemas: SchemaComponents,
): string[] {
  const stepName = `${apiStep.method} ${apiStep.path}`;
  const bodySchema =
    contractOperation.bodySchema === null
      ? null
      : resolveContractSchema(contractOperation.bodySchema, schemas);
  const bodyFieldNames = Object.keys(bodySchema?.properties ?? {});
  const queryNames = contractOperation.queryParameters.map(
    (parameter) => parameter.name,
  );
  return [
    ...contractOperation.pathParameterNames
      .filter(
        (parameterName) => apiStep.pathValues?.[parameterName] === undefined,
      )
      .map((parameterName) => `${stepName}: no value for {${parameterName}}`),
    ...Object.keys(apiStep.query ?? {})
      .filter((queryName) => !queryNames.includes(queryName))
      .map((queryName) => `${stepName}: ${queryName} is not a query parameter`),
    ...contractOperation.queryParameters
      .filter(
        (parameter) =>
          parameter.isRequired && apiStep.query?.[parameter.name] === undefined,
      )
      .map((parameter) => `${stepName}: the query needs ${parameter.name}`),
    ...Object.keys(apiStep.body ?? {})
      .filter((fieldName) => !bodyFieldNames.includes(fieldName))
      .map((fieldName) => `${stepName}: ${fieldName} is not a body field`),
    ...(bodySchema?.required ?? [])
      // A nullable field may be left out: null is sent for it.
      .filter((fieldName) => !isNullable(bodySchema?.properties?.[fieldName]))
      .filter((fieldName) => apiStep.body?.[fieldName] === undefined)
      .map((fieldName) => `${stepName}: the body needs ${fieldName}`),
    ...(contractOperation.cliCommand === null
      ? [`${stepName}: no CLI command`]
      : []),
  ];
}

/** Everything wrong with an example, checked against the contract; empty when it is right. */
export function findExampleProblems(
  codeExample: CodeExample,
  exampleContract: ExampleContract,
): string[] {
  const answerSchemas = new Map<string, JsonSchema>();
  const problems: string[] = [];
  const checkReference = (answerName: string, fieldPath: string) => {
    const answerSchema = answerSchemas.get(answerName);
    if (answerSchema === undefined) {
      problems.push(
        `${codeExample.page}: no earlier answer named ${answerName}`,
      );
    } else if (
      readFieldSchema(answerSchema, fieldPath, exampleContract.schemas) ===
      undefined
    ) {
      problems.push(
        `${codeExample.page}: ${answerName}.${fieldPath} is not in the answer`,
      );
    }
  };
  for (const exampleStep of codeExample.steps) {
    if (exampleStep.kind === "expect") {
      checkReference(exampleStep.answerName, exampleStep.fieldPath);
      continue;
    }
    if (exampleStep.kind === "pick") {
      checkReference(exampleStep.fromAnswer, exampleStep.fieldPath);
      const fromSchema = answerSchemas.get(exampleStep.fromAnswer);
      const pickedSchema =
        fromSchema === undefined
          ? undefined
          : readFieldSchema(
              fromSchema,
              exampleStep.fieldPath,
              exampleContract.schemas,
            );
      if (pickedSchema !== undefined) {
        answerSchemas.set(exampleStep.answerName, pickedSchema);
      }
      continue;
    }
    const stepValues = [
      ...Object.values(exampleStep.body ?? {}),
      ...(exampleStep.kind === "api"
        ? Object.values(exampleStep.pathValues ?? {})
        : []),
    ];
    for (const reference of stepValues.flatMap(collectReferences)) {
      checkReference(reference.answerName, reference.fieldPath);
    }
    if (exampleStep.kind === "app") {
      continue;
    }
    const contractOperation = exampleContract.findOperation(
      exampleStep.method,
      exampleStep.path,
    );
    if (contractOperation === null) {
      problems.push(
        `${codeExample.page}: ${exampleStep.method} ${exampleStep.path} is not in the spec`,
      );
      continue;
    }
    problems.push(
      ...checkApiStep(
        exampleStep,
        contractOperation,
        exampleContract.schemas,
      ).map((problem) => `${codeExample.page}: ${problem}`),
    );
    if (
      exampleStep.answerName !== undefined &&
      contractOperation.responseSchema !== null
    ) {
      answerSchemas.set(
        exampleStep.answerName,
        contractOperation.responseSchema,
      );
    }
  }

  return problems;
}
