# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


class Probe(gl.Contract):
    probe_results: str

    def __init__(self):
        sender = gl.message.sender_address
        sender_hex = sender.as_hex
        sender_str = str(sender)

        import hashlib
        test_hash = hashlib.sha256(b"mirrorjudge_probe").hexdigest()[:12]
        user_error_ok = (gl.vm.UserError.__name__ == "UserError")

        report = {
            "sender_address": sender_hex,
            "sender_str": sender_str,
            "sender_type": str(type(sender).__name__),
            "hashlib_test": test_hash,
            "user_error_class": "gl.vm.UserError" if user_error_ok else "UNKNOWN",
            "strict_eq_passed": False,
            "response_format_param_supported": False,
            "nondet_raw_output": "",
            "nondet_type": "",
        }
        self.probe_results = json.dumps(report)

    @gl.public.view
    def get_results(self) -> str:
        return self.probe_results

    @gl.public.write
    def probe_consensus(self) -> None:
        def compute_nondet() -> str:
            res_str = ""
            rf_ok = False
            try:
                res = gl.nondet.exec_prompt(
                    "Output JSON: {\"status\": \"OK\"}",
                    response_format="json",
                )
                rf_ok = True
                res_str = str(res).strip()
            except Exception:
                res = gl.nondet.exec_prompt("Output JSON: {\"status\": \"OK\"}")
                rf_ok = False
                res_str = str(res).strip()

            return json.dumps({
                "rf_ok": rf_ok,
                "res_type": type(res).__name__,
                "res": res_str,
            })

        eq_val = gl.eq_principle.strict_eq(compute_nondet)

        curr = json.loads(self.probe_results)
        parsed_eq = json.loads(eq_val)
        curr["strict_eq_passed"] = True
        curr["response_format_param_supported"] = parsed_eq.get("rf_ok", False)
        curr["nondet_raw_output"] = parsed_eq.get("res", "")
        curr["nondet_type"] = parsed_eq.get("res_type", "")
        self.probe_results = json.dumps(curr)
