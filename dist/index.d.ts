type Decision = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
type ApprovalStatus = "pending" | "approved" | "denied" | "expired";
type DecideRequest = {
    actionType: string;
    target: string;
    context?: Record<string, unknown>;
    requestId?: string;
};
type DecideResponse = {
    decision: Decision;
    reason: string;
    requestId: string;
    approvalId?: string | null;
    matchedRule?: string;
    riskScore?: number;
    severity?: string;
};
type ApprovalPollResponse = {
    status: ApprovalStatus;
    resolvedAt?: string;
    resolvedBy?: string;
    comment?: string;
};
type FailMode = "open" | "closed";
declare class ShieldError extends Error {
    readonly code: "BLOCKED" | "DENIED" | "TIMEOUT" | "NETWORK_ERROR" | "UNKNOWN";
    readonly requestId?: string;
    constructor(message: string, code: "BLOCKED" | "DENIED" | "TIMEOUT" | "NETWORK_ERROR" | "UNKNOWN", requestId?: string);
}
interface ShieldConfig {
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
    failMode?: FailMode;
    approvalTimeoutMs?: number;
    approvalPollIntervalMs?: number;
}
declare class Shield {
    private baseUrl;
    private apiKey;
    private timeoutMs;
    private failMode;
    private approvalTimeoutMs;
    private approvalPollIntervalMs;
    constructor(opts: ShieldConfig);
    /**
     * Request a decision from the Guard API.
     *
     * Uses the unified Guard Gateway (/api/v1/guard) as the primary endpoint.
     * This ensures SDK and Gateway share the same runtime pipeline.
     */
    decide(req: DecideRequest): Promise<DecideResponse>;
    /**
     * Poll for approval status with exponential backoff.
     * Returns when status is no longer "pending".
     *
     * @param approvalId - The approval ID returned from decide() when decision is REQUIRE_APPROVAL
     */
    pollApproval(approvalId: string): Promise<ApprovalPollResponse>;
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
    guard<T>(actionType: string, target: string, context: Record<string, unknown> | null, fn: () => Promise<T>): Promise<T>;
    /**
     * Verify audit chain integrity for the organization.
     */
    verifyAuditChain(): Promise<{
        valid: boolean;
        brokenAt?: string;
        chainLength: number;
    }>;
    private handleFail;
    private sleep;
}

export { type ApprovalPollResponse, type ApprovalStatus, type DecideRequest, type DecideResponse, type Decision, Shield, type ShieldConfig, ShieldError };
