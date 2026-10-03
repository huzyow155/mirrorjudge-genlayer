import unittest
from tests.helpers_for_test import (
    _anonymize, _swap_labels, _pass_text, _score, _check_criteria, _grounded,
    _parse_aliases, _judge_round, _run_pass, P1, P2
)


class TestLayer1Pure(unittest.TestCase):
    def test_anonymize_longest_first_and_case_insensitive(self):
        # Longest alias replacement precedence: "Alice Smith" must be replaced before "Alice"
        aliases1 = ["Alice", "Alice Smith", "Client"]
        aliases2 = ["Bob Builder", "Bob", "Contractor"]

        text = "alice smith spoke to alice, while Bob Builder informed bob and the client."
        anon = _anonymize(text, aliases1, aliases2)

        # "alice smith" -> [PARTY_1], "alice" -> [PARTY_1]
        # "Bob Builder" -> [PARTY_2], "bob" -> [PARTY_2]
        # "client" -> [PARTY_1]
        self.assertNotIn("alice", anon.lower())
        self.assertNotIn("bob", anon.lower())
        self.assertNotIn("client", anon.lower())
        self.assertEqual(
            anon,
            "[PARTY_1] spoke to [PARTY_1], while [PARTY_2] informed [PARTY_2] and the [PARTY_1]."
        )

    def test_mirror_swaps_labels_and_reverses_order(self):
        evidence = [
            {"by": "PARTY_1", "text": "Alice provided initial milestone specs."},
            {"by": "PARTY_2", "text": "Bob delivered implementation code."},
        ]
        a1 = ["Alice"]
        a2 = ["Bob"]

        canonical_text = _pass_text(evidence, a1, a2, mirrored=False)
        mirrored_text = _pass_text(evidence, a1, a2, mirrored=True)

        # In canonical:
        # line 1: [PARTY_1] says: [PARTY_1] provided initial milestone specs.
        # line 2: [PARTY_2] says: [PARTY_2] delivered implementation code.
        lines_can = canonical_text.split("\n")
        self.assertEqual(len(lines_can), 2)
        self.assertTrue(lines_can[0].startswith("[PARTY_1] says:"))
        self.assertIn("[PARTY_1] provided", lines_can[0])
        self.assertTrue(lines_can[1].startswith("[PARTY_2] says:"))
        self.assertIn("[PARTY_2] delivered", lines_can[1])

        # In mirrored:
        # Order reversed (evidence[1] comes first), and party labels swapped ([PARTY_2] becomes [PARTY_1])
        # line 1: [PARTY_1] says: [PARTY_1] delivered implementation code.
        # line 2: [PARTY_2] says: [PARTY_2] provided initial milestone specs.
        lines_mir = mirrored_text.split("\n")
        self.assertEqual(len(lines_mir), 2)
        self.assertTrue(lines_mir[0].startswith("[PARTY_1] says:"))
        self.assertIn("[PARTY_1] delivered implementation code.", lines_mir[0])
        self.assertTrue(lines_mir[1].startswith("[PARTY_2] says:"))
        self.assertIn("[PARTY_2] provided initial milestone specs.", lines_mir[1])

    def test_score_at_exact_margin_boundaries(self):
        criteria = [
            {"id": "c1", "text": "Crit 1", "weight_bp": 6000},
            {"id": "c2", "text": "Crit 2", "weight_bp": 4000},
        ]
        margin_bp = 1500

        # Exact boundary: 6000 vs 4500 (diff 1500 -> PARTY_1)
        crit_boundary = [
            {"id": "c1", "text": "Crit 1", "weight_bp": 5750},
            {"id": "c2", "text": "Crit 2", "weight_bp": 4250},
        ]
        # s1 - s2 = 5750 - 4250 = 1500 -> P1
        favors_p1 = {"c1": P1, "c2": P2}
        self.assertEqual(_score(crit_boundary, favors_p1, margin_bp), P1)

        # 1 bp below margin: diff 1498 -> SPLIT
        crit_sub = [
            {"id": "c1", "text": "Crit 1", "weight_bp": 5749},
            {"id": "c2", "text": "Crit 2", "weight_bp": 4251},
        ]
        favors_split = {"c1": P1, "c2": P2}
        self.assertEqual(_score(crit_sub, favors_split, margin_bp), "SPLIT")

        # Reverse boundary: s2 - s1 = 1500 -> P2
        favors_p2 = {"c1": P2, "c2": P1}
        self.assertEqual(_score(crit_boundary, favors_p2, margin_bp), P2)

        # Unclear threshold: unclear * 2 > 10000 -> INSUFFICIENT
        crit_unclear = [
            {"id": "c1", "text": "Crit 1", "weight_bp": 5001},
            {"id": "c2", "text": "Crit 2", "weight_bp": 4999},
        ]
        favors_unc = {"c1": "UNCLEAR", "c2": P1}
        self.assertEqual(_score(crit_unclear, favors_unc, margin_bp), "INSUFFICIENT")

        # Unclear threshold: unclear * 2 == 10000 (5000 bp) -> not INSUFFICIENT
        crit_unc_half = [
            {"id": "c1", "text": "Crit 1", "weight_bp": 5000},
            {"id": "c2", "text": "Crit 2", "weight_bp": 5000},
        ]
        favors_half = {"c1": "UNCLEAR", "c2": P1}
        self.assertEqual(_score(crit_unc_half, favors_half, margin_bp), P1)

    def test_check_criteria_validation(self):
        # Valid criteria
        valid = [
            {"id": "crit_1", "text": "Criterion 1", "weight_bp": 5000},
            {"id": "crit_2", "text": "Criterion 2", "weight_bp": 5000},
        ]
        _check_criteria(valid)  # should not raise

        # Rejects weights not summing to 10000
        with self.assertRaises(ValueError):
            _check_criteria([{"id": "c1", "text": "Crit 1", "weight_bp": 9999}])
        with self.assertRaises(ValueError):
            _check_criteria([{"id": "c1", "text": "Crit 1", "weight_bp": 10001}])

        # Rejects 0 criteria or > 6 criteria
        with self.assertRaises(ValueError):
            _check_criteria([])
        with self.assertRaises(ValueError):
            _check_criteria([{"id": f"c_{i}", "text": "T", "weight_bp": 10000 // 7} for i in range(7)])

        # Rejects duplicate or invalid ids
        with self.assertRaises(ValueError):
            _check_criteria([
                {"id": "c1", "text": "T1", "weight_bp": 5000},
                {"id": "c1", "text": "T2", "weight_bp": 5000},
            ])
        with self.assertRaises(ValueError):
            _check_criteria([{"id": "BAD ID WITH SPACES", "text": "T", "weight_bp": 10000}])

    def test_grounded_quote_checks(self):
        evidence_text = "[PARTY_1] says: The software was delivered on schedule with zero critical bugs."

        # Verbatim quote >= 12 chars in text
        self.assertTrue(_grounded("software was delivered on schedule", evidence_text))
        self.assertTrue(_grounded("SOFTWARE WAS DELIVERED", evidence_text))

        # Under 12 characters
        self.assertFalse(_grounded("delivered", evidence_text))

        # Invented quote not in text
        self.assertFalse(_grounded("completely hallucinated statement that is long enough", evidence_text))

    def test_star_test_biased_judges_flagged_unstable(self):
        """
        Star test:
        1. A judge that always answers PARTY_1 gives decisive PARTY_1 in a single pass,
           but _judge_round returns UNSTABLE|NONE|UNSTABLE.
        2. A judge that favours whoever is listed first gives decisive PARTY_1 in a single pass,
           but _judge_round returns UNSTABLE|NONE|UNSTABLE.
        3. A consistent judge gives DECIDED|PARTY_1|STABLE.
        4. Invented quotes or malformed JSON give INSUFFICIENT, never a decision.
        """
        criteria = [
            {"id": "delivery", "text": "Delivery verified", "weight_bp": 6000},
            {"id": "quality", "text": "Quality verified", "weight_bp": 4000},
        ]
        evidence = [
            {"by": "PARTY_1", "text": "Alice delivered full codebase with 100 percent test coverage."},
            {"by": "PARTY_2", "text": "Bob confirms Alice delivered full codebase with 100 percent test coverage."},
        ]
        a1 = ["Alice"]
        a2 = ["Bob"]
        margin_bp = 1500
        max_flips = 1

        quote = "delivered full codebase with 100 percent test coverage"

        # 1. Biased Judge A: Always answers PARTY_1 regardless of prompt
        def always_p1_judge(p):
            return {
                "results": {
                    "delivery": {"favors": P1, "quote": quote},
                    "quality": {"favors": P1, "quote": quote},
                }
            }

        # Baseline: Single pass gives decisive PARTY_1 (demonstrating bias vulnerability of 1-pass)
        single_pass_a = _run_pass(always_p1_judge, criteria, evidence, a1, a2, mirrored=False)
        self.assertEqual(_score(criteria, single_pass_a, margin_bp), P1)

        # But under dual-pass mirroring:
        decision_a, can_a, mir_a = _judge_round(always_p1_judge, criteria, evidence, a1, a2, margin_bp, max_flips)
        self.assertEqual(decision_a, "UNSTABLE|NONE|UNSTABLE", "Always-PARTY_1 judge must be flagged UNSTABLE")

        # 2. Biased Judge B: Always favors whoever is listed first
        def first_listed_judge(p):
            # In CANONICAL, PARTY_1 is listed first.
            # In MIRRORED, PARTY_2 is listed first in evidence, but LLM chooses whichever label it sees first
            # If it favors whoever is mentioned first in the UNTRUSTED_EVIDENCE block:
            ev_block = p.split("<UNTRUSTED_EVIDENCE>")[1].split("</UNTRUSTED_EVIDENCE>")[0]
            first_label = P1 if ev_block.strip().startswith("[PARTY_1]") else P2
            return {
                "results": {
                    "delivery": {"favors": first_label, "quote": quote},
                    "quality": {"favors": first_label, "quote": quote},
                }
            }

        # Baseline: Single pass gives decisive PARTY_1
        single_pass_b = _run_pass(first_listed_judge, criteria, evidence, a1, a2, mirrored=False)
        self.assertEqual(_score(criteria, single_pass_b, margin_bp), P1)

        decision_b, can_b, mir_b = _judge_round(first_listed_judge, criteria, evidence, a1, a2, margin_bp, max_flips)
        self.assertEqual(decision_b, "UNSTABLE|NONE|UNSTABLE", "Order-biased judge must be flagged UNSTABLE")

        # 3. Consistent Judge: Correctly tracks the party who satisfied the criteria
        # In canonical, Alice (P1) delivered.
        # In mirrored, Bob (swapped to P1) delivered, so LLM observes P2 under swapped labels.
        def consistent_judge(p):
            # If the pass text says [PARTY_1] delivered, it favors PARTY_1.
            # If the pass text says [PARTY_2] delivered, it favors PARTY_2.
            ev_block = p.split("<UNTRUSTED_EVIDENCE>")[1].split("</UNTRUSTED_EVIDENCE>")[0]
            fav = P1 if "[PARTY_1] delivered" in ev_block else P2
            return {
                "results": {
                    "delivery": {"favors": fav, "quote": quote},
                    "quality": {"favors": fav, "quote": quote},
                }
            }

        decision_c, can_c, mir_c = _judge_round(consistent_judge, criteria, evidence, a1, a2, margin_bp, max_flips)
        self.assertEqual(decision_c, "DECIDED|PARTY_1|STABLE", "Consistent judge must yield DECIDED|PARTY_1|STABLE")

        # 4. Invented Quotes -> Ungrounded -> UNCLEAR -> INSUFFICIENT
        def invented_quote_judge(p):
            return {
                "results": {
                    "delivery": {"favors": P1, "quote": "completely fabricated quote not in evidence"},
                    "quality": {"favors": P1, "quote": "another fake quote that is not found anywhere"},
                }
            }

        decision_d, _, _ = _judge_round(invented_quote_judge, criteria, evidence, a1, a2, margin_bp, max_flips)
        self.assertEqual(decision_d, "INSUFFICIENT|NONE|NA", "Invented quotes must yield INSUFFICIENT")

        # 5. Malformed JSON -> parsed as empty -> UNCLEAR -> INSUFFICIENT
        def malformed_json_judge(p):
            return "This is not JSON at all: I think party 1 won"

        decision_e, _, _ = _judge_round(malformed_json_judge, criteria, evidence, a1, a2, margin_bp, max_flips)
        self.assertEqual(decision_e, "INSUFFICIENT|NONE|NA", "Malformed JSON must yield INSUFFICIENT")


if __name__ == '__main__':
    unittest.main()
