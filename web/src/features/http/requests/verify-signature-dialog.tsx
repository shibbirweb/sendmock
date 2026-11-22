import { ShieldCheckIcon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/api-client";
import { useVerifyWebhookSignature } from "@/lib/api/hooks/use-ci-queries";
import type { CapturedHttpRequest, SignatureSchemeName } from "@/lib/api/types";

const schemeLabels: [SignatureSchemeName, string][] = [
  ["standard_webhooks", "Standard Webhooks"],
  ["stripe", "Stripe-Signature"],
  ["hmac", "HMAC header"],
];

/** Checks the captured request's signature as the receiving app should (WH-15.5). */
export function VerifySignatureDialog({
  capturedRequest,
  onClose,
}: {
  capturedRequest: CapturedHttpRequest;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const [scheme, setScheme] =
    React.useState<SignatureSchemeName>("standard_webhooks");
  const [secret, setSecret] = React.useState("");
  const [headerName, setHeaderName] = React.useState("X-Signature");
  const [prefix, setPrefix] = React.useState("");
  const verifySignature = useVerifyWebhookSignature();
  const verification = verifySignature.data;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify signature</DialogTitle>
          <DialogDescription>
            Checks this request&apos;s signature with the secret your app uses.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            verifySignature.mutate({
              scheme,
              secret,
              request_id: capturedRequest.id,
              header: scheme === "hmac" ? headerName : null,
              prefix: scheme === "hmac" ? prefix : null,
            });
          }}
        >
          <FormField label="Scheme" fieldId={`${fieldIdPrefix}-scheme`}>
            <Select
              value={scheme}
              onValueChange={(selectedScheme) => {
                setScheme(selectedScheme as SignatureSchemeName);
              }}
            >
              <SelectTrigger id={`${fieldIdPrefix}-scheme`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schemeLabels.map(([schemeKey, schemeLabel]) => (
                  <SelectItem key={schemeKey} value={schemeKey}>
                    {schemeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Secret" fieldId={`${fieldIdPrefix}-secret`}>
            <Input
              id={`${fieldIdPrefix}-secret`}
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(changeEvent) => setSecret(changeEvent.target.value)}
            />
          </FormField>
          {scheme === "hmac" && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Header" fieldId={`${fieldIdPrefix}-header`}>
                <Input
                  id={`${fieldIdPrefix}-header`}
                  value={headerName}
                  onChange={(changeEvent) =>
                    setHeaderName(changeEvent.target.value)
                  }
                />
              </FormField>
              <FormField label="Prefix" fieldId={`${fieldIdPrefix}-prefix`}>
                <Input
                  id={`${fieldIdPrefix}-prefix`}
                  placeholder="sha256="
                  value={prefix}
                  onChange={(changeEvent) =>
                    setPrefix(changeEvent.target.value)
                  }
                />
              </FormField>
            </div>
          )}
          {verification !== undefined && (
            <p role="status" className="text-sm">
              {verification.is_valid
                ? "The signature checks out."
                : `Not valid: ${verification.reason ?? ""}`}
            </p>
          )}
          {verifySignature.error instanceof ApiError && (
            <p role="alert" className="text-sm text-destructive">
              {verifySignature.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              type="submit"
              disabled={secret.trim() === "" || verifySignature.isPending}
            >
              <ShieldCheckIcon />
              Verify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
