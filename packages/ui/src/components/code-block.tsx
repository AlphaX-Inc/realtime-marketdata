import * as React from "react";
import { cn } from "../lib/utils";

function getCodeText(children: React.ReactNode): string | null {
  if (typeof children === "string") {
    return children;
  }

  const childArray = React.Children.toArray(children);
  if (childArray.length !== 1) {
    return null;
  }

  const child = childArray[0];
  if (
    React.isValidElement<{ children?: React.ReactNode }>(child) &&
    child.type === "code" &&
    typeof child.props.children === "string"
  ) {
    return child.props.children;
  }

  return null;
}

function highlightCode(source: string) {
  const tokenPattern =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:])/g;

  return source.split("\n").map((line, lineIndex, lines) => {
    const leadingWhitespaceLength = line.length - line.trimStart().length;
    const trimmedLine = line.slice(leadingWhitespaceLength);

    if (trimmedLine.startsWith("//")) {
      return (
        <React.Fragment key={lineIndex}>
          {line.slice(0, leadingWhitespaceLength)}
          <span className="text-zinc-500 italic">{trimmedLine}</span>
          {lineIndex < lines.length - 1 ? "\n" : null}
        </React.Fragment>
      );
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(tokenPattern)) {
      const token = match[0];
      const index = match.index ?? 0;

      if (index > lastIndex) {
        parts.push(line.slice(lastIndex, index));
      }

      const className =
        token.startsWith('"') &&
        line
          .slice(index + token.length)
          .trimStart()
          .startsWith(":")
          ? "text-primary font-semibold"
          : token.startsWith('"')
            ? "text-[#8a5a1f]"
            : /^(true|false|null)$/.test(token)
              ? "text-[#9a4f3c] font-semibold"
              : /^-?\d/.test(token)
                ? "text-[#2f6f62] font-semibold"
                : "text-zinc-400";

      parts.push(
        <span className={className} key={`${lineIndex}-${index}`}>
          {token}
        </span>,
      );
      lastIndex = index + token.length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <React.Fragment key={lineIndex}>
        {parts}
        {lineIndex < lines.length - 1 ? "\n" : null}
      </React.Fragment>
    );
  });
}

export function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const codeText = getCodeText(children);

  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-border/70 bg-[#f6f1e7] p-4 text-sm leading-6 text-zinc-800 shadow-[0_1px_0_hsl(0_0%_100%_/_0.82)_inset,0_12px_34px_hsl(230_12%_11%_/_0.06)]",
        className,
      )}
      {...props}
    >
      {codeText ? <code>{highlightCode(codeText)}</code> : children}
    </pre>
  );
}

export function InlineCode({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        "rounded-md bg-secondary px-2 py-1 font-mono text-xs text-zinc-900 shadow-[0_1px_0_hsl(0_0%_100%_/_0.75)_inset]",
        className,
      )}
      {...props}
    />
  );
}
