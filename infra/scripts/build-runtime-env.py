#!/usr/bin/env python3
import ast
import base64
import binascii
import json
import pathlib
import re
import secrets
import sys
import urllib.parse


KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
DATABASE_PORT = 55432
REDIS_PORT = 56379
EXAMPLE_ENCRYPTION_SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


def read_environment(path: pathlib.Path) -> dict[str, str]:
    values: dict[str, str] = {}

    if not path.exists() or path.stat().st_size == 0:
        return values

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"invalid environment line {line_number} in {path}")

        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not KEY_PATTERN.fullmatch(key):
            raise ValueError(f"invalid environment key on line {line_number} in {path}")
        if key in values:
            raise ValueError(f"duplicate environment key {key} in {path}")

        raw_value = raw_value.strip()
        if raw_value[:1] in {"'", '"'}:
            try:
                value = ast.literal_eval(raw_value)
            except (SyntaxError, ValueError) as error:
                raise ValueError(f"invalid quoted value on line {line_number} in {path}") from error
        else:
            value = raw_value
        if not isinstance(value, str):
            raise ValueError(f"environment value on line {line_number} in {path} must be a string")
        values[key] = value

    return values


def validate_database_url(value: str) -> None:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use postgres or postgresql")
    if parsed.hostname not in {"127.0.0.1", "localhost"} or (parsed.port or 5432) != DATABASE_PORT:
        raise ValueError(f"DATABASE_URL must point to localhost:{DATABASE_PORT}")
    if not parsed.username or not parsed.password or not parsed.path.lstrip("/"):
        raise ValueError("DATABASE_URL must contain a username, password, and database")
    role_name = urllib.parse.unquote(parsed.username)
    database_name = urllib.parse.unquote(parsed.path.lstrip("/"))
    if not KEY_PATTERN.fullmatch(role_name) or not KEY_PATTERN.fullmatch(database_name):
        raise ValueError("DATABASE_URL username and database must be simple PostgreSQL identifiers")


def validate_redis_url(value: str) -> None:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "redis":
        raise ValueError("REDIS_URL must use redis")
    if parsed.hostname not in {"127.0.0.1", "localhost"} or (parsed.port or 6379) != REDIS_PORT:
        raise ValueError(f"REDIS_URL must point to localhost:{REDIS_PORT}")
    if parsed.username or parsed.password:
        raise ValueError("REDIS_URL must not contain credentials for the localhost-only Redis service")


def validate_encryption_secret(value: str) -> None:
    padded_secret = value + "=" * (-len(value) % 4)
    try:
        decoded_secret = base64.b64decode(padded_secret, altchars=b"-_", validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("API_KEY_ENCRYPTION_SECRET must be valid base64") from error
    if len(decoded_secret) != 32:
        raise ValueError("API_KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes")


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: build-runtime-env.py <source-env> <existing-runtime-env> <output>")

    source_path = pathlib.Path(sys.argv[1])
    existing_path = pathlib.Path(sys.argv[2])
    output_path = pathlib.Path(sys.argv[3])
    source = read_environment(source_path)
    existing = read_environment(existing_path)

    for key in ("API_KEY_ENCRYPTION_SECRET", "TWELVEDATA_API_KEY"):
        if not source.get(key):
            raise ValueError(f"{key} must be present and non-empty in {source_path}")

    source_encryption_secret = source["API_KEY_ENCRYPTION_SECRET"]
    existing_encryption_secret = existing.get("API_KEY_ENCRYPTION_SECRET")
    if existing_encryption_secret is not None:
        validate_encryption_secret(existing_encryption_secret)
        if source_encryption_secret == EXAMPLE_ENCRYPTION_SECRET:
            encryption_secret = existing_encryption_secret
        elif source_encryption_secret != existing_encryption_secret:
            raise ValueError(
                "API_KEY_ENCRYPTION_SECRET differs from the existing production value; "
                "refusing an unsafe key rotation"
            )
        else:
            encryption_secret = source_encryption_secret
    elif source_encryption_secret == EXAMPLE_ENCRYPTION_SECRET:
        encryption_secret = base64.b64encode(secrets.token_bytes(32)).decode("ascii")
    else:
        encryption_secret = source_encryption_secret
    validate_encryption_secret(encryption_secret)

    if "DATABASE_URL" in source:
        database_url = source["DATABASE_URL"]
        existing_database_url = existing.get("DATABASE_URL")
        if existing_database_url is not None and database_url != existing_database_url:
            raise ValueError(
                "DATABASE_URL differs from the existing production value; "
                "refusing an unsafe database credential rotation"
            )
    elif "DATABASE_URL" in existing:
        database_url = existing["DATABASE_URL"]
    else:
        database_password = secrets.token_urlsafe(32)
        database_url = (
            f"postgresql://realtime_pricing:{database_password}"
            f"@localhost:{DATABASE_PORT}/realtime_pricing?schema=public"
        )
    validate_database_url(database_url)

    if "REDIS_URL" in source:
        redis_url = source["REDIS_URL"]
    elif "REDIS_URL" in existing:
        redis_url = existing["REDIS_URL"]
    else:
        redis_url = f"redis://localhost:{REDIS_PORT}"
    validate_redis_url(redis_url)

    source_text = source_path.read_text(encoding="utf-8")
    if encryption_secret != source_encryption_secret:
        rewritten_lines: list[str] = []
        for raw_line in source_text.splitlines():
            stripped_line = raw_line.strip()
            if stripped_line and not stripped_line.startswith("#") and "=" in stripped_line:
                key = stripped_line.split("=", 1)[0].strip()
                if key == "API_KEY_ENCRYPTION_SECRET":
                    raw_line = f"API_KEY_ENCRYPTION_SECRET={json.dumps(encryption_secret)}"
            rewritten_lines.append(raw_line)
        source_text = "\n".join(rewritten_lines)
    output_parts = [source_text.rstrip("\n")]
    additions: list[str] = []
    if "DATABASE_URL" not in source:
        additions.append(f"DATABASE_URL={json.dumps(database_url)}")
    if "REDIS_URL" not in source:
        additions.append(f"REDIS_URL={json.dumps(redis_url)}")
    if additions:
        output_parts.extend(["", "# Added for the native Azure deployment", *additions])

    runtime_text = "\n".join(output_parts).lstrip("\n") + "\n"
    if len(runtime_text.encode("utf-8")) > 20 * 1024:
        raise ValueError("converted runtime environment exceeds the 20 KiB deployment limit")
    output_path.write_text(runtime_text, encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Runtime environment conversion failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
