import { describe, expect, it } from "vitest";

import { umbraVaultExecutionMessage } from "@/lib/offpay/umbra-vault-execution";

describe("Umbra vault execution messages", () => {
  it("maps nested simulation funding failures to a useful wallet message", () => {
    const error = {
      cause: {
        simulationLogs: [
          "Program 11111111111111111111111111111111 invoke [1]",
          "Transfer: insufficient lamports 1000, need 20000000",
        ],
      },
    };

    expect(umbraVaultExecutionMessage(error)).toBe(
      "Insufficient SOL for Umbra setup and network fees.",
    );
  });

  it("surfaces anchor custom errors from simulation logs", () => {
    const error = {
      cause: {
        simulationLogs: [
          "Program log: Instruction: Deposit",
          "Program log: Error Code: InvalidFeeSchedule",
        ],
      },
    };

    expect(umbraVaultExecutionMessage(error)).toBe(
      "Umbra simulation failed: Error Code: InvalidFeeSchedule",
    );
  });

  it("maps missing token or Umbra accounts from simulation logs", () => {
    const error = {
      cause: {
        simulationLogs: [
          "Program log: Instruction: Deposit",
          "Program log: Error: AccountNotInitialized",
        ],
      },
    };

    expect(umbraVaultExecutionMessage(error)).toBe(
      "Required Umbra or token account is not initialized. Refresh the vault and try setup again.",
    );
  });

  it("surfaces simulation errors when logs are unavailable", () => {
    const error = {
      cause: {
        simulationErr: {
          InstructionError: [2, { Custom: 1 }],
        },
      },
    };

    expect(umbraVaultExecutionMessage(error)).toBe(
      'Umbra simulation failed: {"InstructionError":[2,{"Custom":1}]}',
    );
  });
});
