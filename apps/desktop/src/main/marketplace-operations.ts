import {
  MarketplaceIpcRequestSchema,
  type MarketplaceIpcRequest
} from "@deepwrite/contracts";
import type { MarketplaceClient } from "./marketplace-client";

export async function dispatchMarketplaceOperation(
  client: MarketplaceClient,
  rawRequest: unknown
): Promise<unknown> {
  const request: MarketplaceIpcRequest =
    MarketplaceIpcRequestSchema.parse(rawRequest);
  switch (request.operation) {
    case "session":
      return client.session();
    case "register":
      return client.register(request.input);
    case "login":
      return client.login(request.input);
    case "logout":
      return client.logout();
    case "list":
      return client.list(request.filter);
    case "detail":
      return client.detail(request.ref);
    case "listMine":
      return client.listMine(request.filter);
    case "myDetail":
      return client.myDetail(request.ref);
    case "publish":
      return client.publish(request.input);
    case "update":
      return client.update(request.input);
    case "setEnabled":
      return client.setEnabled(request.input);
    case "delete":
      return client.delete(request.ref);
    case "like":
      return client.like(request.input);
    case "previewInstall":
      return client.previewInstall(request.ref);
    case "install":
      return client.install(request.input);
  }
}
