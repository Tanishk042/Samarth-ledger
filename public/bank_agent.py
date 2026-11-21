#!/usr/bin/env python3
"""Reference bank-agent client for Samarth Ledger locked-balance proofs.

This is a * demonstration helper*, not a production banking integration. It
signs a payload about locked FDRs with a locally generated P-256 key and can
optionally POST the public verification material to /api/proof. No customer
data is included, and no real bank system is contacted.

Install:  pip install cryptography
Run:      python3 public/bank_agent.py
With API: API_URL=http://localhost:5173 python3 public/bank_agent.py
"""
from __future__ import annotations

import base64
import json
import os
from datetime import date

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def jwk(public_key: ec.EllipticCurvePublicKey) -> dict:
    numbers = public_key.public_numbers()
    size = 32
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64url(numbers.x.to_bytes(size, "big")),
        "y": b64url(numbers.y.to_bytes(size, "big")),
    }


def canonical(payload: dict) -> bytes:
    """Match the browser/API canonical form: sorted keys, no whitespace."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign(private_key: ec.EllipticCurvePrivateKey, payload: dict) -> str:
    return b64url(private_key.sign(canonical(payload), ec.ECDSA(hashes.SHA256())))


def verify(public_key: ec.EllipticCurvePublicKey, payload: dict, signature: str) -> bool:
    try:
        public_key.verify(
            base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4)),
            canonical(payload),
            ec.ECDSA(hashes.SHA256()),
        )
        return True
    except (InvalidSignature, ValueError):
        return False


def build_payload(bank_id: str, bank_code: str, fdr_count: int) -> dict:
    return {
        "schema": "aicte.fdr.locked-proof.v1",
        "bankCode": bank_code,
        "bankId": bank_id,
        "proofDate": date.today().isoformat(),
        "fdrCount": fdr_count,
        "amountLocked": "YES",
        "customerDataIncluded": False,
        "nonce": os.urandom(16).hex(),
    }


def post_to_api(endpoint: str, body: dict) -> None:
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen

    request = Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Demo-Role": "bank"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=8) as response:
            print(json.dumps(json.load(response), indent=2))
    except HTTPError as error:
        print(f"API returned {error.code}: {error.read().decode('utf-8')}")


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    payload = build_payload(
        os.getenv("BANK_ID", "saraswat"),
        os.getenv("BANK_CODE", "SRCB0000123"),
        int(os.getenv("FDR_COUNT", "7")),
    )
    signature = sign(private_key, payload)
    material = {
        "action": "verify",
        "payload": payload,
        "signature": signature,
        "publicJwk": jwk(private_key.public_key()),
    }

    print("SIMULATED bank proof — no real bank account was accessed.")
    print(json.dumps(material, indent=2))
    print(f"\nLocal verification: {'PASS' if verify(private_key.public_key(), payload, signature) else 'FAIL'}")
    tampered = {**payload, "fdrCount": payload["fdrCount"] + 1}
    print(f"Tampered payload:   {'PASS' if verify(private_key.public_key(), tampered, signature) else 'FAIL (fail closed)'}")

    endpoint = os.getenv("API_URL")
    if endpoint:
        print(f"\nPOSTing public material to {endpoint.rstrip('/')}/api/proof ...")
        post_to_api(f"{endpoint.rstrip('/')}/api/proof", material)
    else:
        print("\nSet API_URL to also exercise /api/proof. The private key is never transmitted.")


if __name__ == "__main__":
    main()
