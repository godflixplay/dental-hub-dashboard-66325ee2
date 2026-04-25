// Componente leve para renderizar Markdown sem dependências externas.
// Suporta: # h1, ## h2, ### h3, parágrafos, listas - e *, **negrito**,
// links [txt](url), listas numeradas e linhas em branco como separador.

interface MarkdownProps {
  source: string;
}

function inline(text: string): (string | JSX.Element)[] {
  // Negrito **x** → <strong>
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`b${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (linkMatch) {
        parts.push(
          <a
            key={`l${key++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline hover:opacity-80"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source }: MarkdownProps) {
  const lines = source.split("\n");
  const elements: JSX.Element[] = [];
  let listBuf: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuf.length === 0) return;
    elements.push(
      <ul
        key={`ul${key++}`}
        className="my-3 ml-5 list-disc space-y-1 text-sm leading-relaxed"
      >
        {listBuf.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3${key++}`}
          className="mt-6 mb-2 text-base font-semibold text-foreground"
        >
          {inline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2${key++}`}
          className="mt-8 mb-3 text-xl font-bold text-foreground"
        >
          {inline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1
          key={`h1${key++}`}
          className="mt-2 mb-4 text-2xl font-bold text-foreground"
        >
          {inline(line.slice(2))}
        </h1>,
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <p
          key={`p${key++}`}
          className="my-3 text-sm leading-relaxed text-muted-foreground"
        >
          {inline(line)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="prose-zinc max-w-none">{elements}</div>;
}
