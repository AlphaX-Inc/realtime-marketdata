#!/usr/bin/env python3
import ast
import pathlib
import re
import subprocess
import sys
import urllib.parse


ENV_PATH = pathlib.Path("/etc/realtime-marketdata/runtime.env")
EXPECTED_PORT = 55432
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def read_environment(path: pathlib.Path) -> dict[str, str]:
    environment: dict[str, str] = {}

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"invalid environment line {line_number}")

        key, raw_value = line.split("=", 1)
        key = key.strip()
        raw_value = raw_value.strip()
        if raw_value[:1] in {"'", '"'}:
            try:
                value = ast.literal_eval(raw_value)
            except (SyntaxError, ValueError) as error:
                raise ValueError(f"invalid quoted value on line {line_number}") from error
        else:
            value = raw_value
        environment[key] = value

    return environment


def main() -> None:
    database_url = read_environment(ENV_PATH).get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is required")

    parsed = urllib.parse.urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use postgres or postgresql")
    if parsed.hostname not in {"127.0.0.1", "localhost"}:
        raise ValueError("DATABASE_URL must use localhost for the native deployment")
    if (parsed.port or 5432) != EXPECTED_PORT:
        raise ValueError(f"DATABASE_URL must use PostgreSQL port {EXPECTED_PORT}")

    role_name = urllib.parse.unquote(parsed.username or "")
    role_password = urllib.parse.unquote(parsed.password or "")
    database_name = urllib.parse.unquote(parsed.path.lstrip("/"))
    if not role_name or not role_password or not database_name:
        raise ValueError("DATABASE_URL must include a username, password, and database")
    if not IDENTIFIER_PATTERN.fullmatch(role_name) or not IDENTIFIER_PATTERN.fullmatch(database_name):
        raise ValueError("DATABASE_URL username and database must be simple PostgreSQL identifiers")

    def sql_literal(value: str) -> str:
        return "'" + value.replace("'", "''") + "'"

    role_literal = sql_literal(role_name)
    password_literal = sql_literal(role_password)
    database_literal = sql_literal(database_name)
    sql = f"""
SELECT format('CREATE ROLE %I LOGIN', {role_literal})
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = {role_literal}) \\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', {role_literal}, {password_literal}) \\gexec
SELECT format('CREATE DATABASE %I OWNER %I', {database_literal}, {role_literal})
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = {database_literal}) \\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', {database_literal}, {role_literal}) \\gexec
"""
    subprocess.run(
        [
            "runuser",
            "-u",
            "postgres",
            "--",
            "psql",
            "--set=ON_ERROR_STOP=1",
        ],
        input=sql,
        check=True,
        text=True,
        stdout=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"PostgreSQL configuration failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
