import { createTypingCue, type UiCue } from "../../ui-cues";

/**
 * What each builder types and when, shared by the panels and their sounds
 * so the two cannot drift apart.
 */
export type BuilderTiming = {
  appearFrame: number;
  workStartFrame: number;
};

export type ScriptedField = {
  label: string;
  value: string;
  /** Frames after the builder's work starts. */
  offsetFrames: number;
  isMonospace: boolean;
};

export const fieldCharactersPerFrame = 0.8;
export const templateCharactersPerFrame = 1.2;
export const templateNameLeadFrames = 14;

export const templateBody = `{
  "text": "{{ data.subject }}",
  "to": "{{ data.to[0].address }}"
}`;

export const templatePreview = `{
  "text": "Order #1042 shipped",
  "to": "maya@example.com"
}`;

/** When the template's live preview appears, after the body is typed. */
export function getTemplatePreviewFrame(workStartFrame: number): number {
  return (
    workStartFrame +
    Math.ceil(templateBody.length / templateCharactersPerFrame) +
    4
  );
}

export const emailProviderFields: ScriptedField[] = [
  { label: "Name", value: "Acme Mail", offsetFrames: 12, isMonospace: false },
  {
    label: "Send path",
    value: "POST /v1/messages",
    offsetFrames: 30,
    isMonospace: true,
  },
  {
    label: "Response",
    value: '202 { "id": "{{ email.id }}" }',
    offsetFrames: 56,
    isMonospace: true,
  },
];

export const smsProviderFields: ScriptedField[] = [
  { label: "Name", value: "Infobip", offsetFrames: 12, isMonospace: false },
  {
    label: "Delivered",
    value: "DELIVERED_TO_HANDSET",
    offsetFrames: 28,
    isMonospace: true,
  },
  {
    label: "Failed",
    value: "UNDELIVERABLE_NOT_DELIVERED",
    offsetFrames: 58,
    isMonospace: true,
  },
];

export const upayFlowSteps = ["Wallet number", "OTP", "PIN", "Paid"];
export const flowStepOffsetFrames = 20;
export const flowStepIntervalFrames = 18;

export const builderTimings = {
  template: { appearFrame: 16, workStartFrame: 50 },
  emailProvider: { appearFrame: 26, workStartFrame: 80 },
  smsProvider: { appearFrame: 36, workStartFrame: 120 },
  paymentGateway: { appearFrame: 46, workStartFrame: 160 },
};

function buildFieldCues(
  fields: ScriptedField[],
  workStartFrame: number,
): UiCue[] {
  return fields.map((scriptedField) =>
    createTypingCue(
      workStartFrame + scriptedField.offsetFrames,
      scriptedField.value,
      fieldCharactersPerFrame,
    ),
  );
}

/**
 * Sounds: each panel pops in; fields are typed; a "Start from" choice
 * clicks; the template's preview and the finished checkout flow succeed.
 */
export function buildBuilderCues(): UiCue[] {
  const { template, emailProvider, smsProvider, paymentGateway } =
    builderTimings;
  const lastFlowStepFrame =
    paymentGateway.workStartFrame +
    flowStepOffsetFrames +
    (upayFlowSteps.length - 1) * flowStepIntervalFrames;
  return [
    ...Object.values(builderTimings).map((builderTiming): UiCue => ({
      frame: builderTiming.appearFrame,
      cueKind: "appear",
    })),
    createTypingCue(
      template.workStartFrame - templateNameLeadFrames,
      "Ops alert",
      fieldCharactersPerFrame,
    ),
    createTypingCue(
      template.workStartFrame,
      templateBody,
      templateCharactersPerFrame,
    ),
    {
      frame: getTemplatePreviewFrame(template.workStartFrame),
      cueKind: "success",
    },
    { frame: emailProvider.workStartFrame, cueKind: "click" },
    ...buildFieldCues(emailProviderFields, emailProvider.workStartFrame),
    { frame: smsProvider.workStartFrame, cueKind: "click" },
    ...buildFieldCues(smsProviderFields, smsProvider.workStartFrame),
    createTypingCue(
      paymentGateway.workStartFrame,
      "Upay",
      fieldCharactersPerFrame,
    ),
    ...upayFlowSteps.slice(0, -1).map((_flowStep, stepIndex): UiCue => ({
      frame:
        paymentGateway.workStartFrame +
        flowStepOffsetFrames +
        stepIndex * flowStepIntervalFrames,
      cueKind: "appear",
    })),
    { frame: lastFlowStepFrame, cueKind: "success" },
  ];
}
