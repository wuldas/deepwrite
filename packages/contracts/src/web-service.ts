import { z } from "zod";

export const WEB_SERVICE_HTTP_PREFIX = "/deepwrite";

export const WebServiceInvokeRequestSchema = z.object({
  channel: z.string().min(1),
  payload: z.unknown()
});
export type WebServiceInvokeRequest = z.infer<
  typeof WebServiceInvokeRequestSchema
>;

export const WebServiceInvokeErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});
export type WebServiceInvokeError = z.infer<typeof WebServiceInvokeErrorSchema>;

export const WebServiceInvokeResponseSchema = z.object({
  ok: z.boolean(),
  value: z.unknown(),
  error: WebServiceInvokeErrorSchema.nullable().default(null)
});
export type WebServiceInvokeResponse = z.infer<
  typeof WebServiceInvokeResponseSchema
>;
