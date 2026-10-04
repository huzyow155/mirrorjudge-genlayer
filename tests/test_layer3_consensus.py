import unittest
from tests.helpers_for_test import _round_decision, _clean_obs, P1, P2


def simulate_strict_eq(validator_runs):
    """
    Simulates GenLayer gl.eq_principle.strict_eq across validator nodes.
    strict_eq requires that the leader and validators return byte-identical discrete strings.
    """
    results = [fn() for fn in validator_runs]
    leader_result = results[0]
    all_agree = all(r == leader_result for r in results)
    return {
        "agreed": all_agree,
        "consensus_value": leader_result if all_agree else None,
        "results": results,
    }


class TestLayer3Consensus(unittest.TestCase):
    def test_identical_decisions_agree_in_consensus(self):
        # 3 validators all return DECIDED|PARTY_1|STABLE
        v1 = lambda: "DECIDED|PARTY_1|STABLE"
        v2 = lambda: "DECIDED|PARTY_1|STABLE"
        v3 = lambda: "DECIDED|PARTY_1|STABLE"

        outcome = simulate_strict_eq([v1, v2, v3])
        self.assertTrue(outcome["agreed"])
        self.assertEqual(outcome["consensus_value"], "DECIDED|PARTY_1|STABLE")

    def test_differing_validator_decisions_do_not_agree(self):
        # Validator 1 reaches DECIDED|PARTY_1|STABLE, Validator 2 flags UNSTABLE
        v1 = lambda: "DECIDED|PARTY_1|STABLE"
        v2 = lambda: "UNSTABLE|NONE|UNSTABLE"
        v3 = lambda: "DECIDED|PARTY_1|STABLE"

        outcome = simulate_strict_eq([v1, v2, v3])
        self.assertFalse(outcome["agreed"])
        self.assertIsNone(outcome["consensus_value"])

    def test_opposing_party_decisions_do_not_agree(self):
        # Validator 1 reaches DECIDED|PARTY_1|STABLE, Validator 2 reaches DECIDED|PARTY_2|STABLE
        v1 = lambda: "DECIDED|PARTY_1|STABLE"
        v2 = lambda: "DECIDED|PARTY_2|STABLE"

        outcome = simulate_strict_eq([v1, v2])
        self.assertFalse(outcome["agreed"])
        self.assertIsNone(outcome["consensus_value"])

    def test_insufficient_evidence_consensus_agreement(self):
        # Both validators evaluate missing evidence and deterministically return INSUFFICIENT|NONE|NA
        v1 = lambda: "INSUFFICIENT|NONE|NA"
        v2 = lambda: "INSUFFICIENT|NONE|NA"

        outcome = simulate_strict_eq([v1, v2])
        self.assertTrue(outcome["agreed"])
        self.assertEqual(outcome["consensus_value"], "INSUFFICIENT|NONE|NA")

    def test_heterogeneous_quotes_converge_to_same_consensus_decision(self):
        """
        Validators run different LLM models that extract slightly different verbatim quotes.
        Because code validates grounding and compares only the synthesized canonical decision,
        consensus succeeds.
        """
        criteria = [{"id": "c1", "text": "Delivery verified", "weight_bp": 10000}]
        evidence_text = "[PARTY_1] says: Contractor delivered 100 percent of endpoints on time."

        # Model A extracted full sentence
        parsed_a = {"results": {"c1": {"favors": P1, "quote": "Contractor delivered 100 percent of endpoints on time"}}}
        # Model B extracted shorter phrase (still >= 12 chars and in text)
        parsed_b = {"results": {"c1": {"favors": P1, "quote": "delivered 100 percent of endpoints"}}}

        clean_a = _clean_obs(criteria, parsed_a, evidence_text)
        clean_b = _clean_obs(criteria, parsed_b, evidence_text)

        # Both clean to {"c1": PARTY_1}
        self.assertEqual(clean_a["c1"], P1)
        self.assertEqual(clean_b["c1"], P1)

        dec_a = _round_decision(criteria, clean_a, clean_a, margin_bp=1500, max_flips=1)
        dec_b = _round_decision(criteria, clean_b, clean_b, margin_bp=1500, max_flips=1)

        self.assertEqual(dec_a, "DECIDED|PARTY_1|STABLE")
        self.assertEqual(dec_b, "DECIDED|PARTY_1|STABLE")

        outcome = simulate_strict_eq([lambda: dec_a, lambda: dec_b])
        self.assertTrue(outcome["agreed"])
        self.assertEqual(outcome["consensus_value"], "DECIDED|PARTY_1|STABLE")

    def test_scenario_a_clear_party_1_evidence(self):
        criteria = [{"id": "c1", "text": "Completion", "weight_bp": 10000}]
        obs = {"c1": P1}
        dec = _round_decision(criteria, obs, obs, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "DECIDED|PARTY_1|STABLE")

    def test_scenario_b_clear_party_2_evidence(self):
        criteria = [{"id": "c1", "text": "Completion", "weight_bp": 10000}]
        obs = {"c1": P2}
        dec = _round_decision(criteria, obs, obs, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "DECIDED|PARTY_2|STABLE")

    def test_scenario_c_balanced_contradictory_claims_converge(self):
        """
        Scenario C: Contradictory self-serving claims with no external documentation.
        Under hardened prompt instructions, validator LLMs evaluate both passes as NEITHER.
        """
        criteria = [
            {"id": "crit_1", "text": "Timely milestone deliverable completion", "weight_bp": 5000},
            {"id": "crit_2", "text": "Code specifications and test coverage", "weight_bp": 5000}
        ]
        # Canonical pass extracts NEITHER for both criteria
        can_obs = {"crit_1": "NEITHER", "crit_2": "NEITHER"}
        # Mirrored pass extracts NEITHER for both criteria (and swapping NEITHER remains NEITHER)
        mir_obs = {"crit_1": "NEITHER", "crit_2": "NEITHER"}

        dec = _round_decision(criteria, can_obs, mir_obs, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "DECIDED|SPLIT|STABLE")

        # Multi-validator consensus simulation
        outcome = simulate_strict_eq([lambda: dec, lambda: dec, lambda: dec])
        self.assertTrue(outcome["agreed"])
        self.assertEqual(outcome["consensus_value"], "DECIDED|SPLIT|STABLE")

    def test_scenario_d_benchmark_case_a(self):
        # Case A: Clear admission in favor of Party 1
        criteria = [
            {"id": "milestone_delivery", "text": "Delivery", "weight_bp": 6000},
            {"id": "spec_compliance", "text": "Compliance", "weight_bp": 4000}
        ]
        obs = {"milestone_delivery": P1, "spec_compliance": P1}
        dec = _round_decision(criteria, obs, obs, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "DECIDED|PARTY_1|STABLE")

    def test_scenario_e_benchmark_case_b(self):
        # Case B: Shared balanced performance
        criteria = [
            {"id": "comp_a", "text": "Component A", "weight_bp": 5000},
            {"id": "comp_b", "text": "Component B", "weight_bp": 5000}
        ]
        obs = {"comp_a": P1, "comp_b": P2}
        dec = _round_decision(criteria, obs, obs, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "DECIDED|SPLIT|STABLE")

    def test_scenario_g_malformed_llm_json_fails_safely(self):
        criteria = [{"id": "c1", "text": "Factual compliance", "weight_bp": 10000}]
        # Malformed raw LLM output returns {}
        from tests.helpers_for_test import _parse
        parsed = _parse("invalid non-json output ``````")
        cleaned = _clean_obs(criteria, parsed, "some text")
        # All criteria default safely to UNCLEAR
        self.assertEqual(cleaned["c1"], "UNCLEAR")
        dec = _round_decision(criteria, cleaned, cleaned, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "INSUFFICIENT|NONE|NA")

    def test_scenario_h_ungrounded_quote_fails_safely(self):
        criteria = [{"id": "c1", "text": "Factual compliance", "weight_bp": 10000}]
        evidence_text = "[PARTY_1] says: Real authentic evidence text recorded on chain."
        # LLM claims PARTY_1 but invents a quote not in the evidence
        hallucinated = {"results": {"c1": {"favors": P1, "quote": "completely fabricated statement never made"}}}
        cleaned = _clean_obs(criteria, hallucinated, evidence_text)
        # Grounding check downgrades to UNCLEAR
        self.assertEqual(cleaned["c1"], "UNCLEAR")
        dec = _round_decision(criteria, cleaned, cleaned, margin_bp=1500, max_flips=1)
        self.assertEqual(dec, "INSUFFICIENT|NONE|NA")


if __name__ == '__main__':
    unittest.main()
