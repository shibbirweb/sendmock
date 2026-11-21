import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  TwilioSubaccount,
  TwilioSubaccountChanges,
  TwilioSubaccountInput,
  TwilioSubaccountTokenReveal,
} from "@/lib/api/types";

/** Subaccounts of the Twilio provider's main account, tokens masked (SM-19.4). */
export function useTwilioSubaccounts() {
  return useQuery({
    queryKey: queryKeys.twilio.subaccounts,
    queryFn: ({ signal }) =>
      requestApi<TwilioSubaccount[]>("/twilio/subaccounts", {
        abortSignal: signal,
      }),
  });
}

function useSubaccountMutation<MutationInput, MutationResult>(
  mutationRequest: (mutationInput: MutationInput) => Promise<MutationResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.twilio.subaccounts,
      });
    },
  });
}

/** Adds a subaccount, or changes the one with `accountSid`. */
export function useSaveTwilioSubaccount() {
  return useSubaccountMutation(
    ({
      accountSid,
      subaccountInput,
    }: {
      accountSid: string | null;
      subaccountInput: TwilioSubaccountInput;
    }) => {
      if (accountSid === null) {
        return requestApi<TwilioSubaccount>("/twilio/subaccounts", {
          method: "POST",
          requestBody: subaccountInput,
        });
      }
      const changes: TwilioSubaccountChanges = {
        friendly_name: subaccountInput.friendly_name,
        status: subaccountInput.status,
        auth_token: subaccountInput.auth_token,
        debugger_url: subaccountInput.debugger_url,
      };
      return requestApi<TwilioSubaccount>(`/twilio/subaccounts/${accountSid}`, {
        method: "PATCH",
        requestBody: changes,
      });
    },
  );
}

export function useDeleteTwilioSubaccount() {
  return useSubaccountMutation((accountSid: string) =>
    requestApi<void>(`/twilio/subaccounts/${accountSid}`, { method: "DELETE" }),
  );
}

/** The full token, asked for after a confirmation; never cached. */
export function useRevealTwilioSubaccountToken() {
  return useMutation({
    mutationFn: (accountSid: string) =>
      requestApi<TwilioSubaccountTokenReveal>(
        `/twilio/subaccounts/${accountSid}/auth-token`,
      ),
  });
}
