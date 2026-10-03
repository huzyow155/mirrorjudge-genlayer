# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class MirrorJudgeConsumer(gl.Contract):
    judge_address: Address
    settlements: TreeMap[str, str]

    def __init__(self, judge_address_str: str):
        self.judge_address = Address(judge_address_str)

    @gl.public.write
    def settle_dispute(self, case_id: str) -> str:
        judge = gl.get_contract_at(self.judge_address)
        outcome = judge.view().outcome_for_consumer(case_id)

        if outcome == "PENDING":
            raise gl.vm.UserError("dispute is still pending")

        if outcome == "NO_DECISION":
            # Policy on NO_DECISION: escalate to human arbitrator
            self.settlements[case_id] = "ESCALATED_TO_ARBITRATOR"
            return "ESCALATED_TO_ARBITRATOR"

        if outcome in ("PARTY_1", "PARTY_2", "SPLIT"):
            self.settlements[case_id] = "SETTLED_" + outcome
            return "SETTLED_" + outcome

        raise gl.vm.UserError("unexpected outcome: " + str(outcome))

    @gl.public.view
    def get_settlement(self, case_id: str) -> str:
        return self.settlements.get(case_id, "")
