export type Decision = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export type DecideRequest = {
  actionType: string;
  target: string;
  context?: Record<string, unknown>;
  requestId?: string;
};

export type DecideResponse = {
  decision: Decision;
  reason: string;
  requestId: string;
  approvalId?: string | null;
  matchedRule?: string;
  riskScore?: number;
  severity?: string;
};

export type ApprovalPollResponse = {
  status: ApprovalStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  comment?: string;
};

type FailMode = "open" | "closed";

export class ShieldError extends Error {
  constructor(
    message: string,
    public readonly code: "BLOCKED" | "DENIED" | "TIMEOUT" | "NETWORK_ERROR" | "UNKNOWN",
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ShieldError";
  }
}

export interface ShieldConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  failMode?: FailMode;
  approvalTimeoutMs?: number;
  approvalPollIntervalMs?: number;
}

export class Shield {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private failMode: FailMode;
  private approvalTimeoutMs: number;
  private approvalPollIntervalMs: number;

  constructor(opts: ShieldConfig) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 3000;
    this.failMode = opts.failMode ?? "closed";
    this.approvalTimeoutMs = opts.approvalTimeoutMs ?? 300000;
    this.approvalPollIntervalMs = opts.approvalPollIntervalMs ?? 2000;
  }

  /**
   * Request a decision from the Guard API.
   * 
   * Uses the unified Guard Gateway (/api/v1/guard) as the primary endpoint.
   * This ensures SDK and Gateway share the same runtime pipeline.
   */
  async decide(req: DecideRequest): Promise<DecideResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/guard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          action: {
            type: req.actionType,
            target: req.target,
            context: req.context ?? {},
          },
          requestId: req.requestId,
        }),
        signal: controller.signal,
      });

      const json = await res.json();

      if (!res.ok) {
        return this.handleFail(`API error: ${json.error ?? res.statusText}`, req);
      }

      return {
        decision: json.decision,
        reason: json.reason,
        requestId: json.requestId,
        approvalId: json.approvalId,
        matchedRule: json.matchedRule,
        riskScore: json.riskScore,
        severity: json.severity,
      };
    } catch {
      return this.handleFail("Timeout or network failure", req);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Poll for approval status with exponential backoff.
   * Returns when status is no longer "pending".
   * 
   * @param approvalId - The approval ID returned from decide() when decision is REQUIRE_APPROVAL
   */
  async pollApproval(approvalId: string): Promise<ApprovalPollResponse> {
    const startTime = Date.now();
    let interval = this.approvalPollIntervalMs;
    const maxInterval = 10000;

    while (Date.now() - startTime < this.approvalTimeoutMs) {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/approvals/${approvalId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!res.ok) {
          await this.sleep(interval);
          interval = Math.min(interval * 2, maxInterval);
          continue;
        }

        const data = await res.json();

        if (data.status !== "pending") {
          return data;
        }

        await this.sleep(interval);
        interval = Math.min(interval * 2, maxInterval);
      } catch {
        await this.sleep(interval);
        interval = Math.min(interval * 2, maxInterval);
      }
    }

    return { status: "expired" };
  }

  /**
   * Guard an action - wraps execution with containment evaluation.
   * 
   * Flow:
   * 1. POST /api/v1/guard
   * 2. If BLOCK -> throw ShieldError
   * 3. If REQUIRE_APPROVAL -> poll until approved/denied/timeout
   * 4. If APPROVED or ALLOW -> execute fn()
   * 5. If DENIED -> throw ShieldError
   * 6. If timeout -> depends on failMode
   */
  async guard<T>(
    actionType: string,
    target: string,
    context: Record<string, unknown> | null,
    fn: () => Promise<T>
  ): Promise<T> {
    const response = await this.decide({
      actionType,
      target,
      context: context ?? undefined,
    });

    if (response.decision === "BLOCK") {
      throw new ShieldError(
        `Action blocked: ${response.reason}`,
        "BLOCKED",
        response.requestId
      );
    }

    if (response.decision === "ALLOW") {
      return fn();
    }

    if (response.decision === "REQUIRE_APPROVAL") {
      if (!response.approvalId) {
        throw new ShieldError(
          "REQUIRE_APPROVAL decision received but approvalId is missing. This indicates a server error - the Guard should always return an approvalId when requiring approval.",
          "UNKNOWN",
          response.requestId
        );
      }
      const approval = await this.pollApproval(response.approvalId);

      switch (approval.status) {
        case "approved":
          return fn();

        case "denied":
          throw new ShieldError(
            `Action denied by approver${approval.resolvedBy ? ` (${approval.resolvedBy})` : ""}: ${approval.comment || "No reason provided"}`,
            "DENIED",
            response.requestId
          );

        case "expired":
        case "pending":
          if (this.failMode === "open") {
            return fn();
          }
          throw new ShieldError(
            `Approval timed out after ${this.approvalTimeoutMs / 1000} seconds. No decision was made within the timeout window. Action blocked due to fail-closed configuration.`,
            "TIMEOUT",
            response.requestId
          );

        default:
          throw new ShieldError(
            `Unknown approval status: ${approval.status}`,
            "UNKNOWN",
            response.requestId
          );
      }
    }

    throw new ShieldError(
      `Unknown decision: ${response.decision}`,
      "UNKNOWN",
      response.requestId
    );
  }

  /**
   * Verify audit chain integrity for the organization.
   */
  async verifyAuditChain(): Promise<{
    valid: boolean;
    brokenAt?: string;
    chainLength: number;
  }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/audit/verify`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to verify audit chain");
      }

      return await res.json();
    } catch (err) {
      throw new ShieldError(
        `Audit verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "NETWORK_ERROR"
      );
    }
  }

  private handleFail(reason: string, req: DecideRequest): DecideResponse {
    if (this.failMode === "open") {
      return {
        decision: "ALLOW",
        reason: `${reason} (fail-open)`,
        requestId: req.requestId ?? crypto.randomUUID(),
      };
    }

    return {
      decision: "BLOCK",
      reason: `${reason} (fail-closed)`,
      requestId: req.requestId ?? crypto.randomUUID(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
