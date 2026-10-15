import { describe, expect, test } from "vite-plus/test";
import type { AutomationPrincipal, Flow } from "@/types/automation.types";
import { authorizeFlow, authorizeRequest, authorizationScopeForGoal } from "../taskAuthorization";

const principal: AutomationPrincipal = {
  id: "principal-1",
  label: "Claude Desktop",
  kind: "mcp",
  connectionId: "connection-1",
  clientName: "Claude Desktop",
};

const flow = (appPackage = "com.presalio.app", quantity = "2"): Flow => ({
  version: 1,
  id: "order",
  name: "Place order",
  appPackage,
  steps: [
    {
      id: "quantity",
      op: "type",
      target: { kind: "text", text: "Quantity", exact: true },
      text: quantity,
    },
    { id: "confirm", op: "tap", target: { kind: "text", text: "Confirm order", exact: true } },
  ],
});

describe("task authorization", () => {
  test("covers the declared order confirmation without a second prompt", () => {
    const scope = authorizationScopeForGoal(
      "Order 3 products with 2 units each and confirm",
      "device-1",
      "com.presalio.app",
      100,
    );
    expect(authorizeFlow(scope, principal, "device-1", flow(), 101)).toMatchObject({
      allowed: true,
    });
  });

  test("rejects a changed product quantity or app before execution", () => {
    const scope = authorizationScopeForGoal(
      "Order 3 products with 2 units each and confirm",
      "device-1",
      "com.presalio.app",
      100,
    );
    expect(
      authorizeFlow(scope, principal, "device-1", flow("com.presalio.app", "5"), 101),
    ).toMatchObject({
      allowed: false,
      reason: "product quantity changes require new authorization",
    });
    expect(authorizeFlow(scope, principal, "device-1", flow("com.other.app"), 101)).toMatchObject({
      allowed: false,
      reason: "app is outside the authorized scope",
    });
  });

  test("rejects reuse by a different principal", () => {
    const scope = authorizationScopeForGoal("Open Presalio", "device-1", "com.presalio.app", 100);
    expect(
      authorizeRequest(
        scope,
        {
          principalId: "principal-2",
          deviceSerial: "device-1",
          appPackage: "com.presalio.app",
          actionClass: "navigate",
          stepId: "next",
          occurredAt: 101,
        },
        principal,
      ),
    ).toMatchObject({ allowed: false, reason: "principal does not own this task" });
  });
});
